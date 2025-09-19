'use client';

import React from 'react';

type RecipeSection = {
  heading: string;
  html: string;
};

type Recipe = {
  id: string | number;
  title: string;
  author?: string;
  sections: RecipeSection[];
  imageUrl?: string | null;
};

type GenerateResponse = {
  recipes: Recipe[];
  error?: string;
};

export default function Page() {
  const [query, setQuery] = React.useState('');
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<string[]>([]);

  // Keep a simple set of saved recipe IDs for disabling the button (one per recipe)
  const [saved, setSaved] = React.useState<Set<string | number>>(new Set());

  function pushLog(line: string) {
    setLog(l => [`• ${line}`, ...l].slice(0, 25));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setRecipes([]);
    setSaved(new Set());

    const trimmed = query.trim();
    pushLog(`POST /api/generate`);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      // Read raw text so we can surface non-JSON errors too
      const raw = await resp.text();

      if (!resp.ok) {
        pushLog(`Error: HTTP ${resp.status}`);
        // The route returns a shaped JSON error, but if something else happens, raw may not be JSON.
        try {
          const j = JSON.parse(raw) as GenerateResponse;
          setError(j.error || `Request failed (${resp.status})`);
        } catch {
          setError(raw || `Request failed (${resp.status})`);
        }
        return;
      }

      let data: GenerateResponse | null = null;
      try {
        data = JSON.parse(raw) as GenerateResponse;
      } catch {
        setError('Server returned invalid JSON.');
        pushLog('Error: invalid JSON from server');
        return;
      }

      const list = Array.isArray(data.recipes) ? data.recipes : [];
      setRecipes(list);
      if (data.error) setError(data.error);
    } catch (e: any) {
      const msg = e?.message || 'Network error';
      setError(msg);
      pushLog(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function stripHtml(html: string) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h\d>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function handleCopyAll() {
    const parts: string[] = [];
    recipes.forEach(r => {
      parts.push(`# ${r.title}`);
      if (r.author) parts.push(`by ${r.author}`);
      r.sections.forEach(s => {
        parts.push(`\n## ${s.heading}`);
        parts.push(stripHtml(s.html));
      });
      parts.push('\n');
    });
    const text = parts.join('\n').trim();
    try {
      await navigator.clipboard.writeText(text);
      pushLog('Copied all recipes to clipboard');
    } catch {
      pushLog('Copy failed (clipboard permission?)');
    }
  }

  function saveToArchive(items: Recipe[]) {
    try {
      const key = 'fr-archive';
      const prev: Recipe[] = JSON.parse(localStorage.getItem(key) || '[]');
      const merged = [...prev, ...items];
      localStorage.setItem(key, JSON.stringify(merged));
      pushLog(`Saved ${items.length} to archive`);
    } catch {
      pushLog('Saving to archive failed (localStorage?)');
    }
  }

  function handleSaveRecipe(r: Recipe) {
    if (saved.has(r.id)) return;
    saveToArchive([r]);
    setSaved(s => new Set([...s, r.id]));
  }

  function handleSaveAll() {
    if (!recipes.length) return;
    saveToArchive(recipes);
    setSaved(new Set(recipes.map(r => r.id)));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight">FreshRecipes</h1>
      <p className="mt-2 text-gray-600">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`rounded-xl px-5 py-3 font-semibold text-white ${loading ? 'bg-gray-400' : 'bg-black hover:opacity-90'}`}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>

        <button
          onClick={handleCopyAll}
          disabled={!recipes.length}
          className={`rounded-xl px-5 py-3 font-semibold border ${recipes.length ? 'bg-white' : 'bg-gray-100 text-gray-400'}`}
          title={recipes.length ? 'Copy all to clipboard' : 'Nothing to copy yet'}
        >
          Copy all
        </button>

        <button
          onClick={handleSaveAll}
          disabled={!recipes.length}
          className={`rounded-xl px-5 py-3 font-semibold border ${recipes.length ? 'bg-white' : 'bg-gray-100 text-gray-400'}`}
          title={recipes.length ? 'Save all to archive' : 'Nothing to save yet'}
        >
          Save all to archive
        </button>
      </div>

      <textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="e.g., Smoked salmon tacos with lime crema"
        className="mt-4 w-full min-h-[140px] rounded-2xl border p-4 text-lg"
      />

      <h2 className="mt-10 text-3xl font-extrabold tracking-tight">Preview</h2>

      {!recipes.length && !loading && (
        <p className="mt-3 text-gray-500">No recipes yet. Try typing a request above.</p>
      )}

      <div className="mt-6 space-y-6">
        {recipes.map(r => (
          <article key={r.id} className="rounded-3xl border p-6">
            <header className="mb-4">
              <h3 className="text-4xl font-extrabold leading-tight" style={{ fontFamily: 'Playfair Display, ui-serif' }}>
                {r.title}
              </h3>
              {r.author && <p className="mt-1 text-lg text-gray-500">Chef {r.author}</p>}
            </header>

            {/* Optional image — hide if it fails */}
            {r.imageUrl ? (
              <div className="mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="w-full rounded-xl border"
                  onError={(el) => {
                    const t = el.currentTarget;
                    t.style.display = 'none';
                  }}
                />
              </div>
            ) : null}

            <div className="space-y-6">
              {r.sections.map((s, idx) => (
                <section key={idx}>
                  <h4 className="text-2xl font-bold mb-2">{s.heading}</h4>
                  {/* server provides HTML for each section */}
                  <div
                    className="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: s.html }}
                  />
                </section>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => handleSaveRecipe(r)}
                disabled={saved.has(r.id)}
                className={`rounded-xl px-5 py-3 font-semibold border ${saved.has(r.id) ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}`}
                title={saved.has(r.id) ? 'Already saved' : 'Save to archive'}
              >
                {saved.has(r.id) ? 'Saved' : 'Save highlight'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <h2 className="mt-10 text-2xl font-bold">Request log</h2>
      {error && <p className="mt-2 text-red-600">✖ {error}</p>}
      <pre className="mt-2 whitespace-pre-wrap rounded-2xl border p-4 text-sm text-gray-800 bg-gray-50">
        {log.join('\n') || '—'}
      </pre>
    </main>
  );
}
