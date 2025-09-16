// app/api/img/route.ts
// Purpose: Fetch remote image (with proper headers), re-host to Vercel Blob, and 302 to the stable CDN URL.
// Usage in HTML: <img src="/api/img?u=IMAGE_URL&p=PAGE_URL" ... />
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

export const runtime = "nodejs"; // Route Handler on Node runtime.  [oai_citation:1‡Next.js](https://nextjs.org/docs/14/app/building-your-application/rendering/edge-and-nodejs-runtimes?utm_source=chatgpt.com)

const MAX_BYTES = 8 * 1024 * 1024; // 8MB guard
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const SVG_FALLBACK =
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="36" viewBox="0 0 48 36">
     <rect width="48" height="36" fill="#f3f4f6"/>
     <path d="M10 24l6-7 6 5 6-9 10 12" fill="none" stroke="#9ca3af" stroke-width="3"/>
   </svg>`;

function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/^https?:\/\//i.test(u.href)) return null;
    return u.href;
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
function extFromCT(ct = "") {
  if (/png/i.test(ct)) return "png";
  if (/jpe?g/i.test(ct)) return "jpg";
  if (/webp/i.test(ct)) return "webp";
  if (/gif/i.test(ct)) return "gif";
  if (/avif/i.test(ct)) return "avif";
  if (/svg/i.test(ct)) return "svg";
  return "bin";
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
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        // Many CDNs require a page Referer to allow hotlinking.  [oai_citation:2‡Amazon Web Services, Inc.](https://aws.amazon.com/blogs/security/how-to-prevent-hotlinking-by-using-aws-waf-amazon-cloudfront-and-referer-checking/?utm_source=chatgpt.com)
        ...(referer ? { Referer: referer } : {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  let u = safeUrl(req.nextUrl.searchParams.get("u"));
  if (!u) {
    // unwrap nested /api/img?u=<encoded> if someone double-proxied
    const raw = req.nextUrl.searchParams.get("u");
    const m = raw?.match(/[?&]u=([^&]+)/);
    if (m) u = safeUrl(decodeURIComponent(m[1]));
  }
  const page = safeUrl(req.nextUrl.searchParams.get("p")); // optional: origin page to satisfy Referer checks
  if (!u) return new Response("missing url", { status: 400 });

  try {
    const res = await fetchWithTimeout(u, 12000, page || new URL(u).origin + "/");
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !okContentType(ct) || !res.body) {
      // Broken/blocked image → return tiny SVG to avoid layout jumps (better UX on iOS).  [oai_citation:3‡Mac Support](https://macosx.com/threads/pictures-on-safari-page-show-up-as-blue-square.294893/?utm_source=chatgpt.com)
      return new Response(SVG_FALLBACK, {
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
    const key = `images/${hash}.${extFromCT(ct)}`;

    // Re-host on Vercel Blob (public) so future loads use your stable CDN URL.  [oai_citation:4‡Vercel](https://vercel.com/docs/vercel-blob/using-blob-sdk?utm_source=chatgpt.com)
    const uploaded = await put(key, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: ct || "application/octet-stream",
      addRandomSuffix: false,
    });

    // 302 to the permanent asset; browser will cache aggressively.
    return new Response(null, {
      status: 302,
      headers: {
        Location: uploaded.url,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(SVG_FALLBACK, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }
}
