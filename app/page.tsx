// app/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function Page() {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [htmlDoc, setHtmlDoc] = React.useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setHtmlDoc(null);

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
      if (typeof data?.html === 'string') {
        setHtmlDoc(data.html);
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Model did not return a complete HTML document.');
      }
    } catch (e: any) {
      setError(e?.message || 'Request failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {/* Header – unchanged look */}
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

      {/* Card with input + buttons – preserve sizing/feel */}
      <main className="mx-auto w-full max-w-4xl px-4 py-6 flex-1">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 sm:p-6">
          <label htmlFor="query" className="sr-only">Describe what to fetch</label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lemon pasta"
            className="w-full h-40 resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-lg leading-relaxed placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !query.trim()}
              className="w-full rounded-xl bg-indigo-600 text-white py-3 text-lg font-semibold shadow-sm disabled:opacity-50"
            >
              {loading ? 'Working…' : 'Generate'}
            </button>

            {/* Save button kept, but disabled until you wire /api/archive */}
            <button
              disabled
              className="w-full rounded-xl bg-neutral-100 text-neutral-500 py-3 text-lg font-semibold border border-neutral-200 opacity-60 cursor-not-allowed"
            >
              Save
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {/* Preview (iframe) */}
          {htmlDoc && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
              <iframe
                title="Recipe Preview"
                srcDoc={htmlDoc}
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="w-full"
                style={{ height: '1200px' }} // adjust if you want a taller preview
              />
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 text-neutral-500">
          © 2025 FreshRecipes
        </div>
      </footer>
    </div>
  );
}
