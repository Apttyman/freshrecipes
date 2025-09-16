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

/**
 * Proxy a single absolute image URL through /api/img with a best-effort Referer (&p=).
 * - Skips if already pointing at /api/img
 * - Guesses referer as the image origin (https://host/)
 */
function makeProxy(url: string, origin: string): string {
  try {
    if (!/^https?:\/\//i.test(url)) return url; // only handle absolute http(s)
    const u = new URL(url);
    // Already proxied? leave as-is
    if (u.pathname.startsWith("/api/img") || /\/api\/img/i.test(u.pathname)) return url;
    const refererGuess = `${u.origin}/`;
    return `${origin}/api/img?u=${encodeURIComponent(u.href)}&p=${encodeURIComponent(refererGuess)}`;
  } catch {
    return url;
  }
}

/**
 * Rewrites all <img src=...> and srcset=... entries to go through /api/img
 * - Handles single/double/no quotes around src
 * - Handles multiple candidates in srcset
 */
function proxyImages(html: string, origin: string) {
  // 1) src attributes
  const withSrc = html.replace(
    /(<img\b[^>]*\bsrc=)(['"]?)(https?:\/\/[^'">\s)]+)(\2)/gi,
    (_m, pre, q, url, q2) => `${pre}${q}${makeProxy(url, origin)}${q2}`
  );

  // 2) srcset attributes (comma-separated list of URLs with descriptors)
  const withSrcset = withSrc.replace(
    /(<img\b[^>]*\bsrcset=)(['"])([^'"]+)\2/gi,
    (_m, pre, q, list) => {
      const rewritten = list
        .split(",")
        .map(part => {
          const seg = part.trim();
          if (!seg) return seg;
          const [u, desc] = seg.split(/\s+/, 2);
          const proxied = makeProxy(u, origin);
          return desc ? `${proxied} ${desc}` : proxied;
        })
        .join(", ");
      return `${pre}${q}${rewritten}${q}`;
    }
  );

  return withSrcset;
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

    // IMPORTANT: We want rich, full HTML—NO JSON mode here.
    const ai = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
      temperature: 0.2,
      // Room for multi-recipe, multi-paragraph, CSS-styled output
      max_tokens: 6000,
    });

    let html = ai.choices?.[0]?.message?.content ?? "";
    if (!html || !html.trim()) {
      return new Response("Empty completion", { status: 502 });
    }

    html = html.trim();

    // Safety: strip accidental code fences
    if (html.startsWith("```")) {
      html = html.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }

    // Proxy images so they’re reliable from third-party hosts (with &p= referer guess)
    const origin = req.nextUrl.origin;
    html = proxyImages(html, origin);

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("generate error", err);
    return new Response("Internal error", { status: 500 });
  }
}
