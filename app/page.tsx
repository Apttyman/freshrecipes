'use client';

import React, { useCallback, useMemo, useState } from 'react';

// -------- Types --------
type Section = { heading?: string; html: string };
type Recipe = {
  id: number | string;
  title: string;
  author?: string;
  imageUrl?: string;
  sections: Section[];
};
type GenerateResponse = { recipes?: Recipe[] };

// -------- Clipboard + text helpers --------
async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('no async clipboard');
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
function htmlToPlainText(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}
function recipeToText(r: Recipe) {
  const parts: string[] = [];
  parts.push(`# ${r.title}`);
  if (r.author) parts.push(`by ${r.author}`);
  for (const s of r.sections) {
    if (s.heading) parts.push(`\n## ${s.heading}\n`);
    parts.push(htmlToPlainText(s.html));
  }
  return parts.join('\n').trim();
}
function allRecipesToText(recipes: Recipe[]) {
  return recipes.map(recipeToText).join('\n\n---\n\n');
}

// -------- Local archive (fallback) --------
const LS_KEY = 'freshrecipes_archive_v1';
function pushToLocalArchive(item: Recipe) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr: Recipe[] = raw ? JSON.parse(raw) : [];
    arr.unshift(item);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}
async function postArchive(item: Recipe) {
  try {
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: item }),
    });
    if (!res.ok) throw new Error('archive route not available');
  } catch {
    /* ignore – local archive already done */
  }
}

// -------- Page --------
export default function Page() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [toast, setToast] = useState<string>('');

  const pushLog = useCallback((line: string) => {
    setLog(prev => [...prev.slice(-200), line]);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 1400);
  }, []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setRecipes([]);
    pushLog(`→ POST /api/generate`);
    try {
      const res = await fetch('/api/generate?_=' + Date.now(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GenerateResponse;
      pushLog('— Raw payload (truncated) —');
      pushLog(JSON.stringify(json).slice(0, 2000));
      setRecipes(Array.isArray(json.recipes) ? json.recipes : []);
    } catch (err: any) {
      pushLog(`✖ Error: ${err?.message ?? 'Request failed'}`);
    } finally {
      setLoading(false);
    }
  }, [prompt, pushLog]);

  const handleCopyAll = useCallback(async () => {
    if (!recipes.length) return;
    const ok = await copyToClipboard(allRecipesToText(recipes));
    showToast(ok ? 'Copied all' : 'Copy failed');
  }, [recipes, showToast]);

  const handleSaveAll = useCallback(async () => {
    if (!recipes.length) return;
    for (const r of recipes) {
      pushToLocalArchive(r);
      await postArchive(r);
    }
    showToast('Saved all');
  }, [recipes, showToast]);

  const handleSaveOne = useCallback(async (r: Recipe) => {
    pushToLocalArchive(r);
    await postArchive(r);
    showToast('Saved');
  }, [showToast]);

  // touch helper for iOS: make sure the event counts as a user gesture
  const touchWrap = (fn: () => void) => (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight">FreshRecipes</h1>
      <p className="text-neutral-500 mt-2">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleGenerate}
          onTouchEnd={touchWrap(handleGenerate)}
          disabled={loading}
          className="pointer-events-auto relative z-10 rounded-2xl px-5 py-3 font-semibold text-white bg-black disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>

        <button
          type="button"
          onClick={handleCopyAll}
          onTouchEnd={touchWrap(handleCopyAll)}
          disabled={!recipes.length}
          className="pointer-events-auto relative z-10 rounded-2xl px-5 py-3 font-semibold border border-neutral-300 disabled:opacity-40"
        >
          Copy all
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          onTouchEnd={touchWrap(handleSaveAll)}
          disabled={!recipes.length}
          className="pointer-events-auto relative z-10 rounded-2xl px-5 py-3 font-semibold border border-neutral-300 disabled:opacity-40"
        >
          Save all to archive
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., Smoky salmon grill recipe with honey glaze"
        className="mt-4 w-full min-h-[140px] rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
      />

      <h2 className="mt-10 text-3xl font-extrabold">Preview</h2>

      {!recipes.length ? (
        <p className="text-neutral-500 mt-3">
          No recipes yet. Try typing a request above.
        </p>
      ) : null}

      <div className="mt-6 space-y-8">
        {recipes.map((r) => (
          <article
            key={r.id}
            className="rounded-3xl border border-neutral-200 p-6 relative"
          >
            <header className="mb-4">
              <h3 className="text-4xl font-black leading-tight">{r.title}</h3>
              {r.author ? (
                <p className="text-neutral-500 mt-1">Chef {r.author}</p>
              ) : null}
            </header>

            {/* Ensure body cannot overlay buttons */}
            <div className="relative z-0">
              {r.sections.map((s, idx) => (
                <section key={idx} className="mt-6">
                  {s.heading ? (
                    <h3 className="text-2xl font-semibold mb-2">{s.heading}</h3>
                  ) : null}
                  <div
                    className="prose prose-lg max-w-none leading-7"
                    style={{ position: 'relative' }}
                    dangerouslySetInnerHTML={{ __html: s.html }}
                  />
                </section>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveOne(r)}
                onTouchEnd={touchWrap(() => handleSaveOne(r))}
                className="pointer-events-auto relative z-10 rounded-2xl px-5 py-3 font-semibold border border-neutral-300"
              >
                Save highlight
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-neutral-200 p-4">
        <h3 className="text-xl font-bold mb-2">Request log</h3>
        <pre className="whitespace-pre-wrap text-sm text-neutral-700">
          {log.join('\n')}
        </pre>
      </div>

      {/* Tiny toast */}
      {toast ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
