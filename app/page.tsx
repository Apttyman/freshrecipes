// app/page.tsx
'use client';

import React from 'react';

export default function HomePage() {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const q = query.trim();
    if (!q) {
      setError('Please enter what to fetch.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      // The route should return a complete HTML document (string).
      // We read it as text and validate.
      const text = await res.text();

      if (!res.ok) {
        // Keep the original error style/wording you wanted
        setError(
          text && text.length < 400
            ? text
            : 'Model did not return a complete HTML document. Check your model/keys.'
        );
      } else {
        // Minimal check that it’s a full HTML document
        const looksLikeHTMLDoc =
          /<!doctype html/i.test(text) || /<html[\s>]/i.test(text);

        if (!looksLikeHTMLDoc) {
          setError('Model did not return a complete HTML document.');
        } else {
          // Open the generated HTML in a new tab so we don’t pollute this page
          const blob = new Blob([text], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err) {
      setError('Request failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // Shared, uniform button styles (no clsx, no external deps)
  const primaryButton =
    'w-full select-none rounded-xl bg-[#4F5BFF] px-6 py-4 text-center text-base font-semibold text-white shadow-sm transition hover:brightness-110 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed';
  const card =
    'mx-auto w-full max-w-3xl rounded-2xl border border-black/10 bg-white p-5 shadow-sm';
  const label =
    'mb-2 block text-[15px] font-medium text-black/70';
  const textarea =
    'w-full rounded-xl border border-black/15 bg-white/90 px-4 py-3 text-[16px] leading-6 text-black placeholder-black/30 outline-none focus:ring-4 focus:ring-[#4F5BFF]/20 min-h-[160px]';

  return (
    <main className="px-4 pb-16 pt-6">
      {/* Single centered card with input + generate */}
      <section className={card}>
        <form onSubmit={onSubmit} className="space-y-5">
          <label htmlFor="query" className={label}>
            Describe what to fetch (e.g., ‘3 Michelin chef pasta recipes with step photos’)
          </label>

          <textarea
            id="query"
            className={textarea}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 3 Food52-style salad recipes with step photos"
          />

          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </form>
      </section>

      {/* Error card (styled, no raw text) */}
      {error && (
        <div className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-red-300/80 bg-red-50 px-4 py-3 text-[15px] text-red-800">
          <span className="font-semibold">Error:</span>{' '}
          {error}
        </div>
      )}
    </main>
  );
}
