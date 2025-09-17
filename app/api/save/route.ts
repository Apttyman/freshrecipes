import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SaveBody = {
  html?: string;
  meta?: Record<string, any>;
  slug?: string;
};

export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_RW;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Blob token missing. Set BLOB_READ_WRITE_TOKEN in Vercel." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SaveBody;

    const html = body.html ?? "<!-- empty -->";
    const slug =
      (body.slug && sanitizeSlug(body.slug)) ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const htmlKey = `recipes/${slug}.html`;
    const jsonKey = `recipes/${slug}.json`;

    const { put } = await import("@vercel/blob");

    await put(htmlKey, html, {
      token,
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false
    });

    const metaPayload = {
      ...(body.meta ?? {}),
      slug,
      savedAt: new Date().toISOString()
    };

    await put(jsonKey, JSON.stringify(metaPayload, null, 2), {
      token,
      access: "public",
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false
    });

    return NextResponse.json({ ok: true, slug, htmlKey, jsonKey }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

function sanitizeSlug(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
}
