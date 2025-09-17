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

// Fetch the index from your API (works in prod & preview)
async function getIndex(): Promise<Row[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  try {
    const r = await fetch(`${base}/api/recipes`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return Array.isArray(j?.recipes) ? (j.recipes as Row[]) : [];
  } catch {
    try {
      const r2 = await fetch("/api/recipes", { cache: "no-store" } as any);
      if (!r2.ok) return [];
      const j2 = await r2.json();
      return Array.isArray(j2?.recipes) ? (j2.recipes as Row[]) : [];
    } catch {
      return [];
    }
  }
}

// ----- Next 15: async params typing -----
export async function generateMetadata(
  props: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await props.params;
  return {
    title: `Recipe – ${slug}`,
    description: `Recipe detail for ${slug}`,
  };
}

export default async function RecipePage(
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params;

  const rows = await getIndex();
  const row = rows.find((r) => r.slug === slug);

  if (!row) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Recipe not found</h1>
        <p className="mt-2 text-slate-600">
          We couldn&apos;t locate a recipe for “{slug}”.
        </p>
        <a
          href="/archive"
          className="mt-6 inline-block rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Go to Archive
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {row.title ?? slug}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Added {new Date(row.createdAt).toLocaleString()}
        </p>
      </header>

      <section className="prose prose-slate max-w-none">
        {row.urlHtml ? (
          <iframe
            title={`${row.title ?? slug} source`}
            src={row.urlHtml}
            className="w-full h-[80vh] rounded-lg border"
          />
        ) : row.urlJson ? (
          <pre className="overflow-auto rounded-lg border bg-slate-50 p-4 text-xs">
            {JSON.stringify({ urlJson: row.urlJson, query: row.query }, null, 2)}
          </pre>
        ) : (
          <p>No source URL available for this recipe.</p>
        )}
      </section>

      <footer className="mt-10">
        <a
          href="/archive"
          className="inline-block rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Back to Archive
        </a>
      </footer>
    </main>
  );
}
