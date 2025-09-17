// app/api/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveBody = {
  html?: string;
  slug?: string;
  // Optional: if you also send JSON sidecar, we’ll store it when present
  json?: unknown;
};

export async function POST(req: NextRequest) {
  let slug = "";
  try {
    const body = (await req.json().catch(() => ({}))) as SaveBody;
    const html = (body.html ?? "").toString();
    slug = (body.slug ?? "").toString().trim();

    if (!html || !slug) {
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

    // Store HTML (public, no random suffix so archive is stable)
    const htmlKey = `recipes/${slug}.html`;
    const htmlBlob = await put(htmlKey, html, {
      token,
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    // Optionally store JSON sidecar if provided
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

    // htmlBlob.url is the fully-qualified public URL
    const urlHtml = htmlBlob.url;

    return NextResponse.json(
      {
        ok: true,
        slug,
        urlHtml,
        htmlKey,
        ...(jsonKey ? { jsonKey } : {}),
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Do NOT reference urlHtml here — it doesn’t exist on failure.
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
