// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

async function loadSystemPrompt(): Promise<string> {
  const p = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
  try {
    return await readFile(p, "utf8");
  } catch {
    return "Return a complete standalone HTML5 document only (<html>…</html>) with inline <style>.";
  }
}

export async function POST(req: NextRequest) {
  try {
    // prompt from body or ?q=
    let b: any = undefined;
    try { b = await req.json(); } catch { /* ignore */ }
    const userPrompt =
      String(b?.prompt ?? b?.query ?? b?.text ?? req.nextUrl.searchParams.get("q") ?? "")
        .trim();

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Missing prompt", html: "", slug: "", rawSnippet: "" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      const msg =
        "<!doctype html><html><body><p style='font:14px/1.4 ui-sans-serif,system-ui'>OPENAI_API_KEY is not set.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userPrompt), rawSnippet: msg.slice(0, 280) }, { status: 200 });
    }

    const systemPrompt = await loadSystemPrompt();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = (choices?.[0]?.message?.content ?? "").trim();
    const pure = toPureHtml(raw);
    const hardened = addNoReferrer(pure);

    // If we somehow got nothing, surface a readable error & a snippet
    if (!hardened || !hardened.trim()) {
      return NextResponse.json(
        {
          error: "Model returned empty HTML",
          html: "",
          slug: slugify(userPrompt),
          rawSnippet: raw.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { html: hardened, slug: slugify(userPrompt), rawSnippet: raw.slice(0, 200) },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Generate API error:", err);
    return NextResponse.json(
      { error: String(err?.message || err || "Generation failed"), html: "", slug: "", rawSnippet: "" },
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
    } catch { /* ignore */ }
  }

  // Strip fenced code blocks: ```html ... ``` or ``` ... ```
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}

function addNoReferrer(html: string): string {
  let out = html || "";

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

  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });

  return out;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
