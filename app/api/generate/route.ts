// /app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Force Node runtime (OpenAI SDK needs Node, not Edge)
export const runtime = "nodejs";
export const maxDuration = 60;

// --- OpenAI ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Helpers ---
function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function extractTitle(html: string): string {
  const mTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (mTitle?.[1]) return mTitle[1].trim();
  const mH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (mH1?.[1]) return mH1[1].replace(/<[^>]+>/g, "").trim();
  return "fresh-recipes";
}

// --- System prompt (strict, image hot-linking, Food52 vibe) ---
const SYSTEM_PROMPT = `
You generate exactly ONE complete HTML5 document from a natural-language instruction.

Prime Directives
1) Use the user's instruction verbatim as the task spec. Do not compress or reinterpret it.
2) Output exactly one artifact: a valid, self-contained HTML file (no Markdown, no JSON, no commentary).
3) NO PLACEHOLDERS. Only real images from the recipe's own page, publisher, or reputable culinary press.
   - If step-by-step photos exist, embed them inline next to each step.
   - Every <img> must have an http(s) URL and wrap with <a href="SOURCE"> so the image links to its source.
   - If you cannot find real images for a recipe, SKIP that recipe and include another one that has real images.
4) Visual standard: Food52-like — clean grid, generous whitespace, muted palette (off-white bg, light-gray dividers, warm terracotta/sage accents), large serif headlines + clear sans body, elegant card shadows, responsive flex/grid.
5) Mobile-first CSS; must render well on iPhone Safari and desktop. No external CSS/JS — embed all CSS in <style>.
6) Accessibility: meaningful alt text, sufficient color contrast, semantic HTML (sections, headings, lists).
7) Credits & sourcing: clearly credit chef/site; link recipe titles and all images to sources. Avoid long verbatim copying.

File Integrity
- Must begin with <!DOCTYPE html>
- Include <html>, <head> with <meta charset="utf-8"> and <meta name="viewport" ...>, and <body>.
- Include a tasteful footer and clear separation of ingredients vs instructions.
- Provide a page title in <title> and a visible H1.

Deliverable
Return only the single HTML document, polished enough to earn a 10/10 from UX designers and art directors.
`;

// --- API: POST /api/generate ---
export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();

    // Basic input/env validation
    if (!instruction || typeof instruction !== "string") {
      return NextResponse.json(
        { error: "Missing 'instruction' string in JSON body." },
        { status: 400 },
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing in the deployment environment." },
        { status: 500 },
      );
    }
    if (instruction.length > 2000) {
      return NextResponse.json(
        { error: "Instruction too long (max 2000 chars)." },
        { status: 413 },
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";

    // Ask the model for ONE complete HTML document
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
    const trimmed = html.trim();

    // Hard check: only accept complete HTML docs
    if (!/^<!DOCTYPE html>/i.test(trimmed)) {
      console.error("MODEL RAW OUTPUT (first 200):", trimmed.slice(0, 200));
      return NextResponse.json(
        {
          error:
            "Model did not return a complete HTML document. Try again with a more specific instruction.",
          sample: trimmed.slice(0, 200),
        },
        { status: 502 },
      );
    }

    // Derive a nice filename
    const title = extractTitle(trimmed);
    const ts = new Date();
    const stamp =
      ts.toISOString().replace(/[:.]/g, "-").slice(0, 19) /* YYYY-MM-DDTHH-MM-SS */;
    const fileKey = `recipes/${stamp}-${slugify(title)}.html`;

    // Save to Vercel Blob as a PUBLIC file
    const blob = await put(fileKey, trimmed, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN, // optional on Vercel; safe to include if you added it
      addRandomSuffix: false, // keep the key deterministic for archive
      cacheControl: "public, max-age=31536000, immutable",
    });

    // Return the permanent URL + some metadata
    return NextResponse.json(
      {
        ok: true,
        title,
        key: blob.pathname || fileKey,
        url: blob.url, // open this directly to view the page online
      },
      { status: 200 },
    );
  } catch (err: any) {
    // Surface real errors to speed up debugging
    let status = err?.status || 500;
    let details = err?.message || "Unknown error";
    try {
      const body = await err?.response?.text?.();
      if (body) details += ` | Upstream: ${body}`;
    } catch {}
    console.error("GENERATE_ROUTE_ERROR:", details);
    return NextResponse.json({ error: details }, { status });
  }
}

// --- API: GET /api/generate (simple health check) ---
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/generate" });
}
