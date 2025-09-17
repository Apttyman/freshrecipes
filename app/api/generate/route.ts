// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import { join } from "path";
import { toPureHtml, addNoReferrer, rewriteImagesToCloudinary } from "@/app/lib/html-tools";
// ⬇️ use relative path (no alias)
import {
  toPureHtml,
  ensureAtLeastOneImage,
  addNoReferrer,
  rewriteImagesToCloudinary,
} from "../../lib/html-tools";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini"; // your existing model

export async function POST(req: NextRequest) {
  try {
    // Prompt from body or query
    let promptFromBody: string | undefined;
    try {
      const body = (await req.json()) as any;
      promptFromBody = body?.prompt ?? body?.query ?? body?.text;
    } catch { /* body may be empty */ }
    const promptFromQuery = req.nextUrl.searchParams.get("q") ?? undefined;
    const userPrompt = (promptFromBody ?? promptFromQuery ?? "").trim();

    if (!userPrompt) {
      return NextResponse.json({ error: "Missing prompt", html: "", slug: "" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const msg = "<!doctype html><html><body><p>OPENAI_API_KEY not set.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userPrompt) }, { status: 200 });
    }

    // ✅ Load your system prompt file (kept exactly in your repo)
    const sysPath = join(process.cwd(), "app", "prompt", "system-prompt.txt");
    const systemPrompt = await readFile(sysPath, "utf8");

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    const raw = (choices[0]?.message?.content ?? "").trim();

    // Minimal post-processing
    const pure = toPureHtml(raw);

    // 🔁 Rehost all images via Cloudinary "fetch" (if cloud name provided)
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
    const rehosted = rewriteImagesToCloudinary(pure, cloud);

    // Add meta + per-image no-referrer
    const html = addNoReferrer(rehosted);

    return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
