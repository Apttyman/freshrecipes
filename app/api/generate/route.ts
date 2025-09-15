import OpenAI from "openai";
import type { NextRequest } from "next/server";

// ✅ Force Node runtime (the OpenAI SDK needs Node, not Edge)
export const runtime = "nodejs";
// (Optional) give the function more time on Vercel
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are a generator of elegant recipe pages.

Take the user’s instruction as the specific recipe task (for example: "fetch 3 French desserts", "generate 7 vegan curries", "show me a single Julia Child beef bourguignon recipe"). Always treat the user’s instruction as the definitive content request.

For each recipe requested, provide:
  1. Recipe name
  2. Chef’s name and background
  3. Full, detailed description (at least 3–5 paragraphs, rich with history, culinary context, the chef’s philosophy, what makes the dish unique, and any cultural or seasonal notes)
  4. Ingredients list
  5. Step-by-step instructions
  6. Actual images sourced from the chef’s official recipe, publisher, or a reputable culinary source
     • If step-by-step photos exist at the source, embed them inline with the corresponding step
     • Every image must be wrapped in an <a> link to its source
     • Absolutely no placeholders or stock images

HTML OUTPUT REQUIREMENTS
- Return exactly one artifact: a complete, valid HTML5 document
- Must start with <!DOCTYPE html> and include <html>, <head> (with <meta charset="utf-8"> and <meta name="viewport">), embedded <style>, and <body>
- Visual design inspired by Food52:
  • Clean, modern, minimalist layout with generous whitespace
  • Soft muted color palette (off-white background, light gray dividers, warm terracotta/sage accents)
  • Large serif typography for titles, clean sans-serif for body text
  • Recipes displayed as “cards” with hover effects, separated sections for ingredients vs instructions
  • Responsive CSS grid/flex so it works beautifully on mobile (iPhone Safari) and desktop
  • Subtle card shadows for depth, thin divider lines for elegance
  • A footer with muted background and understated links
- Accessibility: alt text for every image, sufficient color contrast, semantic HTML

CONTENT RULES
- Credit chefs and sources clearly; recipe titles and images must link back to their source pages
- If real images are unavailable, skip that recipe and replace with another that has sourceable media
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

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const rsp = await client.chat.completions.create({
  model,
  temperature: 0.5,
  max_tokens: 7000,   // raise token cap for longer docs
  messages: [
    {
      role: "system",
      content: `
You are an HTML generator. 
- Always return ONE valid, complete HTML5 document.
- Begin with <!DOCTYPE html>.
- Include <html>, <head> (with <meta charset="utf-8"> and <meta name="viewport">), <style> with all CSS, and <body>.
- Never return Markdown or plain text.
- Never explain, only output the HTML file.
`,
    },
    { role: "user", content: instruction },
  ],
});

    const html = rsp.choices?.[0]?.message?.content ?? "";

    const html = rsp.choices?.[0]?.message?.content ?? "";

if (!/^<!DOCTYPE html>/i.test(html.trim())) {
  console.error("MODEL RAW OUTPUT:", html.slice(0, 200));
  return new Response(
    `Model did not return HTML. Got: ${html.slice(0, 200)}`,
    { status: 502 }
  );
}

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    // 🔎 Surface the real OpenAI error text so we can fix quickly
    let status = 500;
    let details = err?.message || "Unknown error";
    try {
      if (err?.status) status = err.status;
      const body = await err?.response?.text?.();
      if (body) details += ` | OpenAI: ${body}`;
    } catch {}
    console.error("GENERATE_ROUTE_ERROR:", details);
    return new Response(`Server error: ${details}`, { status });
  }
}

export async function GET() {
  // lets you hit /api/generate in a browser to see if the route is alive
  return new Response(JSON.stringify({ ok: true, route: "/api/generate" }), {
    headers: { "Content-Type": "application/json" },
  });
}
