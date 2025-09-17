// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { html, slug } = await req.json();

    if (!html || !slug) {
      return NextResponse.json(
        { error: "Missing html or slug" },
        { status: 400 }
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN not set" },
        { status: 500 }
      );
    }

    const htmlKey = `recipes/${slug}.html`;
    const jsonKey = `recipes/${slug}.json`;

    // Save HTML file
    await put(htmlKey, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      token,
    });

    // Save JSON sidecar file
    await put(jsonKey, JSON.stringify({ slug, html }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      token,
    });

    // Construct a proper page URL for viewing
    const urlPage = `https://freshrecipes.io/recipes/${slug}`;

    return NextResponse.json(
      { ok: true, slug, htmlKey, jsonKey, url: urlPage },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err || "Save failed") },
      { status: 500 }
    );
  }
}
