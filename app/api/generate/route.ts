// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini"; // stable + fast

export async function POST(req: NextRequest) {
  try {
    // Accept prompt from multiple sources to be backward-compatible
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

    // Keep instructions light; we sanitize output afterwards
    const messages = [
      {
        role: "system" as const,
        content:
          "Return a complete standalone HTML5 document only (<html>…</html>) with inline <style>. Include at least one <img> with an absolute HTTPS src. Do not include Markdown fences or JSON.",
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
    // If no <img>, insert a neutral hero so there is *always* an image
    const withImage = ensureAtLeastOneImage(pure);
    // Enforce no-referrer on all images + meta tag
    const html = addNoReferrer(withImage);

    return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}

/* ---------------- tiny helpers (non-destructive) ---------------- */

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // If the model returned JSON like: { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {
      /* ignore parse error */
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

  // Try after <h1>, then start of <body>, else prepend
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

   // Add attributes to every <img> and ensure absolute HTTPS (fallback if needed)
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag;

    // strip any existing referrer/cors attrs
    t = t.replace(/\s(referrerpolicy|crossorigin)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

    // if no absolute http(s) src, fallback to a neutral image
    if (!/src=["']https?:\/\//i.test(t)) {
      t = `<img src="https://picsum.photos/800/450" alt=""`;
    }

    // append safe attrs right before the closing > or />
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });

  return out;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
