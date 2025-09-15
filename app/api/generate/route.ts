import OpenAI from "openai";
import type { NextRequest } from "next/server";

// Force Node runtime for the OpenAI SDK
export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * Style + behavior contract:
 * - Food52-inspired layout and typography, card grid, muted palette, hover shadows,
 *   responsive mobile-first CSS, good contrast and alt text — consistent with the sample
 *   page we’re emulating.
 * - NO placeholders. Every <img> must be a hotlink to a real image on the recipe’s source
 *   (or widely recognized culinary press covering that exact recipe), and wrapped in <a href="...">.
 * - If step-by-step photos exist on the source, embed them near the matching step.
 * - If a candidate recipe lacks a real image, SKIP it and pick another that has one.
 * - Output ONE self-contained HTML file only (no markdown fences, no JSON, no commentary).
 */
const SYSTEM_PROMPT = String.raw`
You are a generator of elegant recipe pages.

Use the user's instruction verbatim as the task (e.g., "fetch 3 French desserts", "generate 7 vegan curries", "one ice cream recipe by a famous chef"). Treat it as definitive.

For each recipe:
  1) Recipe name
  2) Chef’s name + short background
  3) A rich 3–5 paragraph description (history, context, chef’s philosophy, what makes it unique, seasonal/cultural notes)
  4) Ingredients list
  5) Step-by-step instructions
  6) Real images only, hot-linked from the recipe’s official source or reputable coverage of the same recipe:
     • Every <img> MUST be wrapped by an <a> that links to its source page
     • If step photos exist, place them adjacent to the corresponding step
     • Absolutely NO placeholders, data URLs, or generic stock. If an image is unavailable, replace that recipe with one that has a real image

HTML OUTPUT REQUIREMENTS
- Return exactly one complete, valid HTML5 document
- Begin with <!DOCTYPE html> and include <html>, <head> (with <meta charset="utf-8"> and <meta name="viewport">), and embedded <style>; no external CSS/JS
- Visual identity inspired by Food52: clean modern grid; generous whitespace; soft muted palette (off-white bg, light-gray dividers, warm terracotta/sage accents); large serif headlines & clean sans body; subtle shadows on cards; divider lines; tasteful footer; responsive CSS grid/flex (mobile-first)
- Accessibility: meaningful alt text on every image; sufficient color contrast; semantic HTML

CONTENT RULES
- Credit chefs and sources clearly; recipe titles and images MUST link to their source pages
- If you cannot verify real images for a candidate, skip it and include another
- Never output explanations, Markdown, or JSON — only the single HTML document
`;

/** Utilities */
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);
}

async function persistToBlob(html: string, instruction: string) {
  // Optional persistence to Vercel Blob (recommended)
  // 1) Enable Vercel Blob on your project
  // 2) Create env var BLOB_READ_WRITE_TOKEN (Permissions: Read & Write)
  // 3) npm i @vercel/blob
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return null;

    const { put } = await import("@vercel/blob");
    const slug = `${slugify(instruction)}-${Date.now()}`;
    const path = `recipes/${slug}.html`;

    const { url } = await put(path, html, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/html; charset=utf-8",
      token,
    });

    // Maintain a simple public index for “Previous Recipes”
    // Stored at recipes/index.json as an array of { url, slug, title, ts }
    try {
      const indexPath = "recipes/index.json";
      const res = await fetch(
        `https://api.vercel.com/v2/blobs/get?url=${encodeURIComponent(
          `https://${process.env.VERCEL_BLOB_STORAGE_HOST || "blob.vercel-storage.com"}/${indexPath}`
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let list: any[] = [];
      if (res.ok) {
        const curr = await res.json().catch(() => null);
        if (Array.isArray(curr)) list = curr;
      }
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch?.[1] || instruction;
      list.unshift({ url, slug, title, ts: Date.now() });

      await put(indexPath, JSON.stringify(list, null, 2), {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json; charset=utf-8",
        token,
      });
    } catch {
      /* non-fatal */
    }

    return { url };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction' string in JSON body.", { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY missing in environment.", { status: 500 });
    }
    if (instruction.length > 2000) {
      return new Response("Instruction too long (max 2000 chars).", { status: 413 });
    }

    // Allow override via env; default to a widely available model
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // First pass
    let rsp = await client.chat.completions.create({
      model,
      temperature: 0.45,
      max_tokens: 5200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "Generate the page now. Output ONE complete HTML5 document that begins with <!DOCTYPE html> and includes embedded <style>.",
        },
        { role: "user", content: instruction },
      ],
    });

    let html = rsp.choices?.[0]?.message?.content?.trim() ?? "";

    // Guardrails: must be a full HTML document and must not contain obvious placeholders
    const isHTML = /^<!DOCTYPE html>/i.test(html);
    const hasPlaceholders =
      /placeholder|lorem\s+ipsum|example\.com|data:image\/|src=["']#|alt=["']\s*["']/i.test(html);

    if (!isHTML || hasPlaceholders) {
      // One retry with very strict directions
      rsp = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 5200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `
Your previous output was rejected because it was not a single full HTML file and/or contained placeholders. 
Re-emit STRICTLY one valid HTML5 document that:
- starts with <!DOCTYPE html>
- contains only hot-linked real images (<a><img/></a>) from the recipe's source
- contains NO placeholders, NO base64 data URLs, NO example.com links
- matches the Food52-inspired style and typography
- preserves all accessibility requirements and credits
`,
          },
          { role: "user", content: instruction },
        ],
      });
      html = rsp.choices?.[0]?.message?.content?.trim() ?? "";
    }

    if (!/^<!DOCTYPE html>/i.test(html)) {
      console.error("MODEL RAW OUTPUT (first 200):", html.slice(0, 200));
      return new Response("Model did not return a complete HTML document.", { status: 502 });
    }

    // Persist to Blob (if configured) so the “Open” button can navigate to a hosted page
    const saved = await persistToBlob(html, instruction);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Frontend can read this to populate “Previous Recipes” and “Open” buttons
        ...(saved ? { "X-Recipe-URL": saved.url } : {}),
      },
    });
  } catch (err: any) {
    let status = err?.status || err?.response?.status || 500;
    let details = err?.message || "Unknown error";
    try {
      const body = await err?.response?.text?.();
      if (body) details += ` | OpenAI: ${body}`;
    } catch {}
    console.error("GENERATE_ROUTE_ERROR:", details);
    return new Response(`Server error: ${details}`, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "/api/generate" }), {
    headers: { "Content-Type": "application/json" },
  });
}
