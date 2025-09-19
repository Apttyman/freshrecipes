// app/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';

type Section = { heading: string; html: string };
type Recipe = {
  id: string | number;
  title: string;
  author?: string;
  sections: Section[];
  imageUrl?: string | null;
};

export default function Page() {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Dual-output holders (server may return either)
  const [htmlDoc, setHtmlDoc] = React.useState<string | null>(null);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);

  const hasContent = !!htmlDoc || recipes.length > 0;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setHtmlDoc(null);
    setRecipes([]);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Request failed (${res.status}).`);
      }

      const data = await res.json();

      // Case 1: full HTML document (string)
      if (typeof data?.html === 'string' && data.html.includes('<html')) {
        setHtmlDoc(data.html);
        setRecipes([]);
        return;
      }

      // Case 2: structured JSON recipes
      if (Array.isArray(data?.recipes) && data.recipes.length > 0) {
        setRecipes(data.recipes);
        setHtmlDoc(null);
        return;
      }

      throw new Error('Model did not return a complete HTML document. Check your model/keys.');
    } catch (e: any) {
      setError(e?.message || 'Request failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!hasContent) return;

    try {
      setLoading(true);
      setError(null);

      const payload = htmlDoc
        ? { kind: 'html', html: htmlDoc, query }
        : { kind: 'recipes', recipes, query };

      const r = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(txt || `Save failed (${r.status}).`);
      }
    } catch (e: any) {
      setError(e?.message || 'Save failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-neutral-900 flex flex-col">
      {/* HEADER — keep exactly this look */}
      <header className="w-full border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-300 via-orange-200 to-purple-300 shadow-inner" />
            <span className="font-serif text-2xl">FreshRecipes</span>
          </div>
          <Link
            href="/archive"
            className="rounded-full bg-neutral-900 text-white px-5 py-2 text-base font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            Archive
          </Link>
        </div>
      </header>

      {/* MAIN CARD — spacing, textarea, buttons */}
      <main className="mx-auto w-full max-w-4xl px-4 py-6 flex-1">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 sm:p-6">
          <label htmlFor="query" className="sr-only">
            Describe what to fetch
          </label>

          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what to fetch"
            className="w-full h-40 resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-lg leading-relaxed placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !query.trim()}
              className="w-full rounded-2xl bg-indigo-600 text-white py-4 text-xl font-semibold shadow-sm disabled:opacity-50"
            >
              {loading ? 'Working…' : 'Generate'}
            </button>

            <button
              onClick={handleSave}
              disabled={!hasContent || loading}
              className="w-full rounded-2xl bg-neutral-100 text-neutral-500 py-4 text-xl font-semibold border border-neutral-200 disabled:opacity-50"
            >
              Save
            </button>
          </div>

          {/* ERROR BANNER — same style as your screenshot */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-base">
              <span className="font-semibold">Error:</span>{' '}
              {error}
            </div>
          )}

          {/* PREVIEW */}
          <div className="mt-6">
            {htmlDoc && (
              <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
                <iframe
                  title="Recipe Preview"
                  srcDoc={htmlDoc}
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  className="w-full"
                  style={{ height: '1200px' }}
                />
              </div>
            )}

            {!htmlDoc && recipes.length > 0 && (
              <div className="space-y-6">
                {recipes.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="font-serif text-3xl mb-1">{r.title}</h2>
                    {r.author ? (
                      <p className="text-neutral-500 mb-4">{r.author}</p>
                    ) : null}

                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageUrl}
                        alt={r.title}
                        className="w-full rounded-xl border border-neutral-200 mb-4 object-cover"
                      />
                    ) : null}

                    {r.sections.map((s, i) => (
                      <section key={i} className="mt-4">
                        <h3 className="font-semibold text-xl mb-2">{s.heading}</h3>
                        <div
                          className="prose max-w-none prose-headings:font-semibold"
                          dangerouslySetInnerHTML={{ __html: s.html }}
                        />
                      </section>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER — unchanged */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 text-neutral-500">
          © 2025 FreshRecipes
        </div>
      </footer>
    </div>
  );
}
