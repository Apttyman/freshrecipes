// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

// --- tiny util to load your system prompt file ---
async function loadSystemPrompt(): Promise<string> {
  // absolute path so it works on Vercel too
  const p = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
  try {
    return await readFile(p, "utf8");
  } catch {
    // fallback: small system hint if file missing
    return "Return a complete standalone HTML5 document only (<html>…</html>) with inline <style>.";
  }
}

export async function POST(req: NextRequest) {
  try {
    // Accept prompt from body or query (backwards compatible)
    let bodyPrompt: string | undefined;
    try {
      const body = (await req.json()) as any;
      bodyPrompt = body?.prompt ?? body?.query ?? body?.text;
    } catch {
      /* body may be empty */
    }
    const queryPrompt = req.nextUrl.searchParams.get("q") ?? undefined;
    const userPrompt = (bodyPrompt ?? queryPrompt ?? "").trim();

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

    const raw = (choices[0]?.message?.content ?? "").trim();
    const pure = toPureHtml(raw);
    const hardened = addNoReferrer(pure);

    return NextResponse.json(
      { html: hardened, slug: slugify(userPrompt) },
      { status: 200 }
    );
  } catch (err: any) {
    // === DEBUG: you’ll see this in Vercel function logs ===
    console.error("Generate API error:", err);
    return NextResponse.json(
      {
        error: String(err?.message || err || "Generation failed"),
        html: "",
        slug: "",
      },
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

function addNoReferrer(html: string): string {
  let out = html || "";

  // Ensure a meta referrer in <head>
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

  // Add referrerpolicy/crossorigin to every <img>
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
