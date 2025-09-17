import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  slug: string;
  title: string;
  description?: string | null;
  query: string | null;
  createdAt: number;
  urlHtml: string | null;
  urlJson: string | null;
};

const BLOB_PUBLIC_BASE = process.env.BLOB_PUBLIC_BASE?.replace(/\/+$/, "") || "";

function toEpoch(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  if (v instanceof Date) return v.getTime();
  const t = new Date(v as any).getTime();
  return Number.isFinite(t) ? t : 0;
}

function blobUrl(b: { pathname: string } & Record<string, any>): string {
  if (b && typeof b.url === "string" && b.url.length > 0) return b.url as string;
  if (BLOB_PUBLIC_BASE) return `${BLOB_PUBLIC_BASE}/${b.pathname}`;
  return `/${b.pathname}`;
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_RW;
  if (!token) return NextResponse.json({ recipes: [] as Row[] }, { status: 200 });

  try {
    const { list } = await import("@vercel/blob");
    const res = await list({ token, prefix: "recipes/" });

    const pages = res.blobs.filter((b: any) => String(b.pathname).endsWith(".html"));
    const meta  = res.blobs.filter((b: any) => String(b.pathname).endsWith(".json"));

    pages.sort((a: any, b: any) => toEpoch(b.uploadedAt) - toEpoch(a.uploadedAt));

    const rows: Row[] = await Promise.all(
      pages.map(async (p: any) => {
        const base = String(p.pathname).replace(/^recipes\//, "").replace(/\.html$/, "");
        const sidecarPath = `recipes/${base}.json`;
        const sidecar = meta.find((m: any) => String(m.pathname) === sidecarPath);

        let description: string | null = null;
        let query: string | null = null;

        if (sidecar) {
          try {
            const url = blobUrl(sidecar);
            const r = await fetch(url, { cache: "no-store" });
            if (r.ok) {
              const j = (await r.json().catch(() => null)) as { description?: string; query?: string } | null;
              description = j?.description ?? null;
              query = j?.query ?? null;
            }
          } catch { /* ignore */ }
        }

        return {
          slug: base,
          title: decodeURIComponent(base).replace(/[-_]/g, " "),
          description,
          query,
          createdAt: toEpoch(p.uploadedAt) || Date.now(),
          urlHtml: blobUrl(p),
          urlJson: sidecar ? blobUrl(sidecar) : null
        };
      })
    );

    return NextResponse.json({ recipes: rows }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ recipes: [] as Row[], _error: String(err) }, { status: 200 });
  }
}
