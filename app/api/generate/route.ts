// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

/* --------------------------- route handler --------------------------- */
export async function POST(req: NextRequest) {
  try {
    // read prompt: app/prompt/system-prompt.txt
    const promptPath = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
    const systemPrompt = await readFile(promptPath, "utf8");

    // read user text (body OR query `q`)
    let userText = "";
    try {
      const body = (await req.json()) as any;
      userText = (body?.prompt ?? body?.query ?? body?.text ?? "").trim();
    } catch { /* ignore */ }
    if (!userText) {
      userText = (req.nextUrl.searchParams.get("q") ?? "").trim();
    }
    if (!userText) {
      return NextResponse.json({ error: "Missing prompt", html: "", slug: "" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const msg =
        "<!doctype html><html><body><p style='font:14px/1.4 ui-sans-serif,system-ui'>OPENAI_API_KEY is not set in Vercel → Project → Settings → Environment Variables.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userText) }, { status: 200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userText },
    ];

    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    const raw = (resp.choices?.[0]?.message?.content ?? "").trim();

    // Post-process
    const pure = toPureHtml(raw);
    const withImage = ensureAtLeastOneImage(pure);
    const htmlNoRef = addNoReferrer(withImage);
    const html = rewriteImagesWithCloudinary(htmlNoRef); // ← rehost all <img src=>

    return NextResponse.json(
      { html, slug: slugify(userText) },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}

/* ------------------------------- helpers ------------------------------ */

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // JSON shape: { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {}
  }

  // Strip ```html ... ``` or ``` ... ```
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}

function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;

  const hero =
    `<img src="https://picsum.photos/1200/630" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" />`;

  // After first H1, or after <body>, or prepend
  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) {
    return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  }
  return `${hero}\n${html}`;
}

function addNoReferrer(html: string): string {
  let out = html || "";

  // meta referrer
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

  // add attrs to every <img>
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });

  return out;
}

/**
 * Re-host every <img src="..."> via Cloudinary "fetch".
 * Requires env: CLOUDINARY_CLOUD_NAME (or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)
 * Falls back to original src if env missing or src is not http(s).
 */
function rewriteImagesWithCloudinary(html: string): string {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    "";

  if (!cloudName) return html; // nothing to rewrite

  const fetchBase = `https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_auto/`;

  return html.replace(/<img\b[^>]*\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi, (tag, _m, g1, g2, g3) => {
    const srcRaw = (g1 || g2 || g3 || "").toString().trim();
    const src = srcRaw.replace(/^["']|["']$/g, ""); // normalize quotes if any

    // Only rewrite absolute http(s) — leave data:, cid:, blob:, relative paths alone
    if (!/^https?:\/\//i.test(src)) return tag;

    // Avoid double rewriting if already Cloudinary fetch
    if (/res\.cloudinary\.com\/[^/]+\/image\/fetch/i.test(src)) return tag;

    const encoded = encodeURIComponent(src); // Cloudinary expects URL-encoded remote URL
    const proxied = `${fetchBase}${encoded}`;

    // replace the first src="...":
    let out = tag.replace(
      /\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i,
      `src="${proxied}"`
    );

    // ensure referrer attrs still present (in case earlier step was skipped)
    if (!/\breferrerpolicy=/i.test(out)) {
      out = out.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer"${m}`);
    }
    if (!/\bcrossorigin=/i.test(out)) {
      out = out.replace(/\/?>$/, (m) => ` crossorigin="anonymous"${m}`);
    }

    return out;
  });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
