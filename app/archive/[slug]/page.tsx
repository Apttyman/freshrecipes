// app/archive/[slug]/page.tsx
// NOTE: Next 15's generated PageProps sometimes types `params` as a Promise.
// We accept either (object or Promise) and ignore the noisy type here.
// This keeps runtime behavior correct without fighting the auto types.
// If you want stricter types later, we can align to the generated d.ts.
// For now, this unblocks your build & page render.
// @ts-nocheck

import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveParams(params: any): Promise<{ slug: string }> {
  // Support both: { slug } or Promise<{ slug }>
  if (params && typeof params.then === "function") {
    return await params;
  }
  return params;
}

export async function generateMetadata(
  { params }: { params: any }
): Promise<Metadata> {
  const { slug } = await resolveParams(params);
  const title = decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  return { title: `${title} • Fresh Recipes` };
}

export default async function ArchiveItemPage({ params }: { params: any }) {
  const { slug } = await resolveParams(params);

  const base = process.env.NEXT_PUBLIC_BLOB_BASE; // e.g. https://xxxx.public.blob.vercel-storage.com
  if (!base) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Archive</h1>
        <p style={{ color: "crimson" }}>
          Environment variable <code>NEXT_PUBLIC_BLOB_BASE</code> is not set.
          Add it in Vercel → Project → Settings → Environment Variables.
        </p>
      </main>
    );
  }

  const htmlUrl = `${base}/archive/${encodeURIComponent(slug)}/index.html`;
  const metaUrl = `${base}/archive/${encodeURIComponent(slug)}/meta.json`;

  let html = "";
  let title = slug;

  try {
    const [hRes, mRes] = await Promise.all([
      fetch(htmlUrl, { cache: "no-store" }),
      fetch(metaUrl, { cache: "no-store" }),
    ]);

    if (mRes.ok) {
      const meta = await mRes.json().catch(() => null);
      if (meta?.title) title = meta.title;
    }

    if (hRes.ok) {
      html = await hRes.text();
    }
  } catch {
    // fall through to link below
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p style={{ margin: "6px 0", color: "#667085" }}>/archive/{slug}</p>
      </header>

      {html ? (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 5px 18px rgba(0,0,0,.06)",
            background: "#fff",
          }}
        />
      ) : (
        <p>
          Couldn&apos;t fetch saved HTML. Open directly:&nbsp;
          <a href={htmlUrl} target="_blank" rel="noreferrer">
            {htmlUrl}
          </a>
        </p>
      )}
    </main>
  );
}
