// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ----- config you can tweak -----
const MODEL = "gpt-4o-mini";
const PROMPT_FILE = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
const IMAGE_PREFIX = "recipes/img/"; // blob folder for rehosted images
// --------------------------------

export async function POST(req: NextRequest) {
  try {
    const userPrompt = await getUserPrompt(req);
    if (!userPrompt) {
      return NextResponse.json(
        { error: "Missing prompt", html: "", slug: "" },
        { status: 400 }
      );
    }

    // 1) Load system prompt from file (reliable on Vercel)
    const systemPrompt = await readFile(PROMPT_FILE, "utf8");

    // 2) OpenAI call
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error:
          "OPENAI_API_KEY is not set (Vercel → Project → Settings → Environment Variables).",
        html: "",
        slug: "",
      }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    const raw = (choices[0]?.message?.content ?? "").trim();
    const baseHtml = toPureHtml(raw);

    // Always ensure at least one image (if none came back)
    const ensured = ensureAtLeastOneImage(baseHtml);

    // 3) Rehost external images to Vercel Blob (fast + reliable)
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      // Don’t fail generation—return with a clear message in-page.
      const html = addNoReferrer(
        ensured +
          `<div style="margin:16px 0;padding:12px;border:1px solid #f0ad4e;background:#fff8e6;color:#8a6d3b;border-radius:8px;font:14px/1.4 system-ui">
             Note: Images were not rehosted because <code>BLOB_READ_WRITE_TOKEN</code> is not set.
           </div>`
      );
      return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
    }

    const rehostedHtml = await rehostImages(ensured, token);
    const finalHtml = addNoReferrer(rehostedHtml);

    return NextResponse.json(
      { html: finalHtml, slug: slugify(userPrompt) },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err || "Load failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}

/* ---------------- helpers ---------------- */

async function getUserPrompt(req: NextRequest): Promise<string> {
  let fromBody: string | undefined;
  try {
    const body = (await req.json()) as any;
    fromBody = body?.prompt ?? body?.query ?? body?.text;
  } catch {
    // ignore
  }
  const fromQuery = req.nextUrl.searchParams.get("q") ?? undefined;
  return (fromBody ?? fromQuery ?? "").trim();
}

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // If the model returned JSON like: { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {/* ignore */}
  }

  // Strip fenced code blocks: ```html ... ``` or ``` ... ```
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}

/** If there are *no* <img> tags, inject a neutral hero at the top of <body> (or document). */
function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;

  const hero =
    `<img src="https://picsum.photos/1200/630" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" />`;

  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) {
    return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  }
  return `${hero}\n${html}`;
}

/**
 * Rehost every absolute HTTP(S) image to Vercel Blob, return HTML with swapped src.
 * Fast path: parallel uploads with Promise.allSettled (throttled to avoid spikes).
 */
async function rehostImages(html: string, token: string): Promise<string> {
  const srcs = new Map<string, string>(); // original -> newUrl
  const imgRe = /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

  const toUpload: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const src = m[1];
    if (!srcs.has(src)) {
      srcs.set(src, ""); // reserve
      toUpload.push(src);
    }
  }
  if (!toUpload.length) return html;

  // Throttle batches of 4
  const batches: string[][] = [];
  for (let i = 0; i < toUpload.length; i += 4) {
    batches.push(toUpload.slice(i, i + 4));
  }

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (src) => {
        try {
          const res = await fetch(src, {
            headers: {
              // be polite; helps some CDNs
              "User-Agent":
                "Mozilla/5.0 (compatible; FreshRecipesBot/1.0; +https://freshrecipes.vercel.app)",
              "Accept": "*/*",
            },
            // some hosts dislike keep-alive from serverless
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`fetch ${src} -> ${res.status}`);

          const ct = res.headers.get("content-type") || "image/jpeg";
          const buf = Buffer.from(await res.arrayBuffer());
          const ext = ct.includes("png")
            ? "png"
            : ct.includes("webp")
            ? "webp"
            : ct.includes("gif")
            ? "gif"
            : "jpg";

          const key = `${IMAGE_PREFIX}${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;

          const putRes = await put(key, buf, {
            access: "public",
            addRandomSuffix: false,
            contentType: ct,
            token,
          });

          // put() returns a public url
          if (!putRes?.url) throw new Error("no url from put()");
          srcs.set(src, putRes.url);
        } catch {
          // If rehost fails, keep the original src (don’t break the page)
          srcs.set(src, src);
        }
      })
    );
  }

  // Replace in HTML
  let out = html;
  for (const [orig, newer] of srcs.entries()) {
    if (orig && newer) {
      // replace exactly that URL inside img tags
      const esc = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(<img\\b[^>]*\\bsrc=["'])${esc}(["'][^>]*>)`, "gi"), `$1${newer}$2`);
    }
  }
  return out;
}

function addNoReferrer(html: string): string {
  let out = html || "";

  // Ensure <head> contains meta referrer
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
    }
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }

  // Add attributes to every <img>
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });

  return out;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
