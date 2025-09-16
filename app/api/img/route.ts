// app/api/img/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Simple, readable placeholder (never break the page)
const PLACEHOLDER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 32 24">
     <rect width="32" height="24" fill="#f3f4f6"/>
     <path d="M7 16l4-5 4 3 4-6 6 8" fill="none" stroke="#9ca3af" stroke-width="2"/>
   </svg>`;

function okImage(ct?: string | null) {
  return !!ct && /image\/(png|jpe?g|webp|gif|avif|svg\+xml)/i.test(ct);
}

async function fetchWithTimeout(url: string, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      // Always GET (some hosts block HEAD/Range)
      method: "GET",
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        // Many hosts require a real UA + Accept
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Avoid compressed streams incompatibilities
        "Accept-Encoding": "identity",
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u || !/^https?:\/\//i.test(u)) {
    return new Response("bad url", { status: 400 });
  }

  try {
    const res = await fetchWithTimeout(u, 8000);
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !okImage(ct)) {
      return new Response(PLACEHOLDER_SVG, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control":
            "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    const headers = new Headers();
    headers.set("content-type", ct || "image/jpeg");
    headers.set(
      "cache-control",
      "public, max-age=86400, stale-while-revalidate=604800"
    );
    return new Response(res.body, { headers });
  } catch {
    return new Response(PLACEHOLDER_SVG, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }
}
