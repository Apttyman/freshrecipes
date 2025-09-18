import { NextRequest, NextResponse } from "next/server";
import path from "path";

// --- Safe import of server-only helper. If it fails, we no-op instead.
let rewriteImagesToCloudinaryFetch: (html: string) => string = (s) => s;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  rewriteImagesToCloudinaryFetch =
    require("@/app/lib/html-tools").rewriteImagesToCloudinaryFetch ?? ((s: string) => s);
} catch {
  // keep identity function – never crash module load
}

// Use Node to read files.
export const runtime = "nodejs";
// Always compute at request time; avoid any stale caching.
export const dynamic = "force-dynamic";

// cache system prompt in memory between invocations
let cachedPrompt: string | null = null;
async function readSystemPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  const fs = await import("fs/promises");
  try {
    const p = path.join(process.cwd(), "app", "prompt", "system-prompt.txt");
    cachedPrompt = await fs.readFile(p, "utf8");
    return cachedPrompt!;
  } catch (err) {
    // Fall back – don’t crash the route if the file is missing
    console.error("system-prompt.txt read failed:", err);
    cachedPrompt =
      "You are a helpful chef assistant. Return clean HTML for recipes the user asks.";
    return cachedPrompt!;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const query: string | undefined = (body.query ?? body.prompt)?.toString();
    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: "Missing 'query' in request body" },
        { status: 400 }
      );
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      // Return a clear, helpful error instead of crashing the function.
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not set on the server. Add it in Vercel → Project → Settings → Environment Variables.",
        },
        { status: 500 }
      );
    }

    const systemPrompt = await readSystemPrompt();

    // Import OpenAI only after we’ve verified env vars to avoid throwing at module init.
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      temperature: 0.7,
    });

    const html = completion.choices[0]?.message?.content ?? "";
    const safeHtml = rewriteImagesToCloudinaryFetch(html);

    const slug =
      query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "recipes";

    return NextResponse.json({ html: safeHtml, slug });
  } catch (err: any) {
    // Always return JSON so the client never sees Safari's “Load failed”.
    console.error("Generate API error:", err);
    const message =
      typeof err?.message === "string" ? err.message : "Unknown error";
    return NextResponse.json({ error: "Generation failed", detail: message }, { status: 500 });
  }
}
