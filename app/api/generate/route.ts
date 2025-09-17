// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

// ---- tiny utils ----
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}

function toPureHtml(s: string): string {
  let out = (s ?? "").trim();
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {}
  }
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();
  return out;
}

function addNoReferrer(html: string): string {
  let out = html || "";
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
    }
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });
  return out;
}

// (Optional) your rehosting util can live here; return html unchanged if you haven’t wired it yet
async function rehostImages(html: string): Promise<string> {
  // no-op placeholder to avoid “Load failed” if not configured yet
  return html;
}

export async function POST(req: NextRequest) {
  try {
    // pull prompt from body or query
    let userText = "";
    try {
      const body = (await req.json()) as any;
      userText = String(body?.prompt ?? body?.query ?? body?.text ?? "").trim();
    } catch {}
    if (!userText) {
      userText = String(req.nextUrl.searchParams.get("q") || "").trim();
    }
    if (!userText) {
      return NextResponse.json({ error: "Missing prompt", html: "", slug: "" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set in environment", html: "", slug: "" },
        { status: 500 }
      );
    }

    // read your system prompt from file (kept!)
    const sysPath = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
    let systemPrompt = "";
    try {
      systemPrompt = await fs.readFile(sysPath, "utf8");
    } catch (e: any) {
      return NextResponse.json(
        { error: `Failed to read system-prompt.txt (${sysPath}): ${e?.message || e}` , html: "", slug: "" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText },
    ];

    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages,
    });

    const raw = (res.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Model returned empty content", html: "", slug: "" },
        { status: 502 }
      );
    }

    const pure = toPureHtml(raw);
    const withNoreferrer = addNoReferrer(pure);
    const rehosted = await rehostImages(withNoreferrer);

    const slug = slugify(userText);
    return NextResponse.json({ html: rehosted, slug }, { status: 200 });
  } catch (err: any) {
    // always return a readable message so the UI can show it instead of “Load failed”
    return NextResponse.json(
      { error: String(err?.message || err || "Generation failed"), html: "", slug: "" },
      { status: 500 }
    );
  }
}
