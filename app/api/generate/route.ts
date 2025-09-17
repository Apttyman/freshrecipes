// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
    const userPrompt = (prompt && prompt.trim()) || "Two dog recipes";

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const sys = [
      "You are a chef + food editor.",
      "Return ONLY a complete standalone HTML5 document (<html>…</html>) with inline <style>.",
      "Use elegant, modern CSS (no frameworks).",
      // The model can try, but we'll enforce in post-process too.
      "All <img> tags SHOULD include referrerpolicy=\"no-referrer\" and crossorigin=\"anonymous\".",
      "Do NOT fetch external CSS/JS; keep everything inline.",
      "Document must be visually polished and readable on mobile and desktop."
    ].join(" ");

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content:
            `Create a beautiful recipe page for: ${userPrompt}.
             Include a hero image and at least 2 recipe sections with ingredients and steps.
             Use headings, cards, and a tasteful color palette.`
        }
      ]
    });

    const raw = (choices[0]?.message?.content ?? "").trim();
    const baseHtml = raw.includes("<html") ? raw : wrapAsHtml(raw, userPrompt);

    // 🔧 Enforce no-referrer across the entire document (images + meta)
    const html = enforceNoReferrer(baseHtml);

    const slug = slugify(userPrompt);
    return NextResponse.json({ html, slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) || "Generation failed" },
      { status: 500 }
    );
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Ensures:
 *  - every <img ...> has referrerpolicy="no-referrer" and crossorigin="anonymous"
 *  - <meta name="referrer" content="no-referrer"> is present in <head>
 */
function enforceNoReferrer(html: string): string {
  let out = html;

  // 1) Inject/ensure meta in <head>
  const hasHead = /<head[^>]*>/i.test(out);
  const metaTag = `<meta name="referrer" content="no-referrer">`;
  if (hasHead) {
    if (!/<!--\s*referrer-meta\s*-->/.test(out) && !/name=["']referrer["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${metaTag}`);
    }
  } else {
    // no <head> — inject one at the top of document
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${metaTag}\n</head>`);
    if (out === html) {
      // Still no match? Prepend a minimal head.
      out = `<head>\n${metaTag}\n</head>\n` + out;
    }
  }

  // 2) Rewrite all <img> tags
  out = out.replace(/<img\b[^>]*>/gi, (tag) => rewriteImgTag(tag));

  return out;
}

function rewriteImgTag(tag: string): string {
  let t = tag;

  // Drop any existing referrerpolicy/crossorigin to avoid duplicates
  t = t.replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
  t = t.replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  // Ensure a trailing space before '>'
  t = t.replace(/>$/, " >");

  // Inject the attributes just before '>'
  t = t.replace(/>$/, ` referrerpolicy="no-referrer" crossorigin="anonymous">`);

  // Tidy up spaces
  t = t.replace(/\s{2,}/g, " ");

  return t;
}

function wrapAsHtml(content: string, title: string) {
  const esc = (x: string) =>
    x.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
  const css = `
    :root{--fg:#0f172a;--muted:#475569;--ring:#e2e8f0;--bg:#fff}
    *{box-sizing:border-box} body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:var(--fg);background:var(--bg);line-height:1.6}
    .wrap{max-width:760px;margin:0 auto;padding:24px}
    h1{font-size:30px;letter-spacing:-0.02em;margin:0 0 12px}
    p.lead{color:var(--muted);margin:0 0 16px}
    .card{border:1px solid var(--ring);border-radius:12px;padding:16px;margin:16px 0}
    img{width:100%;height:auto;border-radius:10px;display:block}
    a.btn{display:inline-block;border:1px solid var(--ring);padding:8px 12px;border-radius:10px;text-decoration:none;color:inherit}
    a.btn:hover{background:#f8fafc}
    pre{white-space:pre-wrap}
  `;
  return `<!doctype html><html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body><div class="wrap">
<header><h1>${esc(title)}</h1><p class="lead">Generated content</p></header>
<article class="card"><pre>${esc(content)}</pre></article>
<footer><a class="btn" href="/archive">Back to Archive</a></footer>
</div></body></html>`;
}
