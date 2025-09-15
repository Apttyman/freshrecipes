import OpenAI from "openai";
import type { NextRequest } from "next/server";

// Use Node runtime for the OpenAI SDK
export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ✅ Safe: String.raw prevents ${} interpolation / backslash escapes
const SYSTEM_PROMPT = String.raw`
You are a generator of elegant recipe pages.

Take the user's instruction as the specific recipe task (e.g., "fetch 3 French desserts", "generate 7 vegan curries", "show me a single Julia Child beef bourguignon recipe"). Always treat the user's instruction as the definitive content request.

For each recipe requested, provide:
  1) Recipe name
  2) Chef’s name and background
  3) Full, detailed description (at least 3–5 paragraphs: history, culinary context, chef’s philosophy, what makes the dish unique, cultural/seasonal notes)
  4) Ingredients list
  5) Step-by-step instructions
  6) Actual images sourced from the chef’s official recipe, publisher, or reputable culinary press
     • If step-by-step photos exist at the source, embed them inline with the corresponding step
     • Every image must be wrapped in an <a> link to its source page
     • Absolutely no placeholders or stock images. If no real image exists, skip that recipe and include another that has a real image

HTML OUTPUT REQUIREMENTS
- Return exactly one artifact: a complete, valid HTML5 document
- Must start with <!DOCTYPE html> and include <html>, <head> (with <meta charset="utf-8"> and <meta name="viewport">), embedded <style>, and <body>
- Visual design inspired by Food52:
  • Clean, modern, minimalist layout with generous whitespace
  • Soft muted color palette (off-white background, light gray dividers, warm terracotta/sage accents)
  • Large serif typography for titles, clean sans-serif for body text
  • Recipes displayed as “cards” with hover effects; clear separation of ingredients vs instructions
  • Responsive CSS grid/flex; mobile-first (iPhone Safari) and desktop
  • Subtle card shadows for depth; thin divider lines for elegance
  • Footer with muted background and understated links
- Accessibility: meaningful alt text for every image; sufficient color contrast; semantic HTML

CONTENT RULES
- Credit chefs and sources clearly; recipe titles and images must link back to their source pages
- If real images are unavailable, replace that recipe with another that has sourceable media
- Never output explanations, Markdown, or JSON — only the single complete HTML document
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
    if (instruction.length > 2000) {
      return new Response("Instruction too long (max 2000 chars).", { status: 413 });
    }

    // Keep env override; default to a widely-available model
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const rsp = await client.chat.completions.create({
      model,
      temperature: 0.45,
      max_tokens: 5000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },          // ← use YOUR full prompt
        { role: "user", content: instruction },               // ← landing page input
        { role: "user", content: "Return ONE complete HTML5 document starting with <!DOCTYPE html> and nothing else." }
      ],
    });

    let html = rsp.choices?.[0]?.message?.content?.trim() ?? "";

    // Second-chance guard if the model responded with anything non-HTML
    if (!/^<!DOCTYPE html>/i.test(html)) {
      console.warn("First response was not full HTML. Retrying…");
      const retry = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 5000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: instruction },
          { role: "user", content: "Re-emit strictly as a single, complete HTML5 document that begins with <!DOCTYPE html>." }
        ],
      });
      html = retry.choices?.[0]?.message?.content?.trim() ?? "";
    }

    if (!/^<!DOCTYPE html>/i.test(html)) {
      console.error("MODEL RAW OUTPUT (first 200):", html.slice(0, 200));
      return new Response("Model did not return a complete HTML document.", { status: 502 });
    }

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    // Surface the real OpenAI error text so you see it in the UI/logs
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
