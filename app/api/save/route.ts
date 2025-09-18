// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SaveBody = {
  slug?: string;
  html?: string;
  meta?: Record<string, any>;
};

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    let body: SaveBody;
    try {
      body = (await req.json()) as SaveBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const html = (body.html || "").trim();
    if (!html) {
      return NextResponse.json(
        { error: "Missing html" },
        { status: 400 }
      );
    }

    // Prefer caller-provided slug, else derive from <title> or fallback.
    let slug = slugify(
      body.slug ||
        (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "") ||
        "recipe"
    );
    if (!slug) slug = "recipe";

    // Keys in Blob storage (public)
    const htmlKey = `archive/${slug}/index.html`;
    const jsonKey = `archive/${slug}/meta.json`;

    // Save HTML
    await put(htmlKey, html, {
      access: "public",
      addRandomSuffix: false, // keep a stable key for viewer route
      contentType: "text/html; charset=utf-8",
    });

    // Save metadata (expand with whatever you need)
    const record = {
      slug,
      savedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(html, "utf8"),
      ...((body.meta as object) || {}),
    };

    await put(jsonKey, JSON.stringify(record, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    // Build absolute viewer URL (works on Vercel preview & prod)
    const host = req.headers.get("host") || req.nextUrl.host || "";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "https");
    const base = `${proto}://${host}`;
    const pageUrl = `${base}/archive/${encodeURIComponent(slug)}`;

    return NextResponse.json(
      {
        ok: true,
        slug,
        htmlKey,
        jsonKey,
        url: pageUrl,
        pageUrl, // alias for older UI code
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
