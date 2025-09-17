// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveBody = {
  html: string;
  slug?: string;
  title?: string;
};

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const { html: rawHtml = "", slug: rawSlug, title } = (await req.json()) as SaveBody;

    if (!rawHtml || typeof rawHtml !== "string") {
      return NextResponse.json({ error: "Missing HTML" }, { status: 400 });
    }

    const slug = (rawSlug ?? makeSlug(title ?? "recipe")).toLowerCase();
    const token = assertEnv("BLOB_READ_WRITE_TOKEN");

    // Lazy import so Next.js only bundles when called
    const { put, list } = await import("@vercel/blob");

    // 1) Rehost all external <img> src URLs → Vercel Blob (public)
    const { html: rehostedHtml, uploads } = await rehostImages(rawHtml, { token, put });

    // 2) Write final HTML (rehosted) to Blob
    const htmlKey = `recipes/${slug}.html`;
    const htmlPut = await put(htmlKey, rehostedHtml, {
      token,
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // 3) Sidecar JSON (metadata—extend as you like)
    const sidecar = {
      slug,
      title: title ?? getTitle(rehostedHtml) ?? slug,
      createdAt: Date.now(),
      urlHtml: htmlPut.url,          // public blob url
      uploads,                       // list of images we rehosted
    };
    const jsonKey = `recipes/${slug}.json`;
    await put(jsonKey, JSON.stringify(sidecar, null, 2), {
      token,
      access: "public",
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
    });

    // 4) Page URL on YOUR domain (not vercel.app)
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://freshrecipes.io").replace(/\/+$/, "");
    // change path if your archive lives elsewhere:
    const urlPage = `${base}/recipes/${slug}`;

    return NextResponse.json({
      ok: true,
      slug,
      url: urlPage,       // <<— what the client uses to navigate
      urlPage,
      urlHtml: htmlPut.url,
      htmlKey,
      jsonKey,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err || "Save failed") }, { status: 500 });
  }
}

/* ---------------- helpers ---------------- */

function makeSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getTitle(html: string): string | null {
  const m =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).trim() : null;
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "");
}

/**
 * Rehosts every <img src="..."> to Vercel Blob, returns rewritten HTML and the upload map.
 * - Skips data: and already-blobbed URLs
 * - Makes non-HTTPS or blocked origins load via your copy
 */
async function rehostImages(
  html: string,
  ctx: {
    token: string;
    put: (
      key: string,
      body: ArrayBuffer | Uint8Array | string | Blob,
      opts: { token: string; access: "public"; contentType?: string; addRandomSuffix?: boolean }
    ) => Promise<{ url: string }>;
  }
): Promise<{ html: string; uploads: Record<string, string> }> {
  const uploads: Record<string, string> = {};
  const seen = new Map<string, Promise<string>>();

  // Find all <img ... src="..."> occurrences
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;

  const tasks: Array<Promise<void>> = [];
  let match: RegExpExecArray | null;

  while ((match = imgRe.exec(html))) {
    const full = match[0];
    const src = (match[2] || match[3] || match[4] || "").trim();

    if (!src || src.startsWith("data:")) continue;
    if (/^https:\/\/blob\.vercel\.storage\//i.test(src)) continue; // already ours

    // dedupe same src
    if (!seen.has(src)) {
      seen.set(
        src,
        (async () => {
          try {
            const res = await fetch(src, { redirect: "follow" });
            if (!res.ok) throw new Error(`Fetch ${src} → ${res.status}`);
            const ct = res.headers.get("content-type") || "application/octet-stream";
            const buf = await res.arrayBuffer();

            const extension = guessExt(ct);
            const key = `recipes/images/${hash(src)}${extension}`;

            const putRes = await ctx.put(key, buf, {
              token: ctx.token,
              access: "public",
              contentType: ct,
              addRandomSuffix: false,
            });
            return putRes.url;
          } catch {
            // fallback placeholder on error (keeps layout stable)
            return "https://picsum.photos/1200/630";
          }
        })()
      );
    }

    tasks.push(
      seen.get(src)!.then((blobUrl) => {
        uploads[src] = blobUrl;
      })
    );
  }

  await Promise.all(tasks);

  // rewrite all <img src="...">
  const rewritten = html.replace(imgRe, (tag) => {
    const srcMatch = tag.match(/\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i);
    if (!srcMatch) return tag;
    const raw = (srcMatch[2] || srcMatch[3] || srcMatch[4] || "").trim();
    const newSrc = uploads[raw];
    if (!newSrc) return tag;

    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(raw, newSrc);

    // enforce no-referrer/cors for consistency
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t;
  });

  return { html: rewritten, uploads };
}

function guessExt(ct: string): string {
  if (/png/i.test(ct)) return ".png";
  if (/jpe?g/i.test(ct)) return ".jpg";
  if (/webp/i.test(ct)) return ".webp";
  if (/gif/i.test(ct)) return ".gif";
  if (/svg/i.test(ct)) return ".svg";
  return "";
}

function hash(s: string) {
  // tiny stable hash
  let h = 9;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 9 ** 9);
  return (h ^ (h >>> 9)) >>> 0;
}
