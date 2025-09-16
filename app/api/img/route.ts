// app/api/img/route.ts
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

export const runtime = "nodejs";

// 6 MB guard (tweak as desired)
const MAX_BYTES = 6 * 1024 * 1024;

const PLACEHOLDER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 32 24">
     <rect width="32" height="24" fill="#f3f4f6"/>
     <path d="M7 16l4-5 4 3 4-6 6 8" fill="none" stroke="#9ca3af" stroke-width="2"/>
   </svg>`;

function okContentType(ct?: string | null) {
  // Some servers lie (application/octet-stream). Be tolerant.
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

async function fetchWithTimeout(url: string, ms = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      method: "GET", // many hosts block HEAD/Range
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        // Be generous: some CDNs block “botty” defaults
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        // Some origins only allow “same-site” hotlinks; spoof referer to origin itself
        Referer: new URL(url).origin + "/",
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new Response("missing url", { status: 400 });

  // Allow proxy-chaining (if someone passed our own /api/img?u=...)
  let u = raw;
  try {
    const maybe = new URL(raw, "http://x");
    const inner = maybe.searchParams.get("u");
    if (inner && /^https?:\/\//i.test(inner)) u = inner;
  } catch {
    /* ignore */
  }
  if (!/^https?:\/\//i.test(u)) return new Response("bad url", { status: 400 });

  try {
    const res = await fetchWithTimeout(u, 10000);
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !okContentType(ct)) {
      // graceful placeholder (never break layout)
      return new Response(PLACEHOLDER_SVG, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // Buffer with size guard so we don’t blow memory on huge files
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("image too large");
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);

    // Hash + write to Blob; then redirect to the permanent blob URL
    const hash = crypto.createHash("sha1").update(buf).digest("hex");
    const key = `images/${hash}.${extFromContentType(ct)}`;
    const { url: blobUrl } = await put(key, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: ct || "application/octet-stream",
      addRandomSuffix: false,
    });

    // 302 so the browser swaps to your Blob domain for all subsequent loads
    return new Response(null, {
      status: 302,
      headers: {
        Location: blobUrl,
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
