// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN is not set" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as any;
    const html = String(body?.html ?? "");
    const slug = String(body?.slug ?? "").trim() || "recipe";

    if (!html) {
      return NextResponse.json(
        { error: "Missing html" },
        { status: 400 }
      );
    }

    // Save HTML and a tiny JSON sidecar
    const ts = Date.now();
    const htmlKey = `recipes/${slug}-${ts}.html`;
    const jsonKey = `recipes/${slug}-${ts}.json`;

    await put(htmlKey, Buffer.from(html, "utf8"), {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      token,
    });

    await put(
      jsonKey,
      Buffer.from(
        JSON.stringify(
          {
            slug,
            uploadedAt: new Date(ts).toISOString(),
            kind: "recipe",
            // Link to the HTML asset
            htmlKey,
          },
          null,
          2
        ),
        "utf8"
      ),
      {
        access: "public",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        token,
      }
    );

    return NextResponse.json(
      { ok: true, slug, htmlKey, jsonKey },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err || "Save failed") },
      { status: 500 }
    );
  }
}
