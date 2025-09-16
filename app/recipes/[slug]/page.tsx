// app/recipes/[slug]/page.tsx
import type { Metadata } from "next";

type Row = {
  slug: string;
  title: string;
  query: string | null;
  createdAt: number;
  urlHtml: string | null;
  urlJson: string | null;
};

type Sidecar = {
  stem: string;
  slug: string;
  title: string;
  chef: string | null;
  query: string | null;
  images: Array<{ src: string; alts?: string[]; referer?: string | null }>;
  createdAt: string;
  htmlUrl: string;
};

export const runtime = "nodejs";

function proxy(u: string, p?: string | null) {
  const base = `/api/img?u=${encodeURIComponent(u)}`;
  return p ? `${base}&p=${encodeURIComponent(p)}` : base;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return {
    title: `Recipe – ${params.slug}`,
  };
}

async function getIndex(): Promise<Row[]> {
  const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/recipes`, {
    cache: "no-store",
  }).catch(() => fetch("/api/recipes", { cache: "no-store" } as any));
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j?.recipes) ? (j.recipes as Row[]) : [];
}

async function getSidecar(row: Row): Promise<Sidecar | null> {
  if (!row.urlJson) return null;
  try {
    const r = await fetch(row.urlJson, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Sidecar;
  } catch {
    return null;
  }
}

async function getHtml(row: Row): Promise<string | null> {
  if (!row.urlHtml) return null;
  try {
    const r = await fetch(row.urlHtml, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function firstImg(html: string | null): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=(?:"|')?([^"'>\s)]+)(?:"|')?[^>]*>/i);
  return m?.[1] ?? null;
}

export default async function RecipePage({
  params,
}: {
  params: { slug: string };
}) {
  const rows = await getIndex();
  const row = rows.find((r) => r.slug === params.slug);
  if (!row) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-slate-600">
        Recipe not found.
      </div>
    );
  }

  const sidecar = await getSidecar(row);
  const html = !sidecar ? await getHtml(row) : null;

  const title = sidecar?.title || row.title || row.slug;
  const chef = sidecar?.chef || null;
  const createdAt = new Date(sidecar?.createdAt || row.createdAt).toLocaleString();
  const heroSrc =
    (sidecar?.images?.[0]?.src as string | undefined) ||
    firstImg(html) ||
    null;
  const heroReferer =
    (sidecar?.images?.[0]?.referer as string | undefined) || null;
  const heroAlts =
    (sidecar?.images?.[0]?.alts as string[] | undefined) || [];

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_800px_at_110%_-10%,rgba(46,91,255,.08),transparent_60%),radial-gradient(900px_700px_at_-10%_0%,rgba(20,184,166,.06),transparent_60%),linear-gradient(#fafbfc,#f7f8fb)]">
      {/* Header */}
      <header className="relative z-10 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-teal-400 shadow-sm" />
            <span className="text-sm font-semibold tracking-wide text-slate-800">
              FreshRecipes
            </span>
          </div>
          <a
            href="/archive"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Archive
          </a>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <div className="mt-1 text-sm text-slate-500">
            {chef ? <>By {chef} · </> : null}
            <span>{createdAt}</span>
          </div>

          {heroSrc && (
            <figure className="mt-6">
              <img
                src={proxy(heroSrc, heroReferer || sidecar?.htmlUrl || row.urlHtml || undefined)}
                data-alts={heroAlts
                  .map((a) => proxy(a, heroReferer || undefined))
                  .join(",")}
                alt={title}
                loading="lazy"
                decoding="async"
                className="w-full rounded-xl"
              />
              <figcaption className="mt-2 text-center text-xs text-slate-500">
                Image via source · loaded through proxy
              </figcaption>
            </figure>
          )}

          {/* Render body: prefer your original HTML if you want to preserve rich layout */}
          {html ? (
            <div
              className="prose prose-slate mt-8 max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <section className="mt-8 text-slate-600">
              <p>
                Full structured content is stored in sidecar JSON. You can extend
                this template to render ingredients, steps, and additional images
                from <code>sidecar.images</code>.
              </p>
            </section>
          )}
        </article>
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-center md:flex-row md:text-left">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} FreshRecipes. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 text-sm">
            {row.urlHtml && (
              <a
                className="text-slate-500 hover:text-slate-700"
                href={row.urlHtml}
                target="_blank"
                rel="noreferrer"
              >
                Open Blob
              </a>
            )}
          </nav>
        </div>
      </footer>

      {/* One-time inline fallback script for alternates */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          document.querySelectorAll('img[data-alts]').forEach(img=>{
            const alts=(img.dataset.alts||'').split(',').map(s=>s.trim()).filter(Boolean);
            let i=0;
            img.addEventListener('error', ()=>{ if(i<alts.length){ img.src = alts[i++]; }});
          });
        `,
        }}
      />
    </div>
  );
}
