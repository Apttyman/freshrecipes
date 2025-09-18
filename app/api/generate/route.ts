// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  slugify,
  toPureHtml,
  ensureAtLeastOneImage,
  rewriteImagesWithCloudinary,
} from "../../lib/html-tools"; // relative import; no addNoReferrer anymore

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MODEL = "gpt-4o-mini";

async function readSystemPrompt(): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const promptPath = path.join(__dirname, "..", "..", "prompt", "system-prompt.txt");
  try {
    const buf = await fs.readFile(promptPath, "utf8");
    return buf.toString();
  } catch {
    // Minimal fallback if the file is missing
    return "Return a complete standalone HTML5 document only (<html>…</html>) with inline <style>. Include at least one <img> with an absolute HTTPS src. Do not include Markdown fences or JSON.";
  }
}

export async function POST(req: NextRequest) {
  try {
    // Accept prompt from body or query
    let promptFromBody: string | undefined;
    try {
      const body = (await req.json()) as any;
      promptFromBody = body?.prompt ?? body?.query ?? body?.text;
    } catch {}
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

    const systemPrompt = await readSystemPrompt();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    const raw = (choices[0]?.message?.content ?? "").trim();

    // Post-processing (no noreferrer anywhere):
    const pure = toPureHtml(raw);
    const withImage = ensureAtLeastOneImage(pure);
    const html = rewriteImagesWithCloudinary(withImage);

    return NextResponse.json({ html, slug: slugify(userPrompt) }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}
