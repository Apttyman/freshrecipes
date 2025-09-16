// app/api/img/route.ts
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get("u");

  if (!u || (!u.startsWith("http://") && !u.startsWith("https://"))) {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const rsp = await fetch(u, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FreshRecipesBot/1.0; +https://freshrecipes.io)",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!rsp.ok) {
      return new Response("Failed to fetch image", { status: 502 });
    }

    return new Response(rsp.body, {
      headers: {
        "Content-Type": rsp.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return new Response("Image proxy error: " + err.message, { status: 500 });
  }
}
