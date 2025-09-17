// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Optional: re-import helpers if you keep them DRY in a shared utils file
async function rehostImages(html: string): Promise<string> {
  if (!html) return html;
  return html.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (tag, src) => {
    if (!/^https?:\/\//i.test(src)) return tag;
    const proxied = `/api/rehost?url=${encodeURIComponent(src)}`;
    return tag.replace(src, proxied);
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: string; html?: string };
    const slug = (body?.slug ?? "").trim();
    const rawHtml = (body?.html ?? "").trim();

    if (!slug || !rawHtml) {
      return NextResponse.json(
        { error: "Missing slug or html" },
        { status: 400 }
      );
    }

    // Ensure we rehost before persisting
    const finalHtml = await rehostImages(rawHtml);

    // Persist to Vercel Blob storage
    const htmlKey = `recipes/${slug}.html`;
    await put(htmlKey, finalHtml, { access: "public", contentType: "text/html" });

    const jsonKey = `recipes/${slug}.json`;
    await put(jsonKey, JSON.stringify({ slug, html: finalHtml }), {
      access: "public",
      contentType: "application/json",
    });

    return NextResponse.json(
      {
        ok: true,
        slug,
        htmlKey,
        jsonKey,
        url: `/${htmlKey}`, // quick link for archive viewer
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Save failed") },
      { status: 500 }
    );
  }
}
