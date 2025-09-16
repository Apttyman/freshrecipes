// app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You return structured JSON (not HTML) for recipes, with real, hotlinkable photo URLs and source links.
Follow this exact schema:

{
  "recipes": [
    {
      "id": "string-unique",
      "name": "Recipe title",
      "chef": "Chef name and short background",
      "description": ["paragraph 1", "paragraph 2", "paragraph 3+"],
      "ingredients": ["..."],
      "steps": [
        { "text": "Step text", "image": "https://...", "source": "https://source-page-for-this-photo" }
      ],
      "sourceUrl": "https://source-recipe-page",
      "images": [
        { "url": "https://...", "alt": "meaningful alt", "source": "https://source-recipe-page-or-photo-page" }
      ]
    }
  ]
}

Rules:
- Use real recipe sources from chefs, publishers, or reputable press; never invent URLs.
- Prefer official or well-established sources (e.g., publisher CDNs, chef sites). Avoid "placeholder", "stock", "example", "unsplash", "lorem", "dummy" images.
- If a step photo exists at the source, include it with its source URL; otherwise omit the step image (do NOT invent).
- The 'source' for each image must be a clickable page that contains that photo or the recipe.
- The JSON must be valid and parseable. No extra commentary.
`;

function isHttpUrl(u?: string) {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikePlaceholder(u: string) {
  const s = u.toLowerCase();
  return (
    s.includes("placeholder") ||
    s.includes("dummy") ||
    s.includes("lorem") ||
    s.includes("example.com") ||
    s.includes("unsplash") || // you said no stock
    s.includes("via.placeholder") ||
    s.endsWith(".svg")
  );
}

async function isGoodImage(url: string, referer: string): Promise<boolean> {
  if (!isHttpUrl(url) || looksLikePlaceholder(url)) return false;

  // HEAD can be blocked, so do a lightweight GET and only read headers
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);

  try {
    const rsp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FreshRecipesBot/1.0; +https://freshrecipes.io)",
        Referer: referer,
        Accept: "image/*,*/*;q=0.8",
        Range: "bytes=0-0", // ask for first byte only; many servers still return headers + small payload
      },
    });

    if (!rsp.ok) return false;
    const ct = rsp.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return false;

    // If server ignored Range and sent full body, that's okay — we didn't read it.
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function proxy(url: string, origin: string) {
  const u = new URL("/api/img", origin);
  u.searchParams.set("u", url);
  return u.toString();
}

async function verifyAllImages(recipes: any[], origin: string) {
  const referer = origin + "/";
  for (const r of recipes || []) {
    // Top images
    if (Array.isArray(r.images)) {
      const out: any[] = [];
      for (const im of r.images) {
        if (im?.url && (await isGoodImage(im.url, referer))) {
          out.push({ ...im, url: proxy(im.url, origin) });
        }
      }
      r.images = out;
    }

    // Step images
    if (Array.isArray(r.steps)) {
      r.steps = await Promise.all(
        r.steps.map(async (st: any) => {
          if (st?.image && (await isGoodImage(st.image, referer))) {
            return { ...st, image: proxy(st.image, origin) };
          }
          const { image, ...rest } = st || {};
          return rest; // drop bad image, keep text/source
        })
      );
    }
  }
  return recipes;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY missing", { status: 500 });
    }

    const { instruction } = await req.json();
    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction' string", { status: 400 });
    }
    if (instruction.length > 2000) {
      return new Response("Instruction too long (max 2000)", { status: 413 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1"; // set to your preferred model

    const ai = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "User request (variable; do NOT hardcode '5 pasta'): " +
            instruction,
        },
      ],
      response_format: { type: "json_object" as const },
    });

    const txt = ai.choices?.[0]?.message?.content || "{}";
    let data: any;
    try {
      data = JSON.parse(txt);
    } catch {
      return new Response("Model did not return valid JSON", { status: 502 });
    }

    // Ensure structure exists
    if (!Array.isArray(data.recipes)) data.recipes = [];

    // Verify all images and proxy them
    const origin = req.nextUrl.origin;
    data.recipes = await verifyAllImages(data.recipes, origin);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    let status = err?.status || 500;
    let msg = err?.message || "Server error";
    try {
      const body = await err?.response?.text?.();
      if (body) msg += ` | OpenAI: ${body}`;
    } catch {}
    console.error("GENERATE_ERROR:", msg);
    return new Response(msg, { status });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
