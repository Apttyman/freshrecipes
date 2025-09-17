// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveBody = {
  slug?: string;
  html?: string;
  meta?: { prompt?: string } | null;
};

export async function POST(req: NextRequest) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN in env" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SaveBody;
    const slug = (body.slug || "recipe").toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
    const htmlInput = String(body.html || "");

    // make sure IMG src uses our proxy before saving
    const htmlForArchive = rewriteImagesToProxy(addNoReferrer(htmlInput));

    const ts = Date.now();
    const htmlKey = `recipes/${slug}-${ts}.html`;
    const jsonKey = `recipes/${slug}-${ts}.json`;

    // save HTML
    const htmlPut = await put(htmlKey, htmlForArchive, {
      token,
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // save JSON sidecar (useful for listing)
    const jsonPut = await put(
      jsonKey,
      JSON.stringify(
        {
          slug,
          createdAt: ts,
          urlHtml: htmlPut.url,
          prompt: body.meta?.prompt || null,
        },
        null,
        2
      ),
      {
        token,
        access: "public",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
      }
    );

    return NextResponse.json(
      { ok: true, slug, urlHtml: htmlPut.url, urlJson: jsonPut.url, htmlKey, jsonKey },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

/* --- minimal copies of helpers so this route is self-contained --- */

function addNoReferrer(html: string): string {
  let out = html || "";
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });
  return out;
}

function rewriteImagesToProxy(html: string): string {
  return (html || "").replace(/<img\b([^>]*?)\bsrc\s*=\s*(['"])(.*?)\2/gi, (_m, pre, q, src) => {
    try {
      if (/^\/api\/img\?u=/.test(src) || /^data:/i.test(src)) return _m;
      const abs = new URL(src, "https://placeholder.invalid/");
      if (!/^https?:$/i.test(abs.protocol)) return _m;
      const proxied = `/api/img?u=${encodeURIComponent(src)}`;
      return `<img${pre}src=${q}${proxied}${q}`;
    } catch {
      return _m;
    }
  });
}
