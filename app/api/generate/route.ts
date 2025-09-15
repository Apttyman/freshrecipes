import OpenAI from "openai";
import type { NextRequest } from "next/server";

// ✅ Force Node runtime (the OpenAI SDK needs Node, not Edge)
export const runtime = "nodejs";
// (Optional) give the function more time on Vercel
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You generate a single, complete, downloadable HTML file from a natural-language instruction.
[... keep your same rules here ...]
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
      max_tokens: 5000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
    });

    const html = rsp.choices?.[0]?.message?.content ?? "";

    if (!/^<!DOCTYPE html>/i.test(html.trim())) {
      console.error("Model response did not start with DOCTYPE:", html.slice(0, 200));
      return new Response("Model did not return a complete HTML document.", { status: 502 });
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
