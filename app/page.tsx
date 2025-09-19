'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// --- Types -------------------------------------------------------------------
type GenerateResponse = {
  ok: boolean;
  html?: string;        // Full HTML returned by /api/generate
  error?: string;
};

// --- Small helpers -----------------------------------------------------------
function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Ensure the preview HTML is safe to insert (very lightweight guard).
 * We leave your server to do the real sanitization.
 */
function safeHtml(html: string): string {
  // Cheap guard: strip <script> blocks if any slipped through.
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/**
 * Given a container element containing the HTML returned by the model,
 * - finds recipe "cards"
 * - promotes the first visible line as a big artistic title
 * - ensures ONE "Save highlight" toolbar per recipe card (not per section)
 * - returns an array of objects, each containing card HTML and a title
 */
function extractRecipeCards(container: HTMLElement) {
  const cards: Array<{ title: string; html: string }> = [];

  // Heuristics: a "recipe card" is either an <article>, a block that has an <h1>/<h2>,
  // or a top-level section that visually groups content.
  // We prioritize articles, then fall back to top-level sections.
  const articleNodes = Array.from(
    container.querySelectorAll<HTMLElement>('article, section, .recipe-card, [data-recipe]')
  );

  const topLevelBlocks =
    articleNodes.length > 0
      ? articleNodes
      : Array.from(container.children).filter((el) => {
          const tag = (el as HTMLElement).tagName.toLowerCase();
          return ['article', 'section', 'div'].includes(tag);
        }) as HTMLElement[];

  for (const block of topLevelBlocks) {
    const working = block.cloneNode(true) as HTMLElement;

    // 1) Promote a strong title to the top of the card.
    let titleEl =
      working.querySelector<HTMLElement>('h1, h2, h3') ||
      working.querySelector<HTMLElement>('p,strong,em');

    let titleText = (titleEl?.textContent || '').trim();
    if (!titleText) titleText = 'Untitled Recipe';

    // Create a single fancy title node (Playfair Display is hooked via CSS class)
    const bigTitle = working.ownerDocument!.createElement('h2');
    bigTitle.className =
      'recipe-title text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-3 text-slate-900';
    bigTitle.textContent = titleText;

    // If the candidate title is not already the first child, insert our bigTitle at the top.
    if (working.firstElementChild !== titleEl) {
      working.insertAdjacentElement('afterbegin', bigTitle);
      // If we just promoted a <p>/<strong> as title, keep it in body (often subtitle).
      // If it was an h1/h2 already, remove the old to avoid duplicate headings.
      if (titleEl && /h[1-3]/i.test(titleEl.tagName)) {
        titleEl.remove();
      }
    } else {
      // Replace first heading with our styled one
      titleEl?.replaceWith(bigTitle);
    }

    // 2) ONE toolbar per recipe (append to the end of the card)
    const toolbar = working.ownerDocument!.createElement('div');
    toolbar.className =
      'mt-4 rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm p-3';
    toolbar.innerHTML = `
      <button
        type="button"
        data-role="save-highlight"
        class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-base font-semibold border border-slate-300 text-slate-900 hover:bg-slate-50 active:bg-slate-100"
        aria-label="Save this recipe to highlights"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="-mt-0.5">
          <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1z" fill="currentColor" />
        </svg>
        Save highlight
      </button>
    `;
    working.appendChild(toolbar);

    // 3) Wrap as a card shell (for consistent outer UI)
    const cardShell = working.ownerDocument!.createElement('article');
    cardShell.className =
      'recipe-card rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6';
    cardShell.appendChild(working);

    cards.push({ title: titleText, html: cardShell.outerHTML });
  }

  // If we found nothing, fall back to one big card containing everything
  if (cards.length === 0) {
    const shell = container.ownerDocument!.createElement('article');
    shell.className =
      'recipe-card rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6';
    shell.innerHTML = container.innerHTML;
    cards.push({ title: 'Recipe', html: shell.outerHTML });
  }

  return cards;
}

/**
 * Attach one click handler for all dynamically inserted "Save highlight" buttons.
 * We fetch the nearest recipe card’s HTML and POST just that portion.
 */
function mountHighlightHandler(
  root: HTMLElement,
  onSave: (payload: { title: string; html: string }) => Promise<void>
) {
  const handler = async (ev: MouseEvent) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest<HTMLElement>('button[data-role="save-highlight"]');
    if (!btn) return;

    const card = btn.closest<HTMLElement>('.recipe-card');
    if (!card) return;

    // Title is always the first .recipe-title inside the card
    const title = (card.querySelector('.recipe-title')?.textContent || 'Recipe').trim();
    btn.setAttribute('disabled', 'true');

    try {
      await onSave({ title, html: card.outerHTML });
      btn.innerHTML = 'Saved ✓';
      btn.classList.remove('border-slate-300');
      btn.classList.add('border-emerald-300', 'text-emerald-800');
    } catch (e) {
      btn.innerHTML = 'Error – try again';
      btn.classList.add('border-rose-300', 'text-rose-800');
    } finally {
      setTimeout(() => {
        btn.removeAttribute('disabled');
      }, 600);
    }
  };

  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
}

