'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({
  weight: ['400', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-playfair',
});

/* =========================
   Types
   ========================= */
type RecipeSection = {
  heading?: string | null;
  html?: string; // already-safe HTML string
};

type GeneratedRecipe = {
  id: string;
  title: string;
  subtitle?: string | null;
  chef?: string | null;
  heroImage?: string | null;
  sections: RecipeSection[];
};

/* =========================
   Helpers
   ========================= */

// Accepts: [...], {recipes:[...]}, {data:{recipes:[...]}}
function extractRecipes(payload: any): GeneratedRecipe[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.recipes)) return payload.recipes;
  if (payload.data && Array.isArray(payload.data.recipes)) return payload.data.recipes;
  return [];
}

// Turn literal "\n" that sometimes comes from LLMs into real newlines
function debackslash(str: string | null | undefined): string {
  if (!str) return '';
  return String(str).replace(/\\n/g, '\n').replace(/\r/g, '');
}

// Very small HTML sanitizer for known-safe snippet usage.
// (If your API already sends safe HTML, you can keep this minimal.)
function safeHTML(s: string): string {
  // prevent accidental <script> tags if any text sneaks in
  return s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}

function nowId(prefix = 'r'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* =========================
   Component
   ========================= */
export default function Page() {
  const [query, setQuery] = useState('');
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 200));
  }, []);

  const onGenerate = useCallback(async () => {
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
        return;
      }

      const payload: any = await res.json().catch(() => null);

      if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
        pushLog(`✖ Error: ${payload.error}`);
        return;
      }

      const list = extractRecipes(payload);
      if (!list.length) {
        pushLog('✖ Error: API returned no recipes (unexpected response shape).');
        return;
      }

      const normalized: GeneratedRecipe[] = list.map((r: any, i: number) => ({
        id: r.id || nowId('r'),
        title: r.title ? debackslash(r.title) : 'Untitled',
        subtitle: r.subtitle ? debackslash(r.subtitle) : null,
        chef: r.chef ? debackslash(r.chef) : null,
        heroImage: r.heroImage || null,
        sections: Array.isArray(r.sections)
          ? r.sections.map((s: any) => ({
              heading: s?.heading ? debackslash(s.heading) : null,
              html: s?.html ? safeHTML(debackslash(s.html)) : '',
            }))
          : [],
      }));

      setRecipes(normalized);
      pushLog(`✓ Received ${normalized.length} recipe(s).`);
    } catch (err) {
      pushLog(`✖ Error: ${(err as Error)?.message || 'Generation failed'}`);
    } finally {
      if (requestIdRef.current === rid) setBusy(false);
    }
  }, [query, pushLog]);

  const onCopyAll = useCallback(async () => {
    if (!recipes.length) return;
    const text = recipes
      .map((r) => {
        const sectionText = (r.sections || [])
          .map((s) => [s.heading ? `\n${s.heading}\n` : '', s.html ? s.html.replace(/<[^>]+>/g, '') : ''].join(''))
          .join('\n');
        return `# ${r.title}\n${r.subtitle || ''}\n${r.chef ? `Chef: ${r.chef}\n` : ''}${sectionText}`.trim();
      })
      .join('\n\n---\n\n');

    await navigator.clipboard.writeText(text);
    pushLog('✓ Copied all recipes to clipboard.');
  }, [recipes, pushLog]);

  const onSaveAll = useCallback(async () => {
    if (!recipes.length) return;
    try {
      const url = `/api/archive?_=${Date.now()}`;
      pushLog(`→ POST ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        pushLog(`✖ ${res.status} ${t || res.statusText}`);
        return;
      }
      pushLog('✓ Saved all recipes to archive.');
    } catch (e) {
      pushLog(`✖ Error: ${(e as Error)?.message || 'Archive failed'}`);
    }
  }, [recipes, pushLog]);

  const saveOne = useCallback(
    async (recipe: GeneratedRecipe) => {
      try {
        const url = `/api/archive?_=${Date.now()}`;
        pushLog(`→ POST ${url} (single)`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipes: [recipe] }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          pushLog(`✖ ${res.status} ${t || res.statusText}`);
          return;
        }
        pushLog(`✓ Saved "${recipe.title}" to archive.`);
      } catch (e) {
        pushLog(`✖ Error: ${(e as Error)?.message || 'Save failed'}`);
      }
    },
    [pushLog]
  );

  const header = useMemo(
    () => (
      <header className="mb-6">
        <h1
          className={`${playfair.variable} font-serif text-5xl md:text-6xl font-extrabold leading-tight tracking-tight`}
          style={{ fontFamily: 'var(--font-playfair), ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          FreshRecipes
        </h1>
        <p className="mt-2 text-zinc-600">Type a natural-language request. We’ll fetch and format it.</p>
      </header>
    ),
    []
  );

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      {header}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onGenerate}
          disabled={busy}
          className="rounded-xl bg-black px-5 py-3 text-white font-semibold disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>

        <button
          onClick={onCopyAll}
          disabled={!recipes.length}
          className="rounded-xl border px-5 py-3 font-semibold disabled:opacity-50"
        >
          Copy all
        </button>

        <button
          onClick={onSaveAll}
          disabled={!recipes.length}
          className="rounded-xl border px-5 py-3 font-semibold disabled:opacity-50"
        >
          Save all to archive
        </button>
      </div>

      <div className="mt-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Two chicken recipes with bright, modern plating"
          className="w-full rounded-2xl border px-4 py-3 min-h-[140px] focus:outline-none focus:ring"
        />
      </div>

      <h2 className="mt-8 mb-3 text-2xl font-bold">Preview</h2>

      {!recipes.length && (
        <p className="text-zinc-500">No recipes yet. Try typing a request above.</p>
      )}

      <div className="flex flex-col gap-6">
        {recipes.map((r) => (
          <article key={r.id} className="rounded-3xl border bg-white p-5 shadow-sm">
            {/* Title + optional chef/subtitle */}
            <div className="mb-4">
              <h3
                className={`${playfair.variable} font-serif text-3xl md:text-4xl font-extrabold`}
                style={{ fontFamily: 'var(--font-playfair), ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}
              >
                {r.title}
              </h3>
              {r.subtitle ? (
                <p className="mt-1 text-zinc-600">{r.subtitle}</p>
              ) : null}
              {r.chef ? (
                <p className="mt-1 text-zinc-500 italic">Chef: {r.chef}</p>
              ) : null}
            </div>

            {/* Optional hero image */}
            {r.heroImage ? (
              <div className="mb-4 overflow-hidden rounded-2xl border">
                <img src={r.heroImage} alt="" className="h-auto w-full object-cover" />
              </div>
            ) : null}

            {/* Sections (render as safe HTML) */}
            <div className="flex flex-col gap-5">
              {r.sections.map((s, idx) => (
                <section key={idx} className="rounded-2xl border p-4">
                  {s.heading ? (
                    <h4 className="mb-2 text-xl font-bold">{s.heading}</h4>
                  ) : null}
                  {s.html ? (
                    <div
                      className="prose max-w-none whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: safeHTML(debackslash(s.html)) }}
                    />
                  ) : null}
                </section>
              ))}
            </div>

            {/* ONE save button per recipe */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => saveOne(r)}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 font-semibold"
              >
                <span aria-hidden>🔖</span> Save highlight
              </button>
            </div>
          </article>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-xl font-bold">Request log</h2>
      <div className="rounded-2xl border bg-white p-4 font-mono text-sm leading-6 whitespace-pre-wrap">
        {log.length ? log.join('\n') : '—'}
      </div>
    </main>
  );
}
