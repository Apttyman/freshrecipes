// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  toPureHtml,
  ensureAtLeastOneImage,
  rewriteImagesWithCloudinaryFetch,
  stripNoReferrer,
  slugify,
} from "@/app/lib/html-tools";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

async function loadSystemPrompt() {
  // keep using your system-prompt.txt
  const p = resolve(process.cwd(), "app/prompt/system-prompt.txt");
  return await readFile(p, "utf8");
}

export async function POST(req: NextRequest) {
  try {
    // accept prompt from body or ?q=
    let promptFromBody: string | undefined;
    try {
      const body = (await req.json()) as any;
      promptFromBody = body?.prompt ?? body?.query ?? body?.text;
    } catch {/* ignore */}
    const promptFromQuery = req.nextUrl.searchParams.get("q") ?? undefined;

    const userPrompt = (promptFromBody ?? promptFromQuery ?? "").trim();
    if (!userPrompt) {
      return NextResponse.json(
        { error: "Missing prompt", html: "", slug: "" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      const msg =
        "<!doctype html><html><body><p style='font:14px/1.4 ui-sans-serif,system-ui'>OPENAI_API_KEY is not set in Vercel → Project → Settings → Environment Variables.</p></body></html>";
      return NextResponse.json({ html: msg, slug: slugify(userPrompt) }, { status: 200 });
    }

    const [systemPrompt] = await Promise.all([loadSystemPrompt()]);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages,
    });

    const raw = (choices[0]?.message?.content ?? "").trim();

    // sanitize & post-process
    const pure = toPureHtml(raw);
    const withImage = ensureAtLeastOneImage(pure);

    // IMPORTANT: remove referrerpolicy/crossorigin/meta first
    const noRef = stripNoReferrer(withImage);

    // Rewrite all <img> to Cloudinary fetch URLs
    const html = rewriteImagesWithCloudinaryFetch(noRef);

    return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}
