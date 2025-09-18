import { NextRequest } from "next/server";

/**
 * Lightweight image proxy for remote <img> URLs when Cloudinary isn’t configured.
 * Security: allows only http/https, blocks internal addresses.
 */
export async function GET(req: NextRequest) {
  try {
    const u = req.nextUrl.searchParams.get("u");
    if (!u) return new Response("Missing u", { status: 400 });

    let target: URL;
    try {
      target = new URL(u);
    } catch {
      return new Response("Bad URL", { status: 400 });
    }

    if (!/^https?:$/i.test(target.protocol)) {
      return new Response("Blocked scheme", { status: 400 });
    }

    // Basic SSRF guard: block link-local/private nets by hostname pattern.
    const host = target.hostname;
    if (
      /(^|\.)(localhost|local|internal)$/.test(host) ||
      /^(0\.0\.0\.0|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/.test(
        host
      )
    ) {
      return new Response("Blocked host", { status: 400 });
    }

    const res = await fetch(target.toString(), {
      // Forward immutable cache headers when possible
      headers: { accept: "image/*,*/*;q=0.8" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new Response(`Upstream ${res.status}`, { status: 502 });
    }

    const headers = new Headers(res.headers);
    const ct = headers.get("content-type") ?? "image/jpeg";
    headers.set("content-type", ct);
    headers.set("cache-control", "public, max-age=86400, immutable");

    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    return new Response("Proxy error", { status: 500 });
  }
}
