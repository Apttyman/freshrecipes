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

// Load your system prompt exactly as written (env overrides file if set)
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

// Proxy any external image URL via /api/img
function proxyImages(html: string, origin: string) {
  return html.replace(
    /(<img\b[^>]*\bsrc=)(['"]?)(https?:\/\/[^'">\s)]+)(\2)/gi,
    (_m, pre, q, url, q2) =>
      `${pre}${q}${origin}/api/img?u=${encodeURIComponent(url)}${q2}`
  );
}

// If there are no <img>, inject a decent fallback (still proxied)
function ensureAtLeastOneImage(html: string, origin: string, instruction: string) {
  if (/<img\b/i.test(html)) return html;
  const query = encodeURIComponent(
    instruction.replace(/\s+/g, " ").trim() || "food"
  );
  const src = `${origin}/api/img?u=${encodeURIComponent(
    `https://source.unsplash.com/1200x800/?${query}`
  )}`;
  const injected = `<figure style="margin:24px 0;"><img src="${src}" alt="Dish image" style="width:100%;height:auto;border-radius:12px;display:block;object-fit:cover"/></figure>`;
  // try to place after first H1 or at top of <body>
  if (/<h1[^>]*>/i.test(html)) {
    return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${injected}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${injected}`);
  }
  return injected + html;
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

    // IMPORTANT: return rich HTML, not JSON
    const ai = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
      temperature: 0.2,
      max_tokens: 6000,
    });

    let html = ai.choices?.[0]?.message?.content?.trim() ?? "";
    if (!html) return new Response("Empty completion", { status: 502 });

    // strip accidental fences
    if (html.startsWith("```")) {
      html = html.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }

    const origin = req.nextUrl.origin;
    html = proxyImages(html, origin);
    html = ensureAtLeastOneImage(html, origin, instruction);

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("generate error", err);
    return new Response("Internal error", { status: 500 });
  }
}
