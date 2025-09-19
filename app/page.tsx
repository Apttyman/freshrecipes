'use client';

import React, { useCallback, useRef, useState } from 'react';

/* =========================
   Types (loose and forgiving)
   ========================= */
type Recipe = {
  id?: string;
  title?: string;
  author?: string;
  imageUrl?: string;

  // possible body shapes the API might send
  html?: string;
  text?: string;
  body?: string;
  description?: string;
  intro?: string;

  ingredients?: string[] | string;
  instructions?: string[] | string;
  steps?: string[] | string;

  sections?: Array<{ title?: string; content?: string }>;
  [k: string]: unknown;
};

type GenerateResponse = {
  recipes?: Recipe[];
  [k: string]: unknown;
};

/* =========================
   Small utilities
   ========================= */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeString(x: unknown): string {
  if (Array.isArray(x)) return x.filter(Boolean).map((v) => String(v)).join('\n');
  if (x && typeof x === 'object') return '';
  return (x ?? '').toString();
}

/** Convert literal `\n` sequences to real line breaks, normalize CRLF. */
function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/\\n/g, '\n');
}

/** Very small markdown-ish to HTML. Keeps it simple and robust. */
function toHtmlBlocks(input: string): string {
  const s = normalizeNewlines(input).trim();
  if (!s) return '';

  // Turn markdown images into <img> that hide only themselves if broken.
  const withImages = s.replace(
    /!\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, alt, url) =>
      `<img src="${String(url)}" alt="${escapeHtml(String(alt))}" onerror="this.style.display='none'" />`
  );

  // Split into blocks by blank lines
  const blocks = withImages.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    // bullet list
    if (/^(\* |- )/.test(block)) {
      const items = block
        .split(/\n/)
        .map((ln) => ln.replace(/^(\* |- )/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
      htmlBlocks.push(`<ul>${items}</ul>`);
      continue;
    }

    // numbered list
    if (/^\d+[.)]\s+/.test(block)) {
      const items = block
        .split(/\n/)
        .map((ln) => ln.replace(/^\d+[.)]\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
      htmlBlocks.push(`<ol>${items}</ol>`);
      continue;
    }

    // default paragraph (preserve single newlines as <br>)
    htmlBlocks.push(`<p>${block.replace(/\n/g, '<br />')}</p>`);
  }

  return htmlBlocks.join('\n');
}

/** Gather *any* body content present on the recipe. */
function buildBodyHtml(r: Recipe): string {
  // 1) If server gives HTML, trust it (still show even if image fails)
  if (r.html && String(r.html).trim()) return String(r.html);

  // 2) Stitch from common fields
  const parts: string[] = [];

  const intro = safeString(r.intro) || safeString(r.description) || '';
  if (intro.trim()) parts.push(intro.trim());

  const textish =
    safeString(r.body) ||
    safeString(r.text) ||
    ''; // generic raw text

  if (textish.trim()) parts.push(textish.trim());

  const ingText = safeString(r.ingredients);
  if (ingText.trim()) parts.push(`**Ingredients**\n${ingText.trim()}`);

  const stepsText =
    safeString(r.instructions) ||
    safeString(r.steps);
  if (stepsText.trim()) parts.push(`**Instructions**\n${stepsText.trim()}`);

  // 3) Sections fallback
  if (Array.isArray(r.sections) && r.sections.length) {
    for (const s of r.sections) {
      const t = (s?.title ?? '').toString().trim();
      const c = (s?.content ?? '').toString().trim();
      if (t) parts.push(`**${t}**`);
      if (c) parts.push(c);
    }
  }

  const combined = parts.filter(Boolean).join('\n\n');
  return toHtmlBlocks(combined);
}

