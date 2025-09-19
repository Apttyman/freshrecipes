'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { formatForDisplay } from '@/app/lib/html-tools';

/**
 * NOTE ON ASSUMPTIONS (kept compatible with your current API):
 * - POST /api/generate  expects JSON { query: string } and returns either:
 *     a) { html: string }   OR
 *     b) raw HTML (text/plain)
 *   We handle both.
 * - “Save all to archive” POSTs to /api/archive with { query, html }.
 * - “Save highlight” POSTs to /api/highlight with { query, html } for ONE recipe.
 * If your endpoints are slightly different, adjust the urls or payload keys below;
 * the UI contract stays the same.
 */

type RequestLogItem = {
  method: string;
  url: string;
  status?: number;
  error?: string;
};

export default function Page() {
  const [query, setQuery] = useState('');
  const [recipesHTML, setRecipesHTML] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<RequestLogItem[]>([]);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const logRequest = useCallback((entry: RequestLogItem) => {
    setLog((l) => [entry, ...l].slice(0, 25));
  }, []);

  // --- Utilities -------------------------------------------------------------

  function splitIntoRecipes(rawHtml: string): string[] {
    // Prefer well-formed <article> wrappers (one per recipe)
    try {
      const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
      const articles = Array.from(doc.querySelectorAll('article'));
      if (articles.length > 0) {
        return articles.map((a) => a.outerHTML);
      }
    } catch {
      // fall through to heuristic
    }

    // Fallback: try a very light-weight split if authoring forgot <article>
    // Heuristic: h1/h2 sections as recipe boundaries
    const chunks = rawHtml.split(/(?=<h1\b|<h2\b)/i).map((s) => s.trim()).filter(Boolean);
    if (chunks.length > 1) {
      return chunks.map((chunk) => `<article>${chunk}</article>`);
    }

    // If nothing to split, treat as a single recipe block
    return [`<article>${rawHtml}</article>`];
  }

  function normalizeResponseText(text: string): string {
    // Some models return objects as JSON; some return pure HTML.
    // If it parses and has an `html` key, use it. Otherwise the text IS the html.
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj.html === 'string') return obj.html;
    } catch {
      /* text is plain HTML */
    }
    return text;
  }

  // --- Actions ---------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!query.trim()) return;

    setBusy(true);
    setRecipesHTML([]);
    try {
      const url = '/api/generate';
      logRequest({ method: 'POST', url });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const text = await res.text();
      const normalizedHtml = normalizeResponseText(text);

      if (!res.ok) {
        logRequest({ method: 'POST', url, status: res.status, error: normalizedHtml || 'Generation failed' });
        setBusy(false);
        return;
      }

      const parts = splitIntoRecipes(normalizedHtml);
      setRecipesHTML(parts);
      logRequest({ method: 'POST', url, status: res.status });
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err: any) {
      logRequest({ method: 'POST', url: '/api/generate', error: err?.message || 'Load failed' });
    } finally {
      setBusy(false);
    }
  }, [query, logRequest]);

  const handleCopyAll = useCallback(async () => {
    if (!recipesHTML.length) return;
    const all = recipesHTML.join('\n\n');
    await navigator.clipboard.writeText(all);
  }, [recipesHTML]);

  const handleSaveAll = useCallback(async () => {
    if (!recipesHTML.length) return;
    const url = '/api/archive';
    try {
      logRequest({ method: 'POST', url });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, html: recipesHTML.join('\n\n') }),
      });
      const msg = await res.text();
      if (!res.ok) {
        logRequest({ method: 'POST', url, status: res.status, error: msg || 'Save failed' });
        return;
      }
      logRequest({ method: 'POST', url, status: res.status });
    } catch (err: any) {
      logRequest({ method: 'POST', url, error: err?.message || 'Save failed' });
    }
  }, [recipesHTML, query, logRequest]);

  const handleSaveHighlight = useCallback(
    async (index: number) => {
      const url = '/api/highlight';
      const html = recipesHTML[index];
      try {
        logRequest({ method: 'POST', url });
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, html }),
        });
        const msg = await res.text();
        if (!res.ok) {
          logRequest({ method: 'POST', url, status: res.status, error: msg || 'Save failed' });
          return;
        }
        logRequest({ method: 'POST', url, status: res.status });
      } catch (err: any) {
        logRequest({ method: 'POST', url, error: err?.message || 'Save failed' });
      }
    },
    [recipesHTML, query, logRequest]
  );

  const renderedCards = useMemo(() => {
    return recipesHTML.map((raw, idx) => {
      const html = formatForDisplay(raw);
      return (
        <article
          key={idx}
          className="rounded-3xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/5 overflow-hidden"
        >
          <div className="p-6 sm:p-8">
            {/* the recipe body */}
            <div className="prose max-w-none prose-headings:font-playfair prose-h1:text-4xl sm:prose-h1:text-5xl prose-h2:text-2xl prose-h3:text-xl">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>

            {/* ONE Save highlight per recipe */}
            <div className="mt-6 flex">
              <button
                type="button"
                onClick={() => handleSaveHighlight(idx)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
                aria-label="Save this recipe to highlights"
              >
                {/* inline svg bookmark */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M7 3h10a1 1 0 0 1 1 1v16l-6-3-6 3V4a1 1 0 0 1 1-1z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-medium">Save highlight</span>
              </button>
            </div>
          </div>
        </article>
      );
    });
  }, [recipesHTML, handleSaveHighlight]);

  // --- UI --------------------------------------------------------------------

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">FreshRecipes</h1>
      <p className="mt-2 text-slate-600">Type a natural-language request. We’ll fetch and format it.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href="/archive"
          className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-white shadow-sm ring-1 ring-black/5 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          Open Archive
        </a>
      </div>

      <div className="mt-4">
        <label htmlFor="q" className="sr-only">
          Query
        </label>
        <textarea
          id="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 3 top-chef pasta recipes"
          rows={4}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-white shadow-sm ring-1 ring-black/5 hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>

        <button
          type="button"
          onClick={handleCopyAll}
          disabled={!recipesHTML.length}
          className="inline-flex items-center rounded-2xl bg-white px-5 py-3 text-slate-900 shadow-sm ring-1 ring-black/5 hover:bg-slate-50 disabled:opacity-50"
        >
          Copy all
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!recipesHTML.length}
          className="inline-flex items-center rounded-2xl bg-white px-5 py-3 text-slate-900 shadow-sm ring-1 ring-black/5 hover:bg-slate-50 disabled:opacity-50"
        >
          Save all to archive
        </button>
      </div>

      <section ref={previewRef} className="mt-10">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Preview</h2>

        <div className="mt-6 grid grid-cols-1 gap-6">
          {renderedCards.length > 0 ? (
            renderedCards
          ) : (
            <div className="text-slate-500">Your formatted recipes will appear here.</div>
          )}
        </div>
      </section>

      {/* Request log (developer friendly, matches your earlier UI) */}
      <section className="mt-10">
        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-lg font-semibold">Request log</summary>
          <ul className="mt-3 space-y-2 text-sm font-mono">
            {log.map((r, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-3">
                <div>
                  → {r.method} <span className="break-all">{r.url}</span>
                </div>
                {r.status && <div>＊ {r.status}</div>}
                {r.error && <div className="text-rose-600">✖ {r.error}</div>}
              </li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  );
}
