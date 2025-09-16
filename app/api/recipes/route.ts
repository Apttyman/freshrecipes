// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

type Row = {
  key: string;
  url: string;
  uploadedAt: number;
  description: string;
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

const safeText = (s: string) =>
  s.replace(/\s+/g, " ").replace(/[\u0000-\u001F]+/g, "").trim();

const extractFromHtml = (html: string): string => {
  // try <h1> first
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return safeText(h1[1].replace(/<[^>]+>/g, ""));
  // then <title>
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return safeText(title[1].replace(/<[^>]+>/g, ""));
  return "—";
};

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Partition by type
    const htmlMap = new Map<string, (typeof blobs)[number]>();
    const jsonMap = new Map<string, (typeof blobs)[number]>();

    for (const b of blobs) {
      const stem = stemFromPath(b.pathname);
      if (!stem) continue;
      if (b.pathname.endsWith(".html")) htmlMap.set(stem, b);
      else if (b.pathname.endsWith(".json")) jsonMap.set(stem, b);
    }

    // Build rows with sidecar lookup + graceful HTML fallback
    const rows: Row[] = [];
    await Promise.all(
      Array.from(htmlMap.entries()).map(async ([stem, html]) => {
        let description = "—";

        // 1) sidecar JSON -> { query }
        const meta = jsonMap.get(stem);
        if (meta?.url) {
          try {
            const r = await fetch(meta.url, { cache: "no-store" });
            if (r.ok) {
              const j = (await r.json()) as { query?: string };
              if (typeof j?.query === "string" && j.query.trim()) {
                description = safeText(j.query);
              }
            }
          } catch {
            // ignore sidecar failure, we'll fallback
          }
        }

        // 2) fallback: fetch HTML and extract <h1> or <title>
        if (description === "—" && html?.url) {
          try {
            const r2 = await fetch(html.url, { cache: "no-store" });
            if (r2.ok) {
              const txt = await r2.text();
              const desc = extractFromHtml(txt);
              if (desc) description = desc;
            }
          } catch {
            // keep "—"
          }
        }

        rows.push({
          key: html.pathname,
          url: html.url,
          uploadedAt: toTs((html as any).uploadedAt),
          description,
        });
      })
    );

    // newest-first
    rows.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return new Response(JSON.stringify({ recipes: rows }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response("Failed to list recipes", { status: 500 });
  }
}
