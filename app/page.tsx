'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

/** ====== Types (kept super-forgiving) ====== */
type Recipe = {
  id?: string;
  title?: string;
  author?: string;
  imageUrl?: string;
  /** HTML string we will insert */
  html?: string;
  /** Raw text fallback (server might return this); we’ll coerce to HTML */
  text?: string;
  /** Anything else from the server is ignored */
  [k: string]: unknown;
};

type GenerateResponse = {
  recipes?: Recipe[]; // server may or may not send this
  // allow other keys silently
  [k: string]: unknown;
};

/** ====== Helpers ====== */

/** Very small/strict “markdown-ish” fixer:
 *  - turns `![alt](url)` into <img>
 *  - converts double-newlines to paragraphs
 *  - converts single newlines to <br />
 *  - trims leading/trailing whitespace/newlines
 */
function coerceToHtml(input?: string): string {
  if (!input) return '';

  // 1) image markdown -> <img>
  const imgFixed = input.replace(
    /!\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (_full, alt, url) =>
      `<img src="${String(url)}" alt="${String(alt).replace(/"/g, '&quot;')}" />`
  );

  // 2) normalize Windows/Mac newlines
  const norm = imgFixed.replace(/\r\n?/g, '\n').trim();

  // 3) split into paragraphs by blank lines
  const paragraphs = norm
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  // 4) inside each paragraph, keep single newlines as <br />
  const html = paragraphs
    .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('\n');

  return html || '';
}

