import { NextRequest } from "next/server";
import OpenAI from "openai";
import { rewriteImagesToCloudinaryFetch } from "@/app/lib/html-tools";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept both `query` and `prompt`
    const query: string | undefined = body.query ?? body.prompt;
    if (!query || !query.trim()) {
      return Response.json(
        { error: "Missing 'query' in request body" },
        { status: 400 }
      );
    }

    // Load system prompt text from file
    const fs = await import("fs/promises");
    const sysPromptPath = path.join(process.cwd(), "system-prompt.txt");
    const systemPrompt = await fs.readFile(sysPromptPath, "utf8");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    });

    const html = completion.choices[0].message?.content || "";
    return Response.json({
      html: rewriteImagesToCloudinaryFetch(html),
      slug: query.toLowerCase().replace(/\s+/g, "-").slice(0, 50),
    });
  } catch (err: any) {
    console.error(err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
