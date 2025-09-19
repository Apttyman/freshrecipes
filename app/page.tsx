'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

// --------- Types ----------
type Section = { heading?: string; html: string };
type Recipe = {
  id: number | string;
  title: string;
  author?: string;
  imageUrl?: string;
  sections: Section[];
};

type GenerateResponse = {
  recipes?: Recipe[];
  // we ignore any other fields
};

// ---------- Helpers ----------
async function copyToClipboard(text: string) {
  // iOS Safari can be fussy; try the async API first, fall back to a hidden textarea.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('navigator.clipboard not available');
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      // Prevent zoom jump
      el.style.position = 'fixed';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
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

// Local archive under one key. If you later add an API route, we also POST to it.
const LS_KEY = 'freshrecipes_archive_v1';

function pushToLocalArchive(item: Recipe) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr: Recipe[] = raw ? JSON.parse(raw) : [];
    arr.unshift(item);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

async function postArchive(item: Recipe) {
  try {
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: item }),
    });
    if (!res.ok) throw new Error('archive POST failed');
  } catch {
    // If no route or it fails, we already stored to localStorage.
  }
}

// ---------- Page ----------
export default function Page() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [log, setLog] = useState<string[]>([]);

  // log helper for the on-screen request log
  const pushLog = useCallback((line: string) => {
    setLog(prev => [...prev.slice(-200), line]); // keep last ~200 lines
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
      pushLog(JSON.stringify(json).slice(0, 2000)); // enough to debug on phone
      const list = json.recipes ?? [];
      setRecipes(Array.isArray(list) ? list : []);
    } catch (err: any) {
      pushLog(`✖ Error: ${err?.message ?? 'Request failed'}`);
    } finally {
      setLoading(false);
    }
  }, [prompt, pushLog]);

  const handleCopyAll = useCallback(async () => {
    if (!recipes.length) return;
    const ok = await copyToClipboard(allRecipesToText(recipes));
    window.alert(ok ? 'Copied all recipes to clipboard.' : 'Copy failed.');
  }, [recipes]);

  const handleSaveAll = useCallback(async () => {
    if (!recipes.length) return;
    for (const r of recipes) {
      pushToLocalArchive(r);
      await postArchive(r);
    }
    window.alert('Saved all recipes to archive.');
  }, [recipes]);

  const handleSaveOne = useCallback(async (r: Recipe) => {
    pushToLocalArchive(r);
    await postArchive(r);
    window.alert(`Saved "${r.title}" to archive.`);
  }, []);

  // Compose recipe card body safely
  const renderRecipeBody = (r: Recipe) => {
    return r.sections.map((s, idx) => (
      <section key={idx} className="mt-6">
        {s.heading ? (
          <h3 className="text-2xl font-semibold mb-2">{s.heading}</h3>
        ) : null}
        {/* We trust our own generator; no user HTML gets in here. */}
        <div
          className="prose prose-lg max-w-none leading-7"
          dangerouslySetInnerHTML={{ __html: s.html }}
        />
      </section>
    ));
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight">FreshRecipes</h1>
      <p className="text-neutral-500 mt-2">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-2xl px-5 py-3 font-semibold text-white bg-black disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>

        <button
          onClick={handleCopyAll}
          disabled={!recipes.length}
          className="rounded-2xl px-5 py-3 font-semibold border border-neutral-300 disabled:opacity-40"
        >
          Copy all
        </button>

        <button
          onClick={handleSaveAll}
          disabled={!recipes.length}
          className="rounded-2xl px-5 py-3 font-semibold border border-neutral-300 disabled:opacity-40"
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
          <article key={r.id} className="rounded-3xl border border-neutral-200 p-6">
            <header className="mb-4">
              <h3 className="text-4xl font-black leading-tight">{r.title}</h3>
              {r.author ? (
                <p className="text-neutral-500 mt-1">Chef {r.author}</p>
              ) : null}
            </header>

            {renderRecipeBody(r)}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => handleSaveOne(r)}
                className="rounded-2xl px-5 py-3 font-semibold border border-neutral-300"
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
    </main>
  );
}
