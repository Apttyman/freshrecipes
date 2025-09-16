// app/api/img/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Optional: light allowlist to reduce hotlink bans & weird hosts
const ALLOW_HOSTS = [
  "images.squarespace-cdn.com",
  "assets.epicurious.com",
  "www.seriouseats.com",
  "static01.nyt.com",
  "media.bonappetit.com",
  "food.fnr.sndimg.com",
  "static01.nyt.com", // NYT Cooking (often paywalled but images are public CDN)
  "upload.wikimedia.org",
  "imgur.com",
  "www.foodandwine.com",
  "www.bbcgoodfood.com",
  "www.jamieoliver.com",
  "www.gordonramsay.com",
  "www.foodnetwork.com",
  "hips.hearstapps.com",
  "images.ctfassets.net",
];

function isHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const u = req.nextUrl.searchParams.get("u");
    if (!u || !isHttpUrl(u)) {
      return new Response("Bad image URL", { status: 400 });
    }
    const url = new URL(u);

    // Optional allowlist enforcement
    if (!ALLOW_HOSTS.includes(url.hostname)) {
      // You can relax this to warn instead of block:
      // return new Response("Host not allowed", { status: 403 });
      // Soft-allow for now:
    }

    const upstream = await fetch(url.toString(), {
      redirect: "follow",
      headers: {
        // Some CDNs require a UA; this is harmless
        "User-Agent":
          "Mozilla/5.0 (compatible; FreshRecipesBot/1.0; +https://freshrecipes.io)",
        // A referrer can help some origins
        Referer: `${req.nextUrl.origin}/`,
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return new Response("Failed to fetch upstream image", { status: 502 });
    }

    const ct = upstream.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      return new Response("Upstream not an image", { status: 415 });
    }

    // Stream it down, cache aggressively at the edge
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "CDN-Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Vercel-CDN-Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("IMG_PROXY_ERROR:", err);
    return new Response("Image proxy error", { status: 500 });
  }
}
