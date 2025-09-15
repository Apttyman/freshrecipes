import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Strict system prompt: do NOT compress user instruction; output ONE full HTML file only.
const SYSTEM_PROMPT = `
You generate a single, complete, downloadable HTML file from a natural-language instruction.

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

Deliverable
Return only the single HTML document, polished and accessible enough to earn a 10/10 from UX designers and art directors.
`;

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction' string in JSON body.", { status: 400 });
    }
    if (instruction.length > 2000) {
      return new Response("Instruction too long (max 2000 chars).", { status: 413 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1";

    const rsp = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 5000, // token cap you asked me to suggest
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
    });

    const html = rsp.choices?.[0]?.message?.content ?? "";

    // Hard-check: only accept full HTML docs
    if (!/^<!DOCTYPE html>/i.test(html.trim())) {
      return new Response("Model did not return a complete HTML document.", { status: 502 });
    }

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Server error generating HTML.", { status: 500 });
  }
}
