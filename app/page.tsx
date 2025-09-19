'use client';

import { useState } from 'react';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultHTML, setResultHTML] = useState<string | null>(null);

  async function handleGenerate() {
    setErrorMsg(null);
    setResultHTML(null);

    const q = query.trim();
    if (!q) {
      setErrorMsg('Please enter what you want to fetch.');
      return;
    }

    try {
      setLoading(true);

      // NOTE: this keeps your /api/generate contract: POST JSON { query }
      // It accepts either a full HTML document string or a JSON with { html }.
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      // Try text first (for full HTML document responses):
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const fallback = await resp.text().catch(() => '');
        throw new Error(fallback || `Request failed (${resp.status}).`);
      }

      if (ct.includes('text/html')) {
        const html = await resp.text();
        if (!/^<!doctype html>/i.test(html) && !/^<html[\s>]/i.test(html)) {
          throw new Error('Model did not return a complete HTML document.');
        }
        setResultHTML(html);
        return;
      }

      // Otherwise expect JSON with { html } (safe fallback)
      const data = await resp.json().catch(() => null as any);
      const html = data?.html ?? null;
      if (typeof html !== 'string' || html.length < 40) {
        throw new Error('Model did not return a complete HTML document.');
      }
      setResultHTML(html);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Request failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Single, simple card — no in-page header row, no extra buttons */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <label
          htmlFor="query"
          className="mb-2 block text-sm font-medium text-neutral-700"
        >
          Describe what to fetch (e.g., ‘3 Michelin chef pasta recipes with step photos’)
        </label>

        {/* Bigger input box */}
        <textarea
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={6}
          placeholder="e.g., 3 Food52-style salad recipes with step photos"
          className="w-full resize-y rounded-xl border border-neutral-300 bg-white p-4 text-base outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
        />

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {/* Lightweight status */}
        {errorMsg && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <strong>Error:</strong> {errorMsg}
          </p>
        )}
      </section>

      {/* Render full document in an iframe to preserve styles/scripts precisely */}
      {resultHTML && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <iframe
            title="Recipe Result"
            className="h-[70vh] w-full rounded-lg border border-neutral-200"
            // Use srcDoc to display the returned full HTML safely
            srcDoc={resultHTML}
          />
        </section>
      )}
    </div>
  );
}
