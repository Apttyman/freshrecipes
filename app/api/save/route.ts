// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { slugify, stamp } from "../../lib/html-tools"; // ← relative path

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const html = String(body?.html ?? "");
    const title = String(body?.title ?? "").trim() || "Recipe";
    const slug = slugify(title || "recipe") + "-" + Date.now().toString(36);

    if (!html) {
      return NextResponse.json({ error: "Missing html" }, { status: 400 });
    }

    const dir = `archive/${slug}`;

    const { url: htmlUrl } = await put(
      `${dir}/index.html`,
      new Blob([html], { type: "text/html" }),
      { access: "public", addRandomSuffix: false }
    );

    const meta = {
      title,
      addedAt: stamp(),
      htmlUrl,
      slug,
    };
    await put(
      `${dir}/meta.json`,
      new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" }),
      { access: "public", addRandomSuffix: false }
    );

    const viewUrl = `/archive/${encodeURIComponent(slug)}`;
    return NextResponse.json({ ok: true, slug, viewUrl, htmlUrl }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