/** Combine recipe fields into a single HTML blob we can render */
function renderRecipeHtml(r: Recipe): string {
  const pieces: string[] = [];

  if (r.title) {
    pieces.push(
      `<h2 class="recipe-title">${escapeHtml(r.title)}</h2>`
    );
  }
  if (r.author) {
    pieces.push(`<div class="recipe-author">${escapeHtml(r.author)}</div>`);
  }
  if (r.imageUrl) {
    pieces.push(
      `<div class="recipe-hero"><img src="${r.imageUrl}" alt="${escapeHtml(
        r.title || 'Recipe image'
      )}" /></div>`
    );
  }

  if (r.html && r.html.trim()) {
    pieces.push(r.html);
  } else if (r.text && r.text.trim()) {
    pieces.push(coerceToHtml(r.text));
  }

  return pieces.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ====== Page ====== */

export default function Page() {
  const [query, setQuery] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');

  const logRef = useRef<HTMLDivElement>(null);
  const appendLog = useCallback((line: string) => {
    setLog((prev) => (prev ? `${prev}\n${line}` : line));
  }, []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLog('');
    setRecipes([]);

    const url = `/api/generate?_=${Date.now()}`;
    appendLog(`→ POST ${url}`);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ query }), // IMPORTANT: send JSON body
      });

      if (!resp.ok) {
        const text = await safeReadText(resp);
        appendLog(`✖ Error: ${resp.status} ${resp.statusText}`);
        appendLog(text ? `  Body: ${truncate(text, 500)}` : '  (no body)');
        setError(`Request failed (${resp.status})`);
        setRecipes([]);
        return;
      }

      // Try JSON first; if it fails, fall back to text
      let data: GenerateResponse | null = null;
      try {
        data = (await resp.json()) as GenerateResponse;
      } catch {
        const txt = await resp.text();
        appendLog('✖ Error: Response was not valid JSON');
        appendLog(truncate(txt, 500));
        setError('Server returned non-JSON');
        setRecipes([]);
        return;
      }

      const list = Array.isArray(data?.recipes) ? data!.recipes! : [];
      if (!list.length) {
        appendLog('※ No recipes in response');
      }
      // Coerce each to have an html field we can render safely
      const normalized: Recipe[] = list.map((r, idx) => ({
        id: r.id ?? String(idx),
        title: r.title ?? '',
        author: r.author ?? '',
        imageUrl: r.imageUrl ?? '',
        html: r.html && r.html.trim() ? r.html : coerceToHtml(r.text as string),
        ...r,
      }));

      setRecipes(normalized);
      appendLog(`✓ Loaded ${normalized.length} recipe(s)`);
    } catch (e: any) {
      appendLog('✖ Error: Load failed');
      setError('Network error (fetch failed)');
      setRecipes([]);
    } finally {
      setLoading(false);
      // scroll log into view on change
      setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }, [appendLog, query]);

  const canSaveAll = recipes.length > 0 && !loading;

  const onSaveAll = useCallback(async () => {
    // Single endpoint to store all recipes (adjust path as needed)
    try {
      const resp = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes }),
      });
      if (!resp.ok) throw new Error(`Archive failed: ${resp.status}`);
      appendLog('✓ Saved all to archive');
    } catch (e: any) {
      appendLog(`✖ Archive error: ${e?.message || 'failed'}`);
    }
  }, [recipes, appendLog]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight">FreshRecipes</h1>
      <p className="mt-2 text-neutral-600">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading || !query.trim()}
          className="rounded-lg px-5 py-3 font-semibold text-white disabled:opacity-50"
          style={{ background: 'black' }}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>

        <button
          disabled
          className="rounded-lg px-5 py-3 font-semibold text-neutral-500 bg-neutral-100"
          title="Copy all (coming soon)"
        >
          Copy all
        </button>

        <button
          onClick={onSaveAll}
          disabled={!canSaveAll}
          className="rounded-lg px-5 py-3 font-semibold bg-neutral-100 text-neutral-900 disabled:opacity-50"
        >
          Save all to archive
        </button>
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g., Two chicken recipes with a photo for each"
        className="mt-6 w-full rounded-xl border border-neutral-300 bg-white p-4 text-base leading-6 outline-none focus:ring-2 focus:ring-black"
        rows={5}
      />

      <section className="mt-10">
        <h2 className="text-3xl font-extrabold">Preview</h2>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </div>
        )}

        {!recipes.length && !error && (
          <p className="mt-4 text-neutral-500">
            No recipes yet. Try typing a request above.
          </p>
        )}

        <div className="mt-6 space-y-6">
          {recipes.map((r) => {
            const html = renderRecipeHtml(r);
            return (
              <article
                key={r.id}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                {/* Rendered recipe content */}
                <div
                  className="prose max-w-none"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: html }}
                />

                {/* ONE Save button per recipe */}
                <div className="mt-4 flex justify-end">
                  <button
                    className="rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2 font-semibold"
                    onClick={async () => {
                      try {
                        const resp = await fetch('/api/archive', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ recipes: [r] }),
                        });
                        if (!resp.ok)
                          throw new Error(`Save failed: ${resp.status}`);
                        appendLog(`✓ Saved “${r.title || 'Untitled'}”`);
                      } catch (e: any) {
                        appendLog(
                          `✖ Save error for “${r.title || 'Untitled'}”: ${
                            e?.message || 'failed'
                          }`
                        );
                      }
                    }}
                  >
                    Save highlight
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section ref={logRef} className="mt-10">
        <h3 className="text-xl font-bold">Request log</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
          {log || '—'}
        </pre>
      </section>

      {/* Local styles for nicer recipe typography */}
      <style>{`
        .recipe-title {
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 2rem;
          line-height: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin: 0 0 0.25rem 0;
        }
        .recipe-author {
          color: #6b7280; /* neutral-500 */
          margin-bottom: 1rem;
        }
        .recipe-hero img {
          width: 100%;
          height: auto;
          border-radius: 0.75rem;
          display: block;
          margin: 0.5rem 0 1rem 0;
        }
        .prose p { margin: 0 0 0.75rem 0; }
        .prose img { max-width: 100%; height: auto; border-radius: 0.5rem; }
        .prose h2, .prose h3 { margin-top: 1.25rem; margin-bottom: 0.5rem; }
      `}</style>
    </main>
  );
}

/** ====== tiny utils ====== */
async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
