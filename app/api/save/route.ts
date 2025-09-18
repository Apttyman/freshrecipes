// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// tiny helpers kept here to avoid extra imports
function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function stamp() {
  return new Date().toISOString();
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const html = String(body?.html ?? "");
    const title = String(body?.title ?? "").trim() || "Recipe";

    if (!html) {
      return NextResponse.json({ error: "Missing html" }, { status: 400 });
    }

    const slug = `${slugify(title)}-${Date.now().toString(36)}`;
    const dir = `archive/${slug}`;

    // Save HTML
    const { url: htmlUrl } = await put(
      `${dir}/index.html`,
      new Blob([html], { type: "text/html" }),
      { access: "public", addRandomSuffix: false }
    );

    // Save metadata (optional but useful)
    const meta = { title, addedAt: stamp(), htmlUrl, slug };
    await put(
      `${dir}/meta.json`,
      new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" }),
      { access: "public", addRandomSuffix: false }
    );

    // IMPORTANT: return the exact key your client expects
    const url = `/archive/${encodeURIComponent(slug)}`;

    return NextResponse.json(
      { ok: true, url, slug, htmlUrl }, // <-- url included
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
