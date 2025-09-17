// app/api/proxy/route.ts
// Streams a remote image through your origin so browsers never touch the
// hotlink-protected host. This fixes broken images in the inline preview.
//
// Usage: <img src="/api/proxy?url=ENCODED_HTTP_URL">

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("url");
  if (!src) return new Response("Missing url", { status: 400 });

  try {
    // Basic allow-list: only http(s)
    if (!/^https?:\/\//i.test(src)) return new Response("Invalid url", { status: 400 });

    const upstream = await fetch(src, {
      // A few hosts require a UA; we do NOT send a Referer.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; freshrecipes/1.0)" },
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(`Fetch failed: ${upstream.status}`, { status: 502 });
    }

    const ct = upstream.headers.get("content-type") || "image/jpeg";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
        "X-From-Proxy": "1",
      },
    });
  } catch (err: any) {
    return new Response(`Proxy error: ${err?.message || err}`, { status: 500 });
  }
}
