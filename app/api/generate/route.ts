// app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE || undefined,
});

// Prefer env, fall back to a fast JSON-capable model
const MODEL =
  (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim()) ||
  "gpt-4o-mini";

/**
 * Keep the system prompt in the route (per requirement #7)
 */
const SYSTEM_PROMPT = `
You return structured JSON (not HTML) for recipes, with real, hotlinkable photo URLs and source links.
Return an object {"recipes": Recipe[]} where Recipe = {
  "title": string,
  "description": string,
  "image": string,            // absolute URL to a real image on the open web
  "source": string,           // canonical page for the recipe
  "ingredients": string[],
  "steps": string[]
}
Rules:
- No placeholder or stock images. Use only images that depict the final dish.
- Prefer official/authoritative sources (chef sites, major food pubs).
- Titles should be concise (<= 100 chars).
- Steps should be actionable and numbered in the data array order.
- Absolutely return valid JSON. Do not include markdown fences.
`;

/** Image verification with timeout and HEAD→GET fallback */
async function verifyUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);

    // Some hosts block HEAD; try HEAD then tiny GET
    let res = await fetch(url, { method: "HEAD", signal: ctl.signal });
    if (!res.ok) {
      res = await fetch(url, {
        headers: { Range: "bytes=0-0" },
        signal: ctl.signal,
      });
    }

    clearTimeout(timer);
    if (!res || !res.ok) return false;

    const ct = res.headers.get("content-type") || "";
    return (
      ct.includes("image") ||
      /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url)
    );
  } catch {
    return false;
  }
}

/** Verify/Proxy all recipe images concurrently, non-fatal on failures */
async function verifyAllImages(recipes: any[], origin: string) {
  const MAX_CONCURRENCY = 6;
  const idxs = [...recipes.keys()];

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, idxs.length) },
    async () => {
      while (idxs.length) {
        const i = idxs.shift()!;
        const r = recipes[i] || {};
        const url = r.image;
        if (typeof url === "string" && url.length > 0) {
          const ok = await verifyUrl(url, 5000);
          if (ok) {
            r.image = `${origin}/api/img?u=${encodeURIComponent(url)}`;
          } else {
            // Don’t fail the whole response—just drop the image
            delete r.image;
          }
        }
      }
    }
  );

  await Promise.allSettled(workers);
  // If your UI requires images, filter here; otherwise keep all with titles
  return recipes.filter((r) => !!r.title);
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY missing", { status: 500 });
    }
    if (!MODEL) {
      return new Response("OpenAI model not configured", { status: 500 });
    }

    const { instruction } = await req.json();
    const prompt = (instruction || "").toString().trim();
    if (!prompt || typeof prompt !== "string") {
      return new Response("Missing 'instruction' string", { status: 400 });
    }
    if (prompt.length > 2000) {
      return new Response("Instruction too long (max 2000 chars)", {
        status: 400,
      });
    }

    const ai = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" as const },
    });

    const txt = ai.choices?.[0]?.message?.content ?? "{}";
    let data: any = {};
    try {
      data = JSON.parse(txt);
    } catch {
      return new Response("Model did not return valid JSON", { status: 502 });
    }

    if (!Array.isArray(data.recipes)) data.recipes = [];
    // Normalize to avoid downstream crashes
    data.recipes = data.recipes
      .map((r: any) => ({
        title: String(r?.title ?? "").slice(0, 200),
        image: r?.image ?? "",
        source: r?.source ?? "",
        description: r?.description ?? "",
        ingredients: Array.isArray(r?.ingredients) ? r.ingredients : [],
        steps: Array.isArray(r?.steps) ? r.steps : [],
      }))
      .filter((r: any) => r.title);

    const origin = req.nextUrl.origin;
    data.recipes = await verifyAllImages(data.recipes, origin);

    return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("generate error", e);
    return new Response("Internal error", { status: 500 });
  }
}
