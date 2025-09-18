import { NextRequest } from "next/server";
import OpenAI from "openai";
import path from "path";
import { rewriteImagesToCloudinaryFetch } from "@/app/lib/html-tools";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query: string | undefined = (body.query ?? body.prompt)?.toString();
    if (!query || !query.trim()) {
      return Response.json(
        { error: "Missing 'query' in request body" },
        { status: 400 }
      );
    }

    // Read system prompt file
    const fs = await import("fs/promises");
    const sysPromptPath = path.join(process.cwd(), "system-prompt.txt");
    const systemPrompt = await fs.readFile(sysPromptPath, "utf8");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
      "recipes";

    return Response.json({ html: safeHtml, slug });
  } catch (err) {
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
