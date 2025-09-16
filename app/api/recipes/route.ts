// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

type Row = {
  slug: string;
  title: string;
  query: string | null;
  createdAt: number;
  urlHtml: string | null;
  urlJson: string | null;
};

const toTs = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const stemFromPath = (p: string) => {
  const m = p.match(/^recipes\/(.+?)\.(html|json)$/i);
  return m ? m[1] : null;
};

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // index by stem
    const htmlByStem = new Map<string, (typeof blobs)[number]>();
    const jsonByStem = new Map<string, (typeof blobs)[number]>();

    for (const b of blobs) {
      const stem = stemFromPath(b.pathname);
      if (!stem) continue;
      if (b.pathname.endsWith(".html")) htmlByStem.set(stem, b);
      else if (b.pathname.endsWith(".json")) jsonByStem.set(stem, b);
    }

    // build rows (light touch; don't let one failure block all)
    const rows: Row[] = await Promise.all(
      Array.from(new Set([...htmlByStem.keys(), ...jsonByStem.keys()])).map(
        async (stem) => {
          const html = htmlByStem.get(stem) || null;
          const json = jsonByStem.get(stem) || null;

          let title = stem;
          let query: string | null = null;
          let createdAt = toTs((html as any)?.uploadedAt || (json as any)?.uploadedAt);

          if (json?.url) {
            try {
              const r = await fetch(json.url, { cache: "no-store" });
              if (r.ok) {
                const j = await r.json();
                if (typeof j?.title === "string" && j.title.trim()) title = j.title.trim();
                if (typeof j?.query === "string") query = j.query;
                if (j?.createdAt) createdAt = toTs(j.createdAt);
              }
            } catch {
              // ignore sidecar fetch failures
            }
          }

          return {
            slug: stem,
            title,
            query,
            createdAt,
            urlHtml: html?.url ?? null,
            urlJson: json?.url ?? null,
          };
        }
      )
    );

    // newest-first
    rows.sort((a, b) => b.createdAt - a.createdAt);

    return new Response(JSON.stringify({ recipes: rows }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response("Failed to list recipes", { status: 500 });
  }
}
