// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  toPureHtml,
  ensureAtLeastOneImage,
  addNoReferrer,
  rewriteImagesToCloudinary,
} from "../../lib/html-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    // 1) read system prompt from file
    const sysPath = join(process.cwd(), "app", "prompt", "system-prompt.txt");
    const systemPrompt = await readFile(sysPath, "utf8");

    // 2) get user prompt
    let bodyPrompt: string | undefined;
    try {
      const b = (await req.json()) as any;
      bodyPrompt = b?.prompt ?? b?.query ?? b?.text;
    } catch {}
    const qPrompt = req.nextUrl.searchParams.get("q") ?? undefined;
    const userPrompt = (bodyPrompt ?? qPrompt ?? "").trim();

    if (!userPrompt) {
      return NextResponse.json({ error: "Missing prompt", html: "", slug: "" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      const msg =
        "<!doctype html><html><body><p style='font:14px/1.4 ui-sans-serif,system-ui'>OPENAI_API_KEY is not set in Vercel → Project → Settings → Environment Variables.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userPrompt) }, { status: 200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3) call OpenAI with your system-prompt.txt + user prompt
    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // 4) sanitize + image handling
    const raw = (choices[0]?.message?.content ?? "").trim();
    let html = toPureHtml(raw);
    html = ensureAtLeastOneImage(html);

    // If Cloudinary cloud name is present, rewrite image URLs to Cloudinary fetch
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    html = rewriteImagesToCloudinary(html, cloud);

    // Always add no-referrer for safety
    html = addNoReferrer(html);

    return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}