// --- Page Component ----------------------------------------------------------
export default function HomePage() {
  const [query, setQuery] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);
  const [cards, setCards] = useState<Array<{ title: string; html: string }>>([]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const logLine = useCallback((s: string) => {
    setLog((prev) => [s, ...prev].slice(0, 40));
  }, []);

  const hasPreview = cards.length > 0;

  // Attach one handler for highlight saves
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    return mountHighlightHandler(root, async ({ title, html }) => {
      // POST a single card to highlight store
      await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'highlight',
          title,
          html,
          query,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to save highlight');
      });
    });
  }, [query]);

  // Generate handler
  const onGenerate = useCallback(async () => {
    if (!query.trim()) return;

    setBusy(true);
    setCards([]);
    logLine(`→ POST /api/generate { query: "${query}" }`);

    try {
      const res = await fetch(`/api/generate?_=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logLine(`✖ ${res.status} ${res.statusText}`);
        logLine(text || 'Server error');
        setBusy(false);
        return;
        }

      const text = await res.text();
      // Server returns raw HTML (string). Keep it as-is.
      const cleaned = safeHtml(text);

      // Place into a detached container to transform
      const scratch = document.createElement('div');
      scratch.innerHTML = cleaned;

      const extracted = extractRecipeCards(scratch);
      setCards(extracted);
      logLine(`✓ Rendered ${extracted.length} recipe card(s).`);
    } catch (err) {
      logLine(`✖ Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [query, logLine]);

  // Copy all
  const onCopyAll = useCallback(async () => {
    const html = cards.map((c) => c.html).join('\n\n');
    try {
      await navigator.clipboard.writeText(html);
      logLine('✓ Copied all preview HTML to clipboard.');
    } catch {
      logLine('✖ Clipboard blocked.');
    }
  }, [cards, logLine]);

  // Save ALL to archive
  const onSaveAll = useCallback(async () => {
    if (cards.length === 0) return;
    const html = cards.map((c) => c.html).join('\n\n');
    try {
      const resp = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'full',
          query,
          html,
        }),
      });
      if (!resp.ok) throw new Error('Failed to save archive');
      logLine('✓ Saved full result to archive.');
    } catch (e) {
      logLine(`✖ ${String((e as Error).message)}`);
    }
  }, [cards, query, logLine]);

  const grid = useMemo(() => {
    return cards.map((c, idx) => (
      <article
        key={`${c.title}-${idx}`}
        className="recipe-card rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6"
        dangerouslySetInnerHTML={{ __html: c.html }}
      />
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            FreshRecipes
          </h1>
          <p className="mt-2 text-slate-600">
            Type a natural-language request. We’ll fetch and format it.
          </p>

          <div className="mt-4">
            <a
              href="/archive"
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Open Archive
            </a>
          </div>
        </header>

        {/* Query box */}
        <div className="mb-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 3 top chef pasta recipes"
            rows={5}
            className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-lg outline-none ring-0 focus:border-slate-400"
          />
        </div>

        {/* Actions */}
        <div className="mb-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className={classNames(
              'inline-flex items-center rounded-xl px-5 py-2.5 text-base font-semibold',
              busy
                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            )}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>

          <button
            type="button"
            onClick={onCopyAll}
            disabled={!hasPreview}
            className={classNames(
              'inline-flex items-center rounded-xl px-5 py-2.5 text-base font-semibold border',
              hasPreview
                ? 'border-slate-300 text-slate-900 hover:bg-slate-50'
                : 'border-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            Copy all
          </button>

          <button
            type="button"
            onClick={onSaveAll}
            disabled={!hasPreview}
            className={classNames(
              'inline-flex items-center rounded-xl px-5 py-2.5 text-base font-semibold border',
              hasPreview
                ? 'border-slate-300 text-slate-900 hover:bg-slate-50'
                : 'border-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            Save all to archive
          </button>
        </div>

        {/* Preview */}
        <section aria-labelledby="preview-title" className="mb-10">
          <h2 id="preview-title" className="text-2xl font-black tracking-tight text-slate-900 mb-4">
            Preview
          </h2>

          <div
            ref={previewRef}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            {grid}
          </div>
        </section>

        {/* Request log */}
        <section aria-labelledby="log-title" className="mb-16">
          <h3 id="log-title" className="text-xl font-bold text-slate-900 mb-3">
            Request log
          </h3>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-mono text-slate-700">
            {log.length === 0 ? (
              <div className="text-slate-400">No requests yet.</div>
            ) : (
              <ul className="space-y-2">
                {log.map((l, i) => (
                  <li key={i} className="break-words">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
