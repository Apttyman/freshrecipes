'use client';

import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { formatForDisplay } from './lib/html-tools';

type GeneratedSection = {
  heading?: string;
  body?: string;          // raw text from model
  bodyHtml?: string;      // sometimes the model returns HTML
  imageUrl?: string | null;
};

type GeneratedRecipe = {
  id: string;
  title: string;
  subtitle?: string | null;
  chef?: string | null;
  heroImage?: string | null;
  sections: GeneratedSection[];
};

type GenerateResponse =
  | { recipes: GeneratedRecipe[] }
  | { error: string };

export default function Page(): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);
  const requestIdRef = useRef<number>(0);

  // log helper
  const pushLog = useCallback((line: string) => {
    setLog(prev => [line, ...prev].slice(0, 200));
  }, []);

  const onGenerate = useCallback(async (): Promise<void> => {
    const q = query.trim();
    if (!q) {
      pushLog('✖ Error: Please type a request first.');
      return;
    }
    setBusy(true);
    const rid = ++requestIdRef.current;
    try {
      const url = `/api/generate?_=${Date.now()}`;
      pushLog(`→ POST ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        pushLog(`✖ ${res.status} ${text || res.statusText}`);
        setBusy(false);
        return;
      }

      const data = (await res.json()) as GenerateResponse;
      if ('error' in data) {
        pushLog(`✖ Error: ${data.error}`);
        setBusy(false);
        return;
      }

      // ensure IDs (stable per render)
      const withIds = data.recipes.map((r, idx) => ({
        ...r,
        id: r.id || `r_${Date.now()}_${idx}`,
        sections: Array.isArray(r.sections) ? r.sections : [],
      }));
      setRecipes(withIds);
      pushLog(`✓ Received ${withIds.length} recipe(s).`);
    } catch (err) {
      pushLog(`✖ Error: ${(err as Error)?.message || 'Generation failed'}`);
    } finally {
      if (requestIdRef.current === rid) setBusy(false);
    }
  }, [query, pushLog]);

  const onCopyAll = useCallback(() => {
    if (!recipes.length) return;
    const plain = recipes
      .map(r => {
        const header = `${r.title}${r.subtitle ? ` — ${r.subtitle}` : ''}`;
        const chef = r.chef ? `Chef: ${r.chef}` : '';
        const sections = r.sections
          .map(s => {
            const h = s.heading ? `\n\n${s.heading}\n` : '\n\n';
            const raw = s.bodyHtml || s.body || '';
            return h + String(raw).replace(/<\/?[^>]+(>|$)/g, ''); // quick strip for copy
          })
          .join('');
        return [header, chef, sections].filter(Boolean).join('\n');
      })
      .join('\n\n––––––––––––––––––––\n\n');
    navigator.clipboard.writeText(plain).catch(() => {});
    pushLog('✓ Copied all to clipboard.');
  }, [recipes, pushLog]);

  const onSaveAllToArchive = useCallback(async () => {
    if (!recipes.length) return;
    try {
      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes }),
      });
      if (!res.ok) throw new Error(res.statusText);
      pushLog('✓ Saved all to archive.');
    } catch (e) {
      pushLog(`✖ Error archiving: ${(e as Error).message}`);
    }
  }, [recipes, pushLog]);

  // ONE highlight button per recipe – grabs selection inside that card.
  const saveHighlight = useCallback(async (recipeId: string) => {
    const sel = window.getSelection?.();
    const text = (sel && sel.toString().trim()) || '';
    if (!text) {
      pushLog('✖ Select some text inside the recipe card first.');
      return;
    }
    try {
      const res = await fetch('/api/highlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, text }),
      });
      if (!res.ok) throw new Error(res.statusText);
      pushLog('✓ Highlight saved.');
    } catch (e) {
      pushLog(`✖ Error saving highlight: ${(e as Error).message}`);
    }
  }, [pushLog]);

  const rendered = useMemo(() => {
    return recipes.map((r) => {
      return (
        <article
          key={r.id}
          className="rounded-2xl border border-neutral-200 bg-white shadow-sm mb-8 overflow-hidden"
        >
          <div className="p-6 md:p-8">
            <header className="mb-4">
              <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">
                {r.title}
              </h2>
              {r.subtitle ? (
                <p className="text-neutral-500 mt-1">{r.subtitle}</p>
              ) : null}
              {r.chef ? (
                <p className="text-neutral-700 mt-2"><span className="font-medium">Chef:</span> {r.chef}</p>
              ) : null}
            </header>

            {r.heroImage ? (
              <div className="mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.heroImage}
                  alt={r.title}
                  className="w-full h-auto rounded-lg object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-6">
              {r.sections.map((s, i) => {
                const heading = s.heading?.trim();
                const raw = s.bodyHtml ?? s.body ?? '';
                const html = formatForDisplay(raw);
                return (
                  <section key={`${r.id}_s_${i}`}>
                    {heading ? (
                      <h3 className="text-xl md:text-2xl font-semibold mb-2">{heading}</h3>
                    ) : null}
                    <div
                      className="prose prose-neutral max-w-none"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                    {s.imageUrl ? (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.imageUrl}
                          alt={heading || r.title}
                          className="w-full h-auto rounded-md"
                        />
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>

            {/* ONE save button per recipe */}
            <div className="mt-6 flex justify-start">
              <button
                type="button"
                onClick={() => saveHighlight(r.id)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 active:scale-[0.99] transition"
                aria-label="Save selected text from this recipe as a highlight"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M6 2h12a2 2 0 0 1 2 2v17.5a.5.5 0 0 1-.79.407L12 17.25l-7.21 4.657A.5.5 0 0 1 4 21.5V4a2 2 0 0 1 2-2z"/>
                </svg>
                Save highlight
              </button>
            </div>
          </div>
        </article>
      );
    });
  }, [recipes, saveHighlight]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">FreshRecipes</h1>
      <p className="text-neutral-600 mb-6">Type a natural-language request. We’ll fetch and format it.</p>

      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className="rounded-2xl bg-black text-white px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>

        <button
          type="button"
          onClick={onCopyAll}
          disabled={!recipes.length}
          className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          Copy all
        </button>

        <button
          type="button"
          onClick={onSaveAllToArchive}
          disabled={!recipes.length}
          className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          Save all to archive
        </button>
      </div>

      <label htmlFor="query" className="sr-only">Request</label>
      <textarea
        id="query"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
        placeholder="e.g., 3 chicken recipes"
        rows={4}
        className="w-full mb-6 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-neutral-800"
      />

      <h2 className="text-2xl font-extrabold tracking-tight mb-4">Preview</h2>
      <div aria-live="polite">
        {recipes.length ? rendered : (
          <p className="text-neutral-500">No recipes yet. Try typing a request above.</p>
        )}
      </div>

      {/* Request log */}
      <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="font-semibold mb-2">Request log</div>
        <ul className="space-y-1">
          {log.map((line, i) => (
            <li key={i} className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
