// app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";

// Force Node runtime (OpenAI SDK needs Node)
export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * Ultra-strict system prompt:
 * - Full Food52-like HTML, mobile-first, with inline CSS (no external CSS/JS).
 * - Real images only (absolute HTTPS URLs) hot-linked and wrapped in <a href="...">.
 * - If step-by-step photos exist online, embed each image below its corresponding step.
 * - Credit chef & source; link titles & all images back to their source pages.
 * - If a recipe has NO real image available, SKIP that recipe and pick another that does.
 * - Output exactly ONE complete HTML5 document beginning with <!DOCTYPE html>.
 */
const SYSTEM_PROMPT = `
You generate a single, polished, *complete* HTML5 page from a natural-language instruction.

PRIME DIRECTIVES
1) Output exactly ONE artifact: a valid, self-contained HTML document (no Markdown, no commentary).
2) Begin with <!DOCTYPE html>. Include <html>, <head> (with <meta charset="utf-8"> and <meta name="viewport">) and <style> for all CSS.
3) Design language: Food52-like — clean grid, breathing room, muted palette (off-white bg, light-gray dividers, terracotta/sage accents), large serif display for titles, crisp sans for body, subtle shadows, responsive flex/grid.
4) Accessibility: meaningful alt text, sufficient color contrast, semantic HTML.
5) Images MUST be real, hot-linked (absolute HTTPS URLs). Every <img> must be inside an <a href="SOURCE">…</a> pointing to the page it came from.
6) If step-by-step photos exist online, embed them inline with each step. If not, still present the step cleanly (no placeholders).
7) Credit sources: link recipe titles and images to their official page or reputable coverage. No stock/placeholder images, no base64, no "image unavailable".

CONTENT SHAPE (for EACH requested recipe)
• H1: Recipe name (linked to its source)
• Subhead: Chef’s name + short bio/context (linked if appropriate)
• 3–5 paragraph description (history, cultural notes, seasonality, chef’s philosophy, what makes it unique)
• Ingredients list
• Step-by-step instructions (ordered list); if step photos exist, include an <figure><a><img/></a><figcaption/></figure> below that step
• A final “Sources & Credits” section with links

FOOTER
• Muted background, understated links, and site credits.

IMPORTANT: Use only absolute HTTPS image URLs. If you cannot find real images for a given recipe, omit that recipe and choose another that fits the user’s request.
`;

// Slug helper
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction' string in JSON body.", { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response("Missing OPENAI_API_KEY.", { status: 500 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return new Response("Missing BLOB_READ_WRITE_TOKEN.", { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1"; // set to what your account supports

    const rsp = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 7000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
    });

    const html = rsp.choices?.[0]?.message?.content?.trim() || "";

    // Hard gate: must be a full HTML doc
    if (!/^<!DOCTYPE html>/i.test(html)) {
      console.error("MODEL RAW OUTPUT (first 200):", html.slice(0, 200));
      return new Response(
        "Model did not return a complete HTML document (<!DOCTYPE html> missing).",
        { status: 502 }
      );
    }

    // Extract a title (fallback to timestamp)
    const titleMatch = html.match(/<title>([^<]{1,120})<\/title>/i)
      || html.match(/<h1[^>]*>([^<]{1,120})<\/h1>/i);
    const baseSlug = titleMatch ? slugify(titleMatch[1]) : `recipe-${Date.now()}`;
    const slug = `${baseSlug}-${Date.now()}`;

    // Save to Blob as a PUBLIC file
    const blob = await put(`recipes/${slug}.html`, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });

    // Respond JSON so the frontend can:
    // - open the hosted page
    // - update "Previous Recipes" immediately
    return new Response(
      JSON.stringify({ ok: true, url: blob.url, slug, htmlLength: html.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    let details = err?.message || "Unknown error";
    try {
      const body = await err?.response?.text?.();
      if (body) details += ` | OpenAI: ${body}`;
    } catch {}
    console.error("GENERATE_ROUTE_ERROR:", details);
    return new Response(JSON.stringify({ ok: false, error: details }), {
      status: err?.status || 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "/api/generate" }), {
    headers: { "Content-Type": "application/json" },
  });
}
