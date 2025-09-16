// app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";

// ✅ Force Node runtime (OpenAI SDK needs Node, not Edge)
export const runtime = "nodejs";
// (Optional) allow longer time on Vercel
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * YOUR STRICT SYSTEM PROMPT — sent to the model verbatim.
 * (No second inline system message that overrides this.)
 */
const SYSTEM_PROMPT = `
You generate one single, complete, downloadable HTML file from a natural-language instruction.

Prime Directives
1) Do not compress, summarize, or reinterpret the user's instruction; use it verbatim as the task spec.
2) Output exactly one artifact: a fully valid, self-contained HTML document (no Markdown fences, no JSON, no extra commentary).
3) No placeholders: use only real images from the referenced recipe source or reputable coverage; each image hyperlinks to its source page.
4) If step-by-step photos exist at the source, embed them next to the corresponding steps and link each to its source.
5) Visual standard: Food52-like—clean grid, generous whitespace, muted palette (off-white bg, light-gray dividers, warm terracotta/sage accents), large serif headlines + clear sans body, elegant card shadows, responsive flex/grid.
6) Mobile-first CSS; must render well on iPhone Safari and desktop browsers.
7) Credits & sourcing: clearly credit chef/site; link recipe titles and images to sources. Avoid long verbatim copying from sources.
8) File integrity: include <!DOCTYPE html>, <html>, proper <head> with meta viewport, embedded <style> (no external CSS/JS), and <body>.
9) Accessibility: meaningful alt text on all images; adequate color contrast; semantic HTML.

Required Content For Each Recipe (driven by the user's instruction — number/type is variable)
  1. Recipe name
  2. Chef’s name and background
  3. Full, detailed description (3–5+ paragraphs: history, context, chef’s philosophy, what makes it unique, cultural/seasonal notes)
  4. Ingredients list
  5. Step-by-step instructions
  6. Real image URLs of the dish and steps (from the chef’s own recipe page, official publisher, or reputable culinary press)
     • If step images exist on the source, embed them at the correct step.
     • Every image must be wrapped with <a href="SOURCE_URL"> so clicking the image opens the source.
     • Absolutely no placeholder or stock images. If no real images exist for a recipe, skip that recipe and choose another with real images.

HTML OUTPUT REQUIREMENTS
- Return exactly one HTML5 document ONLY.
- Start with <!DOCTYPE html>. Include <html>, <head> (with <meta charset="utf-8"> and <meta name="viewport">), embedded <style>, and <body>.
- Design: Food52-inspired—clean, minimalist, muted palette (off-white bg, light-gray dividers, warm terracotta/sage accents), big serif titles, clean sans body, recipe “cards” with hover, clear sections, responsive CSS grid/flex, subtle shadows, thin dividers, tasteful footer.
- Accessibility: alt text for EVERY image, sufficient color contrast, semantic HTML (use <article>, <section>, <h1>…).

Return only the single HTML document, polished enough to earn a 10/10 from UX designers and art directors.
`;

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction' string in JSON body.", { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY is missing in the deployment env.", { status: 500 });
    }
    if (instruction.length > 4000) {
      return new Response("Instruction too long (max ~4000 chars).", { status: 413 });
    }

    // Let you override in Vercel env if you want (e.g., gpt-5)
    const model = process.env.OPENAI_MODEL || "gpt-4.1";

    // 🔴 IMPORTANT: we actually use SYSTEM_PROMPT here. No second system message.
    const rsp = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 7000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
    });

    const html = rsp.choices?.[0]?.message?.content ?? "";

    // Hard-check: only accept full HTML docs
    const trimmed = html.trim();
    if (!/^<!DOCTYPE html>/i.test(trimmed) || !/<html[\s>]/i.test(trimmed)) {
      // Surface first chunk to help diagnose if the model deviated
      console.error("MODEL RAW OUTPUT (head):", trimmed.slice(0, 400));
      return new Response("Model did not return a complete HTML document.", { status: 502 });
    }

    // Save to Blob as a public HTML page so you can link to it
    const slug = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `recipes/${slug}.html`;

    const { url: blobUrl } = await put(filename, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      // token: process.env.BLOB_READ_WRITE_TOKEN, // optional; SDK reads env automatically
    });

    // JSON for your UI: preview + public page URL
    return new Response(
      JSON.stringify({
        ok: true,
        previewHtml: html, // iframe live preview
        blobUrl,           // direct public URL
        pageUrl: blobUrl,  // alias used by your client
        filename,          // shown in UI
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Bubble up real OpenAI error text if present
    let status = err?.status || 500;
    let details = err?.message || "Server error";
    try {
      const body = await err?.response?.text?.();
      if (body) details += ` | OpenAI: ${body}`;
    } catch {}
    console.error("GENERATE_ROUTE_ERROR:", details);
    return new Response(JSON.stringify({ ok: false, error: details }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET() {
  // lets you hit /api/generate in a browser to see if the route is alive
  return new Response(JSON.stringify({ ok: true, route: "/api/generate" }), {
    headers: { "Content-Type": "application/json" },
  });
}
