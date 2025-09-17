// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveBody = {
  html?: string;
  slug?: string;
  json?: unknown;
};

export async function POST(req: NextRequest) {
  let slug = "";
  try {
    const body = (await req.json().catch(() => ({}))) as SaveBody;
    const html = (body.html ?? "").toString();
    slug = (body.slug ?? "").toString().trim();

    if (!html || !slug) {
      return NextResponse.json(
        { error: "Missing html or slug" },
        { status: 400 }
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN is not set (Vercel → Project → Settings → Environment Variables).",
        },
        { status: 500 }
      );
    }

    // --- 1. Rehost all images ---
    const rewrittenHtml = await rehostImages(html, slug, token);

    // --- 2. Save HTML to Blob ---
    const htmlKey = `recipes/${slug}.html`;
    const htmlBlob = await put(htmlKey, rewrittenHtml, {
      token,
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // --- 3. Optionally save JSON sidecar ---
    let jsonKey: string | undefined;
    if (typeof body.json !== "undefined") {
      jsonKey = `recipes/${slug}.json`;
      await put(jsonKey, JSON.stringify(body.json, null, 2), {
        token,
        access: "public",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        slug,
        urlHtml: htmlBlob.url,
        htmlKey,
        ...(jsonKey ? { jsonKey } : {}),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, slug, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------- */
/* Helper: fetch every <img>, upload to Blob, rewrite */
/* -------------------------------------------------- */
async function rehostImages(html: string, slug: string, token: string) {
  const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];

  let rewritten = html;

  for (const match of matches) {
    const fullTag = match[0];
    const src = match[1];

    // Skip if already pointing to your Blob
    if (src.includes(".blob.vercel-storage.com")) continue;

    try {
      // Fetch the remote image
      const res = await fetch(src);
      if (!res.ok || !res.body) continue;

      const arrayBuffer = await res.arrayBuffer();
      const ext = guessExtension(res.headers.get("content-type") || "");

      // Construct a deterministic key
      const fileKey = `recipes/${slug}/img-${hash(src)}${ext}`;
      const blob = await put(fileKey, Buffer.from(arrayBuffer), {
        token,
        access: "public",
        contentType: res.headers.get("content-type") || "image/jpeg",
        addRandomSuffix: false,
      });

      // Replace src in HTML with Blob URL
      const newTag = fullTag.replace(src, blob.url);
      rewritten = rewritten.replace(fullTag, newTag);
    } catch (err) {
      console.error("⚠️ Failed to rehost image:", src, err);
    }
  }

  return rewritten;
}

/* Helpers */
function guessExtension(contentType: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return ".jpg";
}

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
