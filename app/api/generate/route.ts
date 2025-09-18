// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

// ---------- tiny utils ----------
function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // If the model returned JSON like: { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {
      /* ignore */
    }
  }

  // Strip fenced code blocks: ```html ... ``` or ``` ... ```
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

  // meta name="referrer" no-referrer
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

  // add attributes to each <img>
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });

  return out;
}

/** Re-host every <img src="..."> via Cloudinary 'fetch' (no uploads). */
function rewriteImagesWithCloudinary(html: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return html; // silently keep originals if not configured

  const base = `https://res.cloudinary.com/${cloud}/image/fetch/f_auto,q_auto/`;

  return html.replace(/<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi, (tag, q, src) => {
    // only http(s) absolute sources
    if (!/^https?:\/\//i.test(src)) return tag;

    const proxied = base + encodeURIComponent(src);
    return tag.replace(src, proxied);
  });
}

// ---------- main handler ----------
export async function POST(req: NextRequest) {
  try {
    // Accept prompt from body OR query (?q=)
    let promptFromBody: string | undefined;
    try {
      const body = (await req.json()) as any;
      promptFromBody = body?.prompt ?? body?.query ?? body?.text;
    } catch {
      /* empty or not JSON */
    }
    const promptFromQuery = req.nextUrl.searchParams.get("q") ?? undefined;
    const userPrompt = (promptFromBody ?? promptFromQuery ?? "").trim();

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Missing prompt", html: "", slug: "" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      const msg =
        "<!doctype html><html><body><p style='font:14px/1.4 ui-sans-serif,system-ui'>OPENAI_API_KEY is not set in Vercel → Project → Settings → Environment Variables.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userPrompt) }, { status: 200 });
    }

    // Load your system prompt text file (kept in repo)
    const systemPrompt = await readFile(
      // ../../prompt/system-prompt.txt relative to this file
      new URL("../../prompt/system-prompt.txt", import.meta.url),
      "utf8"
    );

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Call model
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    // Raw model content → plain HTML
    const raw = (completion.choices[0]?.message?.content ?? "").trim();
    const pure = toPureHtml(raw);

    // Post-process: ensure image, no-referrer, then re-host images via Cloudinary
    const withImage = ensureAtLeastOneImage(pure);
    const htmlNoRef = addNoReferrer(withImage);
    const html = rewriteImagesWithCloudinary(htmlNoRef);

    return NextResponse.json(
      { html, slug: slugify(userPrompt) },
      { status: 200 }
    );
  } catch (err: any) {
    // Return the error string so the UI can show it
    return NextResponse.json(
      { error: String(err ?? "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}
