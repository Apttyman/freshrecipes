// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { slugify } from "@/app/lib/html-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { html?: string; title?: string; slug?: string };
    const html = (body?.html || "").trim();
    const title = (body?.title || "").trim();
    const slug = slugify(body?.slug || title || "untitled");

    if (!html) {
      return NextResponse.json({ error: "Missing html" }, { status: 400 });
    }

    // Store two blobs: index.html + meta.json
    const htmlKey = `archive/${slug}/index.html`;
    const jsonKey = `archive/${slug}/meta.json`;

    await put(htmlKey, html, {
      contentType: "text/html; charset=utf-8",
      access: "public",
    });

    const meta = JSON.stringify({ title: title || slug, slug, savedAt: new Date().toISOString() });
    await put(jsonKey, meta, {
      contentType: "application/json",
      access: "public",
    });

    // Return canonical viewer URL (your Next.js route)
    const viewUrl = `/archive/${slug}`;

    return NextResponse.json(
      { ok: true, slug, htmlKey, jsonKey, url: viewUrl },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err || "Save failed") }, { status: 500 });
  }
}