/** Render one recipe into HTML (image is independent from the body). */
function renderRecipeHtml(r: Recipe): string {
  const out: string[] = [];

  if (r.title) out.push(`<h2 class="recipe-title">${escapeHtml(r.title)}</h2>`);
  if (r.author) out.push(`<div class="recipe-author">${escapeHtml(r.author)}</div>`);

  // Image is optional and *never* controls body visibility.
  if (r.imageUrl && /^https?:\/\//i.test(r.imageUrl)) {
    out.push(
      `<div class="recipe-hero"><img src="${r.imageUrl}" alt="${escapeHtml(
        r.title || 'Recipe image'
      )}" onerror="this.style.display='none'" /></div>`
    );
  }

  const bodyHtml = buildBodyHtml(r);
  if (bodyHtml) {
    out.push(bodyHtml);
  } else {
    out.push(`<div class="recipe-empty">No recipe body returned from server.</div>`);
  }

  return out.join('\n');
}

/* =========================
   Page
   ========================= */
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
        body: JSON.stringify({ query }),
      });

      const raw = await resp.text();
      if (!resp.ok) {
        appendLog(`✖ ${resp.status} ${resp.statusText}`);
        if (raw) appendLog(raw.slice(0, 1200));
        setError(`Request failed (${resp.status})`);
        return;
      }

      appendLog('— Raw payload (truncated) —');
      appendLog(raw.slice(0, 2000));

      let data: GenerateResponse | null = null;
      try {
        data = JSON.parse(raw);
      } catch {
        setError('Server returned non-JSON');
        appendLog('✖ JSON parse error');
        return;
      }

      const list = Array.isArray(data?.recipes) ? data!.recipes! : [];
      const normalized = list.map((r, i) => ({
        id: r.id ?? String(i),
        title: safeString(r.title),
        author: safeString(r.author),
        imageUrl: safeString(r.imageUrl),
        html: safeString(r.html),
        text: safeString(r.text),
        body: safeString(r.body),
        description: safeString(r.description),
        intro: safeString(r.intro),
        ingredients: r.ingredients,
        instructions: r.instructions,
        steps: r.steps,
        sections: r.sections,
        ...r,
      }));

      setRecipes(normalized);
      appendLog(`✓ Loaded ${normalized.length} recipe(s)`);
    } catch (e: any) {
      setError('Network error (fetch failed)');
      appendLog(`✖ Load failed: ${e?.message || 'fetch failed'}`);
    } finally {
      setLoading(false);
      setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }, [query, appendLog]);

  const onSaveAll = useCallback(async () => {
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
      <p className="mt-2 text-neutral-600">Type a natural-language request. We’ll fetch and format it.</p>

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
          onClick={onSaveAll}
          disabled={!recipes.length || loading}
          className="rounded-lg px-5 py-3 font-semibold bg-neutral-100 text-neutral-900 disabled:opacity-50"
        >
          Save all to archive
        </button>
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g., Two chicken recipes with image + intro, ingredients, and clear step-by-step instructions"
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
          <p className="mt-4 text-neutral-500">No recipes yet. Try typing a request above.</p>
        )}

        <div className="mt-6 space-y-6">
          {recipes.map((r) => {
            const html = renderRecipeHtml(r);
            return (
              <article key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
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
                        if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
                        appendLog(`✓ Saved “${r.title || 'Untitled'}”`);
                      } catch (e: any) {
                        appendLog(`✖ Save error for “${r.title || 'Untitled'}”: ${e?.message || 'failed'}`);
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

      <style>{`
        .recipe-title {
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 2rem;
          line-height: 2.4rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin: 0 0 .25rem 0;
        }
        .recipe-author {
          color: #6b7280;
          margin-bottom: 1rem;
        }
        .recipe-hero img {
          width: 100%;
          height: auto;
          border-radius: 0.75rem;
          display: block;
          margin: 0.5rem 0 1rem 0;
        }
        .recipe-empty {
          color: #6b7280;
          font-style: italic;
          padding: .5rem 0;
        }
        .prose p { margin: 0 0 0.75rem 0; }
        .prose ul, .prose ol { margin: .5rem 0 .75rem 1.25rem; }
        .prose li { margin: .2rem 0; }
        .prose img { max-width: 100%; height: auto; border-radius: 0.5rem; }
        .prose h2, .prose h3 { margin-top: 1.25rem; margin-bottom: 0.5rem; }
      `}</style>
    </main>
  );
}
