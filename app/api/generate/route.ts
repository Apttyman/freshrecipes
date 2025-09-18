import { NextRequest } from "next/server";
import OpenAI from "openai";
import path from "path";
import { rewriteImagesToCloudinaryFetch } from "@/app/lib/html-tools";

// Use Node so we can read from the filesystem.
export const runtime = "nodejs";

// Cache the system prompt across invocations.
let cachedSystemPrompt: string | null = null;
async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const fs = await import("fs/promises");
  // Correct path: file is inside app/prompt/
  const sysPromptPath = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
  cachedSystemPrompt = await fs.readFile(sysPromptPath, "utf8");
  return cachedSystemPrompt!;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const query: string | undefined = (body.query ?? body.prompt)?.toString();
    if (!query || !query.trim()) {
      return Response.json({ error: "Missing 'query' in request body" }, { status: 400 });
    }

    const systemPrompt = await getSystemPrompt();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables."
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7
    });

    const html = completion.choices[0]?.message?.content ?? "";
    const safeHtml = rewriteImagesToCloudinaryFetch(html);
    const slug =
      query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "recipes";

    return Response.json({ html: safeHtml, slug });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // In development, surface the real error; in production, keep generic.
    const payload =
      process.env.NODE_ENV === "development"
        ? { error: "Generation failed", detail: msg }
        : { error: "Generation failed" };
    // Also log for server logs
    console.error("Generate API error:", msg);
    return Response.json(payload, { status: 500 });
  }
}
