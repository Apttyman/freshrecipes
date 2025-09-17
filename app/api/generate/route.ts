// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini"; // stable + inexpensive

export async function POST(req: NextRequest) {
  try {
    // Accept prompt from body or query for backward compatibility
    let promptFromBody: string | undefined;
    try {
      const body = (await req.json()) as any;
      promptFromBody = body?.prompt ?? body?.query ?? body?.text;
    } catch {
      /* body may be empty or not JSON */
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

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Keep instructions light; we sanitize afterwards.
    const messages = [
      {
        role: "system" as const,
        content:
          "Return only a complete standalone HTML5 document (<html>…</html>) with inline <style>. Include at least one <img> with an absolute HTTPS src. Do not wrap in Markdown or JSON.",
      },
      { role: "user" as const, content: userPrompt },
    ];

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    const raw = (choices[0]?.message?.content ?? "").trim();

    // Minimal post-processing:
    const pure = toPureHtml(raw);
    const withImage = ensureAtLeastOneImage(pure);

    // CRITICAL: rewrite <img src="https://..."> → /api/proxy?url=ENCODED
    // and add referrer/crossorigin attributes + meta no-referrer.
    const html = addNoReferrerAndProxy(withImage);

    return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}

/* ---------------- helpers ---------------- */

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
 * 1) Ensures meta referrer no-referrer in <head>
 * 2) Rewrites every <img src="https://…"> into <img src="/api/proxy?url=ENCODED">
 * 3) Adds referrerpolicy/crossorigin attributes
 */
function addNoReferrerAndProxy(html: string): string {
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

  // Normalize & proxy every <img>
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag;

    // remove any old attrs we don't want duplicated
    t = t
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

    // Extract src (prefer HTTPS absolute)
    const srcMatch = t.match(/\ssrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const src = (srcMatch?.[2] || srcMatch?.[3] || srcMatch?.[4] || "").trim();

    let proxied = src;

    if (/^https?:\/\//i.test(src)) {
      proxied = `/api/proxy?url=${encodeURIComponent(src)}`;
    } else if (src.startsWith("//")) {
      proxied = `/api/proxy?url=${encodeURIComponent("https:" + src)}`;
    } else if (!src) {
      proxied = "https://picsum.photos/800/450";
    }

    if (src) {
      t = t.replace(srcMatch![0], ` src="${proxied}"`);
    } else {
      // no src found -> inject one
      t = t.replace(/<img/i, `<img src="${proxied}"`);
    }

    // Append safe attrs and normalize closing
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });

  return out;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
