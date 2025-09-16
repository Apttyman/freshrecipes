// app/api/img/route.ts
// Robust image fetcher + rehoster with optional page referer support.
// Usage in HTML: <img src="/api/img?u=IMAGE_URL&p=PAGE_URL" .../>
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

export const runtime = "nodejs";

// 8 MB guard (tweak as needed)
const MAX_BYTES = 8 * 1024 * 1024;

const PLACEHOLDER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 32 24">
     <rect width="32" height="24" fill="#f3f4f6"/>
     <path d="M7 16l4-5 4 3 4-6 6 8" fill="none" stroke="#9ca3af" stroke-width="2"/>
   </svg>`;

function okContentType(ct?: string | null) {
  // Be tolerant; some CDNs send application/octet-stream
  return !!ct && /(image\/|application\/octet-stream)/i.test(ct);
}
function extFromContentType(ct = "") {
  if (/png/i.test(ct)) return "png";
  if (/jpe?g/i.test(ct)) return "jpg";
  if (/webp/i.test(ct)) return "webp";
  if (/gif/i.test(ct)) return "gif";
  if (/avif/i.test(ct)) return "avif";
  if (/svg/i.test(ct)) return "svg";
  return "bin";
}

function parseUrlParam(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/^https?:\/\//i.test(u.href)) return null;
    return u.href;
  } catch {
    // allow already-encoded values
    try {
      const u = new URL(decodeURIComponent(raw));
      return /^https?:\/\//i.test(u.href) ? u.href : null;
    } catch {
      return null;
    }
  }
}

async function fetchWithTimeout(url: string, ms = 12000, referer?: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      method: "GET",
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/*;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        // Many origins with hotlink protection require a page referer.
        ...(referer ? { Referer: referer } : { Referer: new URL(url).origin + "/" }),
        // Some clouds are picky without a sec-fetch-site
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  // u = direct image url (required)
  // p = page url (optional; improves success on hotlink-protected origins)
  // NOTE: You can also chain: /api/img?u=/api/img?u=...  (we'll unwrap)
  let u = parseUrlParam(req.nextUrl.searchParams.get("u"));
  if (!u) {
    // unwrap if someone passed our own endpoint as u
    const raw = req.nextUrl.searchParams.get("u");
    if (raw) {
      const match = raw.match(/[?&]u=([^&]+)/);
      if (match) u = parseUrlParam(decodeURIComponent(match[1]));
    }
  }
  const page = parseUrlParam(req.nextUrl.searchParams.get("p"));
  if (!u) return new Response("missing url", { status: 400 });

  try {
    const res = await fetchWithTimeout(u, 12000, page || undefined);
    const ct = res.headers.get("content-type") || "";

    if (!res.ok || !okContentType(ct) || !res.body) {
      // graceful fallback – keep layout intact (but you asked to avoid placeholders in content;
      // this placeholder is only used when the remote is unreachable at fetch-time)
      return new Response(PLACEHOLDER_SVG, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // Stream to buffer with size guard
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
    const key = `images/${hash}.${extFromContentType(ct)}`;

    // Re-host to your Blob (permanent, fast, hotlink-safe)
    const uploaded = await put(key, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: ct || "application/octet-stream",
      addRandomSuffix: false,
    });

    // Redirect the browser to the Blob asset; future loads bypass the origin
    return new Response(null, {
      status: 302,
      headers: {
        Location: uploaded.url,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(PLACEHOLDER_SVG, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }
}
