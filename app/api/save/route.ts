// app/api/save/route.ts
import { NextRequest } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

type SaveBody = {
  html: string;
  images?: Array<{ src: string; alts?: string[]; referer?: string }>;
  query?: string;
};

const nowIso = () => new Date().toISOString();
const pad = (n: number) => String(n).padStart(2, "0");

function yyyymmddhhmmss(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function textBetween(html: string, re: RegExp): string | null {
  const m = html.match(re);
  if (!m) return null;
  const raw = m[1] ?? "";
  return raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SaveBody;
    const html = String(body.html ?? "");
    if (!html) return new Response("Missing html", { status: 400 });

    // Extract metadata from HTML (best-effort)
    const title =
      textBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ??
      textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
      "Untitled Recipe";
    const chef =
      textBetween(html, /data-chef-name="([^"]+)"/i) ??
      textBetween(html, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ??
      null;

    const stem =
      yyyymmddhhmmss() +
      "-" +
      (title ? slugify(title) : "recipe");

    // Save HTML
    const htmlKey = `recipes/${stem}.html`;
    const htmlPut = await put(htmlKey, html, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // Save sidecar JSON
    const jsonKey = `recipes/${stem}.json`;
    const sidecar = {
      stem,
      slug: stem, // using stem as slug
      title,
      chef,
      query: body.query ?? null,
      images: (body.images ?? []).map((im) => ({
        src: im.src,
        alts: im.alts ?? [],
        referer: im.referer ?? null,
      })),
      createdAt: nowIso(),
      htmlUrl: htmlPut.url,
    };
    const jsonPut = await put(jsonKey, JSON.stringify(sidecar, null, 2), {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        slug: stem,
        url: htmlPut.url,
        json: jsonPut.url,
        title,
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "Save failed" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
