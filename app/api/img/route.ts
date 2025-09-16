// app/api/img/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  try {
    const rsp = await fetch(url, {
      headers: {
        // reduce blocks from some origins
        "User-Agent":
          "Mozilla/5.0 (compatible; FreshRecipesBot/1.0; +https://freshrecipes.io)",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": new URL(url).origin + "/",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!rsp.ok) {
      return new Response(`Upstream ${rsp.status}`, { status: 502 });
    }

    const ct = rsp.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      return new Response("Not an image", { status: 415 });
    }

    // stream through
    const headers = new Headers();
    headers.set("Content-Type", ct);
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(rsp.body, { headers });
  } catch (e: any) {
    return new Response("Proxy error", { status: 500 });
  }
}
