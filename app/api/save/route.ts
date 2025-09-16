// app/api/save/route.ts
import { NextRequest } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  try {
    const { html, images, query } = (await req.json()) as {
      html: string;
      images?: string[];
      query?: string; // we'll store this in the meta
    };
    if (typeof html !== "string" || !html.trim()) {
      return new Response("Bad body", { status: 400 });
    }

    const ts = Date.now();
    const base = `${ts}-${slugify(query || "recipe")}`;
    const htmlKey = `recipes/${base}.html`;
    const jsonKey = `recipes/${base}.json`;

    // Save HTML
    const out = await put(htmlKey, html, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // Save meta (query + a bit of context)
    const meta = {
      query: query || "",
      createdAt: ts,
      imageCount: Array.isArray(images) ? images.length : 0,
      htmlKey,
      htmlUrl: out.url,
    };

    await put(jsonKey, JSON.stringify(meta), {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
    });

    return new Response(JSON.stringify({ ok: true, url: out.url }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response("save failed", { status: 500 });
  }
}
