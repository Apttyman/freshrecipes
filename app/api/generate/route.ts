// app/api/generate/route.ts
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob"; // already set up earlier

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function rewriteImages(html: string) {
  // 1) force https absolute URLs
  // 2) wrap every src with our proxy: /api/img?u=<encoded>
  // 3) drop obvious placeholders
  return html.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
    (_m, pre, src, post) => {
      // ignore data: and empty
      if (!src || src.startsWith("data:")) return "";

      // reject obvious placeholders/blank gifs
      const lower = src.toLowerCase();
      const looksLikePlaceholder =
        lower.includes("placeholder") ||
        lower.includes("blank") ||
        lower.includes("spacer") ||
        lower.endsWith(".svg") && lower.includes("placeholder");

      if (looksLikePlaceholder) return "";

      // ensure absolute https
      let final = src.trim();
      if (final.startsWith("//")) final = "https:" + final;
      if (final.startsWith("http://")) final = "https://" + final.slice(7);
      if (!(final.startsWith("https://"))) {
        // relative paths will not work—drop the tag rather than breaking layout
        return "";
      }

      const proxied = `/api/img?u=${encodeURIComponent(final)}`;
      // always include alt for a11y
      if (!/alt=/.test(pre + post)) {
        post = ` alt="" ${post}`;
      }
      return `<img ${pre}src="${proxied}"${post}>`;
    }
  );
}

const SYSTEM_PROMPT = `
You are a generator of elegant recipe pages.

Use the user's instruction literally. For each recipe: name, chef+background, 3–5 paragraph context, ingredients, step-by-step instructions.
Strict image rules:
- Only use real images that exist online.
- Use absolute https URLs only (no relative paths).
- If step-by-step photos exist, include them next to the corresponding step with meaningful alt text.
- Link every image to its source page via <a> around the <img>.

Output exactly ONE complete HTML5 document with inline CSS (Food52-like: muted palette, serif display, sans body, gentle shadows, responsive grid).
No Markdown. No commentary.
Accessibility: semantic structure and alt text.
`;

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();
    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction' string in JSON body.", { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY missing", { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1";

    const rsp = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 7000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
    });

    let html = rsp.choices?.[0]?.message?.content ?? "";

    // Must be a full HTML doc
    if (!/^<!DOCTYPE html>/i.test(html.trim())) {
      return new Response(`Model did not return HTML. First 200 chars:\n${html.slice(0,200)}`, { status: 502 });
    }

    // 🔧 Fix image hotlinks
    html = rewriteImages(html);

    // OPTIONAL: relax CSP inside the produced HTML if your <head> has one
    // (Not usually necessary; keeping this comment for clarity.)

    // Persist to blob so "Previous Recipes" can link it
    const safeSlug = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const key = `recipes/${safeSlug}.html`;

    const blob = await put(key, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN, // set on Vercel
    });

    // Return direct URL for the UI (and keep HTML response for “Preview”)
    return new Response(
      JSON.stringify({ url: blob.url, html }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    let details = err?.message || "Unknown error";
    try {
      const body = await err?.response?.text?.();
      if (body) details += ` | OpenAI: ${body}`;
    } catch {}
    console.error("GENERATE_ROUTE_ERROR:", details);
    return new Response(`Server error: ${details}`, { status: err?.status || 500 });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "/api/generate" }), {
    headers: { "Content-Type": "application/json" },
  });
}
