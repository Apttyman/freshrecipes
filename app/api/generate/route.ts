// app/api/generate/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { rewriteImagesToCloudinaryFetch } from "@/app/lib/html-tools";

// Use Node runtime so we can read the prompt file.
export const runtime = "nodejs";
// This endpoint is dynamic; never prerender.
export const dynamic = "force-dynamic";

type GenRequest = {
  query?: string; // freeform user directive typed in the box
};

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function readSystemPrompt(): Promise<string> {
  // Path: app/prompt/system-prompt.txt (relative to project root)
  const filePath = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
  const buf = await fs.readFile(filePath);
  return buf.toString("utf8").trim();
}

export async function POST(req: Request) {
  let body: GenRequest;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const directive = (body.query ?? "").trim();
  if (!directive) {
    return fail(400, "Missing 'query' in request body");
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY;
  if (!OPENAI_API_KEY) {
    return fail(500, "OPENAI_API_KEY is not configured");
  }

  // 1) Load your system prompt file verbatim
  let systemPrompt: string;
  try {
    systemPrompt = await readSystemPrompt();
  } catch (err: any) {
    return fail(500, `Failed to read system-prompt.txt: ${err?.message || err}`);
  }

  // 2) Ask the model to produce the COMPLETE HTML per your system prompt
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  let htmlRaw = "";
  try {
    // Use the Responses API if available in your project; otherwise Chat Completions also works.
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: directive,
        },
      ],
    });

    htmlRaw = resp.choices?.[0]?.message?.content ?? "";
    if (!htmlRaw) throw new Error("Model returned empty content");
  } catch (err: any) {
    return fail(500, `OpenAI error: ${err?.message || String(err)}`);
  }

  // 3) Rewrite all <img src="..."> to Cloudinary fetch URLs so the browser loads
  //    Cloudinary (which fetches & caches the origin image) instead of hotlinking.
  try {
    htmlRaw = rewriteImagesToCloudinaryFetch(htmlRaw);
  } catch (err: any) {
    // Non-fatal: still return the original HTML if rewriting hiccups
    console.warn("Image rewrite failed:", err);
  }

  // 4) Return JSON for the client to render
  return NextResponse.json(
    {
      html: htmlRaw,
      meta: {
        bytes: htmlRaw.length,
        rewrittenWithCloudinary: Boolean(
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME
        ),
      },
    },
    { status: 200 }
  );
}
