// app/api/img/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const u = req.nextUrl.searchParams.get("u");
    if (!u) return new Response("Missing u", { status: 400 });

    // only allow https and absolute URLs
    let url: URL;
    try {
      url = new URL(u);
      if (url.protocol !== "https:") {
        return new Response("Only https URLs are allowed", { status: 400 });
      }
    } catch {
      return new Response("Bad URL", { status: 400 });
    }

    // fetch the image from the source
    const rsp = await fetch(url.toString(), {
      // some sites require a user-agent and no referer to allow fetching
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        // don't forward your origin; avoids hotlink referer checks
        referer: "",
      },
      // allow redirects (many CDNs 302)
      redirect: "follow",
      // cache on Vercel’s edge for a bit
      next: { revalidate: 60 * 60 },
    });

    if (!rsp.ok) {
      return new Response(`Upstream ${rsp.status}`, { status: 502 });
    }

    // stream back with original content-type + long cache
    const headers = new Headers(rsp.headers);
    headers.set("cache-control", "public, max-age=86400, s-maxage=86400");
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");

    return new Response(rsp.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("IMG_PROXY_ERROR:", err);
    return new Response("Image proxy error", { status: 500 });
  }
}
