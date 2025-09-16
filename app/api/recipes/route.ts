// app/api/recipes/route.ts
import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";

export const runtime = "nodejs";

// --- helpers ---
function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function extractTitle(html: string): string {
  const mTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (mTitle?.[1]) return mTitle[1].trim();
  const mH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (mH1?.[1]) return mH1[1].replace(/<[^>]+>/g, "").trim();
  return "fresh-recipes";
}

// --- GET /api/recipes ---
// List all archived recipe HTML pages
export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "Missing BLOB_READ_WRITE_TOKEN env var" },
        { status: 500 }
      );
    }

    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const items = blobs
      .filter((b) => b.pathname.endsWith(".html"))
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
      .map((b) => ({
        name: b.pathname.replace(/^recipes\//, ""),
        url: b.url,
        uploadedAt: b.uploadedAt,
      }));

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "List failed" },
      { status: 500 }
    );
  }
}

// --- POST /api/recipes ---
// Optional: save provided HTML to Blob (if you generate on the client or want to re-save)
// body: { html: string, instruction?: string, title?: string }
export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "Missing BLOB_READ_WRITE_TOKEN env var" },
        { status: 500 }
      );
    }

    const { html, instruction, title } = await req.json();

    if (typeof html !== "string" || !/^<!DOCTYPE html>/i.test(html.trim())) {
      return NextResponse.json(
        { ok: false, error: "Body must include a complete HTML document starting with <!DOCTYPE html>" },
        { status: 400 }
      );
    }

    const base = title || extractTitle(html) || instruction || "fresh-recipes";
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const key = `recipes/${ts}-${slugify(base)}.html`;

    const blob = await put(key, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      cacheControl: "public, max-age=31536000, immutable",
    });

    return NextResponse.json({ ok: true, url: blob.url, key: blob.pathname });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Save failed" },
      { status: 500 }
    );
  }
}
