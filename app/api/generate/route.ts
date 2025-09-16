// app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE || undefined,
});

const MODEL =
  (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim()) ||
  "gpt-4o-mini";

// Load your prompt exactly as written (env overrides file if set)
const PROMPT_PATH = join(process.cwd(), "app", "prompt", "system-prompt.txt");
function loadSystemPrompt(): string {
  const envOverride = process.env.RECIPE_SYSTEM_PROMPT?.trim();
  if (envOverride) return envOverride;
  try {
    return readFileSync(PROMPT_PATH, "utf8");
  } catch {
    return "";
  }
}

// post-process: proxy all image URLs through /api/img
function proxyImages(html: string, origin: string) {
  // Replace src="http..."; tolerate single/double/no quotes
  return html.replace(
    /(<img\b[^>]*\bsrc=)(['"]?)(https?:\/\/[^'">\s)]+)(\2)/gi,
    (_m, pre, q, url, q2) => `${pre}${q}${origin}/api/img?u=${encodeURIComponent(url)}${q2}`
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY missing", { status: 500 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const instruction = (body?.instruction ?? "").toString().trim();
    if (!instruction) {
      return new Response("Missing 'instruction' string", { status: 400 });
    }

    const SYSTEM_PROMPT = loadSystemPrompt();
    if (!SYSTEM_PROMPT) {
      return new Response("System prompt not found", { status: 500 });
    }

    // IMPORTANT: No response_format=json here — we want rich HTML output.
    const ai = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
      temperature: 0.2,
      // allow enough room for 3–5 recipes w/ multi-paragraph descriptions + CSS
      max_tokens: 6000,
    });

    const raw = ai.choices?.[0]?.message?.content ?? "";
    if (!raw || !raw.trim()) {
      return new Response("Empty completion", { status: 502 });
    }

    // Ensure it’s an HTML document (your prompt already asks for a full file)
    let html = raw.trim();
    const origin = req.nextUrl.origin;

    // Safety: strip any accidental code fences
    if (html.startsWith("```")) {
      html = html.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }

    // Proxy images so they’re reliable from third-party hosts
    html = proxyImages(html, origin);

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("generate error", err);
    return new Response("Internal error", { status: 500 });
  }
}
