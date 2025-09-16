// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

const toTs = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Index by stem (same base name for .html and .json)
    const htmlFiles = new Map<string, any>();
    const metaFiles = new Map<string, any>();

    for (const b of blobs) {
      const m = b.pathname.match(/^recipes\/(.+)\.(html|json)$/i);
      if (!m) continue;
      const stem = m[1];
      if (m[2] === "html") htmlFiles.set(stem, b);
      else metaFiles.set(stem, b);
    }

    const rows: {
      key: string;
      url: string;
      uploadedAt: number;
      description: string; // the original query
    }[] = [];

    // build rows, newest-first
    for (const [stem, html] of htmlFiles) {
      const meta = metaFiles.get(stem);
      let description = "";

      if (meta?.url) {
        try {
          const res = await fetch(meta.url, { cache: "no-store" });
          if (res.ok) {
            const j = (await res.json()) as { query?: string };
            if (typeof j?.query === "string") description = j.query.trim();
          }
        } catch {
          // ignore
        }
      }

      rows.push({
        key: html.pathname,
        url: html.url,
        uploadedAt: toTs(html.uploadedAt as any),
        description,
      });
    }

    rows.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return new Response(JSON.stringify({ recipes: rows }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response("Failed to list recipes", { status: 500 });
  }
}
