// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveBody = {
  html?: string;
  slug?: string;
  json?: unknown;
};

export async function POST(req: NextRequest) {
  let slug = "";
  try {
    const body = (await req.json().catch(() => ({}))) as SaveBody;
    const rawHtml = (body.html ?? "").toString();
    slug = (body.slug ?? "").toString().trim();

    if (!rawHtml || !slug) {
      return NextResponse.json(
        { error: "Missing html or slug" },
        { status: 400 }
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN is not set (Vercel → Project → Settings → Environment Variables).",
        },
        { status: 500 }
      );
    }

    // 1) Rehost all remote images to our Blob bucket and rewrite <img src=...>
    const rehostedHtml = await rehostRemoteImages(rawHtml, slug, token);

    // 2) Write HTML (public, stable key)
    const htmlKey = `recipes/${slug}.html`;
    const htmlBlob = await put(htmlKey, rehostedHtml, {
      token,
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // 3) Optional JSON sidecar
    let jsonKey: string | undefined;
    if (typeof body.json !== "undefined") {
      jsonKey = `recipes/${slug}.json`;
      await put(jsonKey, JSON.stringify(body.json, null, 2), {
        token,
        access: "public",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        slug,
        urlHtml: htmlBlob.url,
        htmlKey,
        ...(jsonKey ? { jsonKey } : {}),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        slug,
        error: typeof err?.message === "string" ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * Rehosts all remote <img> sources (including data-src/srcset/lazy variants) to Vercel Blob (public),
 * then rewrites HTML <img src="..."> to our blob URLs.
 */
async function rehostRemoteImages(html: string, slug: string, token: string): Promise<string> {
  let out = html;

  // Collect all <img ...> tags
  const tags = [...out.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  if (!tags.length) return out;

  // Helper to extract one attribute value
  function pickAttr(tag: string, re: RegExp): string {
    const m = tag.match(new RegExp(`${re.source}\\s*=\\s*("([^"]+)"|'([^']+)'|([^\\s>]+))`, re.flags));
    return (m?.[2] || m?.[3] || m?.[4] || "").trim();
  }

  // Deduplicate work by original URL
  const replacementMap = new Map<string, string>();

  // Process each tag in parallel
  await Promise.all(
    tags.map(async (tag) => {
      // Prefer data-src/data-original/data-lazy → src → first candidate in srcset
      const dataSrc = pickAttr(tag, /data-(?:src|original|lazy)/i);
      const srcAttr = pickAttr(tag, /src/i);
      const srcset = pickAttr(tag, /srcset/i);

      let url = dataSrc || srcAttr || "";
      if (!url && srcset) {
        const first = (srcset.split(",")[0] || "").trim().split(/\s+/)[0] || "";
        url = first;
      }

      if (!url) return; // nothing to do

      // Absolutize //host/path → https://host/path
      if (url.startsWith("//")) url = "https:" + url;

      // Skip non-absolute http(s) (data: URIs, relative /img.jpg, etc.)
      if (!/^https?:\/\//i.test(url)) return;

      // Already rehosted? skip fetch
      if (replacementMap.has(url)) return;

      try {
        // Fetch the image server-side (no referrer here by default)
        const res = await fetch(url, {
          // Some hosts require UA
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            // Explicitly no Referer
            "Referer": "",
          },
          // avoid caching oddities
          cache: "no-store",
          redirect: "follow",
        });

        if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);

        const arrayBuf = await res.arrayBuffer();
        const type = res.headers.get("content-type") || "image/jpeg";
        const ext = guessExt(type);

        const key = `recipes/${slug}/assets/img-${hashOf(url)}${ext}`;
        const blob = await put(key, Buffer.from(arrayBuf), {
          token,
          access: "public",
          contentType: type,
          addRandomSuffix: false,
        });

        replacementMap.set(url, blob.url);
      } catch {
        // If fetch or upload fails, leave it as-is (image may still work), no throw
      }
    })
  );

  if (!replacementMap.size) return out;

  // Finally, rewrite HTML:
  //  - normalize each <img> to a clean tag with our blob URL (if we fetched it)
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    // Pick the effective source we used above:
    const dataSrc = pickAttr(tag, /data-(?:src|original|lazy)/i);
    const srcAttr = pickAttr(tag, /src/i);
    const srcset = pickAttr(tag, /srcset/i);

    let url = dataSrc || srcAttr || "";
    if (!url && srcset) {
      const first = (srcset.split(",")[0] || "").trim().split(/\s+/)[0] || "";
      url = first;
    }
    if (url.startsWith("//")) url = "https:" + url;

    const replaced = replacementMap.get(url);
    const finalSrc = replaced || (/^https?:\/\//i.test(url) ? url : "https://picsum.photos/800/450");

    return `<img src="${finalSrc}" referrerpolicy="no-referrer" crossorigin="anonymous" loading="eager" decoding="async">`;
  });

  // Also ensure the doc has a no-referrer meta (keeps consistent behavior)
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
    }
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }

  return out;
}

function guessExt(contentType: string): string {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "image/svg+xml") return ".svg";
  return ".bin";
}

// quick stable hash from a URL string (not crypto-strong, just to name files deterministically)
function hashOf(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
