// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

// ---------- POST ----------
export async function POST(req: NextRequest) {
  try {
    // read system prompt from repo
    const sysPath = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
    const systemPrompt = await readFile(sysPath, "utf8");

    // accept prompt from body or query
    let bodyPrompt: string | undefined;
    try {
      const b = (await req.json()) as any;
      bodyPrompt = b?.prompt ?? b?.query ?? b?.text;
    } catch { /* body may be empty */ }
    const qPrompt = req.nextUrl.searchParams.get("q") ?? undefined;

    const userPrompt = (bodyPrompt ?? qPrompt ?? "").trim();
    if (!userPrompt) {
      return NextResponse.json({ error: "Missing prompt", html: "", slug: "" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const msg = "<!doctype html><html><body><p>OPENAI_API_KEY is not set.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userPrompt) }, { status: 200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages,
    });

    const raw = (resp.choices[0]?.message?.content ?? "").trim();

    // sanitize & enhance the HTML
    const pure = toPureHtml(raw);
    const withImage = ensureAtLeastOneImage(pure);
    const withNoreferrer = addNoReferrer(withImage);
    const proxied = rewriteImagesToProxy(withNoreferrer); // <-- swap <img src> to /api/img?u=...

    return NextResponse.json({ html: proxied, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}

/* ---------------- helpers ---------------- */

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // allow { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch { /* ignore */ }
  }

  // strip ```html ... ``` or ``` ... ```
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}

/** If there are no <img>, add a neutral hero so the layout always has an image. */
function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;

  const hero =
    `<img src="https://picsum.photos/1200/630" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" />`;

  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  return `${hero}\n${html}`;
}

/** Add meta no-referrer and per-IMG attributes. */
function addNoReferrer(html: string): string {
  let out = html || "";

  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }

  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });

  return out;
}

/** Rewrite every IMG src to go through our proxy (/api/img), leaving data: and already-proxied URLs intact. */
function rewriteImagesToProxy(html: string): string {
  return (html || "").replace(/<img\b([^>]*?)\bsrc\s*=\s*(['"])(.*?)\2/gi, (_m, pre, q, src) => {
    try {
      if (/^\/api\/img\?u=/.test(src) || /^data:/i.test(src)) return _m; // already safe
      const abs = new URL(src, "https://placeholder.invalid/");
      if (!/^https?:$/i.test(abs.protocol)) return _m; // skip non-http(s)

      const proxied = `/api/img?u=${encodeURIComponent(src)}`;
      return `<img${pre}src=${q}${proxied}${q}`;
    } catch {
      return _m;
    }
  });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
