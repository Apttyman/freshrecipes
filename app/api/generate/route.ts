// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const PROMPT_PATH = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");

export async function POST(req: NextRequest) {
  try {
    // 1) read user prompt (body or ?q=)
    let bodyPrompt: string | undefined;
    try {
      const body = (await req.json()) as any;
      bodyPrompt = (body?.prompt ?? body?.query ?? body?.text)?.toString();
    } catch {
      /* body may be empty */
    }
    const queryPrompt = req.nextUrl.searchParams.get("q") ?? undefined;
    const userPrompt = (bodyPrompt ?? queryPrompt ?? "").trim();

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Missing prompt", html: "", slug: "", rawSnippet: "" },
        { status: 400 }
      );
    }

    // 2) ensure key
    if (!process.env.OPENAI_API_KEY) {
      const msg =
        "<!doctype html><html><body><p style='font:14px/1.4 ui-sans-serif,system-ui'>OPENAI_API_KEY is not set in Vercel → Project → Settings → Environment Variables.</p></body></html>";
      return NextResponse.json(
        { html: msg, slug: slugify(userPrompt), rawSnippet: msg },
        { status: 200 }
      );
    }

    // 3) load system prompt from file
    let systemPrompt = "";
    try {
      systemPrompt = await fs.readFile(PROMPT_PATH, "utf8");
    } catch (e) {
      return NextResponse.json(
        {
          error: `system-prompt.txt not found at ${PROMPT_PATH}`,
          html: "",
          slug: slugify(userPrompt),
          rawSnippet: "",
        },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 4) call OpenAI
    const { choices } = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = (choices?.[0]?.message?.content ?? "").toString().trim();
    const rawSnippet = raw.slice(0, 1200);

    // 5) normalize to pure HTML
    const html = toPureHtml(raw);

    if (!html.trim()) {
      // Always send something the UI can show in the red debug box
      return NextResponse.json(
        {
          error: "Model returned no HTML (after normalization).",
          html: "",
          slug: slugify(userPrompt),
          rawSnippet,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { html, slug: slugify(userPrompt), rawSnippet },
      { status: 200 }
    );
  } catch (err: any) {
    // Surface full error in a field the UI shows on phone
    return NextResponse.json(
      {
        error: `Generation failed: ${String(err)}`,
        html: "",
        slug: "",
        rawSnippet: "",
      },
      { status: 500 }
    );
  }
}

/* ---------------- helpers ---------------- */

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // JSON shape: { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") return j.html.trim();
    } catch {
      /* ignore */
    }
  }

  // ```html ... ```
  const fencedHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (fencedHtml) return fencedHtml[1].trim();

  // ``` ... ```
  const fencedAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (fencedAny) return fencedAny[1].trim();

  return out;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
