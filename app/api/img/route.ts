// app/api/img/route.ts
// Robust image re-hoster: fetch remote with sane headers, upload to Vercel Blob, 302 to stable CDN.
// Usage in HTML:
//   <img src="/api/img?u=IMAGE_URL&p=PAGE_URL" alt="..." />
// Notes:
// - u = required direct image URL (https)
// - p = optional page URL to use as Referer (some hosts require it)

import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

export const runtime = "nodejs";

// ---- Config ----
const MAX_BYTES = 8 * 1024 * 1024; // 8MB guard
const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const SVG_FALLBACK =
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="36" viewBox="0 0 48 36" role="img" aria-label="image unavailable">
     <rect width="48" height="36" fill="#f3f4f6"/>
     <path d="M10 24l6-7 6 5 6-9 10 12" fill="none" stroke="#9ca3af" stroke-width="3"/>
   </svg>`;

// ---- helpers ----
function needToken() {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  return !t || !t.trim();
}

function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return /^https?:\/\//i.test(u.href) ? u.href : null;
  } catch {
    try {
      const u = new URL(decodeURIComponent(raw));
      return /^https?:\/\//i.test(u.href) ? u.href : null;
    } catch {
      return null;
    }
  }
}

function okContentType(ct: string | null) {
  return !!ct && /(image\/|application\/octet-stream)/i.test(ct);
}

function extFromCTorURL(ct: string | null, u: string): string {
  if (ct) {
    if (/png/i.test(ct)) return "png";
    if (/jpe?g/i.test(ct)) return "jpg";
    if (/webp/i.test(ct)) return "webp";
    if (/gif/i.test(ct)) return "gif";
    if (/avif/i.test(ct)) return "avif";
    if (/svg/i.test(ct)) return "svg";
  }
  const path = new URL(u).pathname.toLowerCase();
  if (path.endsWith(".png")) return "png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "jpg";
  if (path.endsWith(".webp")) return "webp";
  if (path.endsWith(".gif")) return "gif";
  if (path.endsWith(".avif")) return "avif";
  if (path.endsWith(".svg")) return "svg";
  return "bin";
}

async function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS, referer?: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      method: "GET",
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/*;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        ...(referer ? { Referer: referer } : {}), // only send if provided
      },
    });
  } finally {
    clearTimeout(t);
  }
}

// ---- handler ----
export async function GET(req: NextRequest) {
  // Param parsing
  let u = safeUrl(req.nextUrl.searchParams.get("u"));
  if (!u) {
    // unwrap nested /api/img?u=<...> if double-proxied
    const raw = req.nextUrl.searchParams.get("u");
    const m = raw?.match(/[?&]u=([^&]+)/);
    if (m) u = safeUrl(decodeURIComponent(m[1]));
  }
  const page = safeUrl(req.nextUrl.searchParams.get("p")); // optional Referer page

  if (!u) return new Response("missing url", { status: 400 });
  if (needToken()) {
    console.error("[IMG] Missing BLOB_READ_WRITE_TOKEN");
    return new Response("server not configured", { status: 500 });
  }

  try {
    console.log("[IMG] fetch start", { u, referer: page || null });

    const res = await fetchWithTimeout(u, FETCH_TIMEOUT_MS, page || undefined);
    const ct = res.headers.get("content-type") || "";

    console.log("[IMG] fetch done", { status: res.status, ct });

    if (!res.ok || !okContentType(ct) || !res.body) {
      console.warn("[IMG] bad upstream response");
      return new Response(SVG_FALLBACK, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // Stream to buffer with size cap
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) throw new Error("image too large");
        chunks.push(value);
      }
    }
    const buf = Buffer.concat(chunks);

    const hash = crypto.createHash("sha1").update(buf).digest("hex");
    const ext = extFromCTorURL(ct, u);
    const key = `images/${hash}.${ext}`;

    const uploaded = await put(key, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      contentType: ct || "application/octet-stream",
      addRandomSuffix: false,
    });

    console.log("[IMG] blob stored", { key, url: uploaded.url });

    // Redirect to stable CDN URL (browser will use this directly on next load)
    return new Response(null, {
      status: 302,
      headers: {
        Location: uploaded.url,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[IMG] error", e);
    return new Response(SVG_FALLBACK, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }
}
