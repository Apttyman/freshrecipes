// app/api/img/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";          // stream buffering is fine here
export const dynamic = "force-dynamic";   // let us pass any URL

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("u");
  if (!url) return NextResponse.json({ error: "Missing u" }, { status: 400 });

  try {
    // Only allow http(s)
    const target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) {
      return NextResponse.json({ error: "Unsupported scheme" }, { status: 400 });
    }

    // Fetch the image with neutral headers so most CDNs accept it
    const upstream = await fetch(target.toString(), {
      // Most hotlink checks look at Referer; send none.
      // Next will not add one, and we don't include cookies.
      redirect: "follow",
      // Cache on Vercel edges/node (and browser) for speed
      cache: "force-cache",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FreshRecipesBot/1.0; +https://freshrecipes.io)",
        // Intentionally omit Referer and Origin
      } as any,
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    // Pass through the bytes and content-type
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const res = new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        // 1 day browser cache; 7d edge cache
        "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
