// app/page.tsx
'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

type RecipeSection = {
  heading?: string;
  html?: string; // server returns fully-formed HTML
};

type HeroImage = {
  url?: string;
  alt?: string;
};

type Recipe = {
  id: string | number;
  title: string;
  author?: string;
  heroImage?: HeroImage;
  sections?: RecipeSection[];
};

type ApiOk = { recipes?: Recipe[] };

/** Light HTML gate: keep what we expect from our own API; reject obvious JS URLs. */
function safeHtml(html?: string): string {
  if (!html) return '';
  // Very light link scrubbing; keep lists/paragraphs/etc. We are not stripping tags here,
  // because the server already returns curated HTML. Only neuter javascript: links.
  return html.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
}

export default function Page() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  const onGenerate = useCallback(async () => {
    const query = (inputRef.current?.value || '').trim();
    setRecipes([]);
    setLog([]);
    if (!query) {
      appendLog('✱ Error: Empty request');
      return;
    }

    setBusy(true);
    try {
      const url = `/api/generate?_=${Date.now()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send in a very tolerant envelope. Your route can pick whichever it expects.
        body: JSON.stringify({ query, prompt: query, q: query }),
      });

      if (!res.ok) {
        appendLog(`✱ Error: ${res.status} ${res.statusText}`);
        return;
      }

      const payload = (await res.json()) as ApiOk | unknown;

      // Log a truncated view so we can see what shape came back.
      try {
        const preview = JSON.stringify(payload).slice(0, 800);
        appendLog(`→ POST ${url}`);
        appendLog(`– Raw payload (truncated) – ${preview}${preview.length === 800 ? '…' : ''}`);
      } catch {
        /* ignore logging errors */
      }

      // Be defensive about shape:
      let next: Recipe[] = [];
      const p = payload as any;
      if (Array.isArray(p)) next = p as Recipe[];
      else if (p?.recipes && Array.isArray(p.recipes)) next = p.recipes as Recipe[];
      else if (p?.data?.recipes && Array.isArray(p.data.recipes)) next = p.data.recipes as Recipe[];

      if (!next.length) {
        appendLog('✱ Error: No recipes array in response');
        return;
      }

      setRecipes(next);
    } catch (e: any) {
      appendLog(`✱ Error: ${e?.message || 'Load failed'}`);
    } finally {
      setBusy(false);
    }
  }, [appendLog]);

  const hasAnyBody = useMemo(
    () =>
      recipes.some((r) =>
        (r.sections || []).some((s) => {
          const html = safeHtml(s?.html);
          // consider non-empty if there is any non-tag text after trimming
          const textish = html.replace(/<[^>]*>/g, '').trim();
          return html.trim().length > 0 && textish.length > 0;
        }),
      ),
    [recipes],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-black tracking-tight">FreshRecipes</h1>
      <p className="mt-2 text-neutral-600">Type a natural-language request. We’ll fetch and format it.</p>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={busy}
          className="rounded-xl px-5 py-3 font-semibold text-white bg-black disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
        <button
          disabled
          className="rounded-xl px-5 py-3 font-semibold border border-neutral-300 text-neutral-500"
        >
          Copy all
        </button>
        <button
          disabled
          className="rounded-xl px-5 py-3 font-semibold border border-neutral-300 text-neutral-500"
        >
          Save all to archive
        </button>
      </div>

      <div className="mt-4">
        <textarea
          ref={inputRef}
          rows={4}
          placeholder="e.g., 3 easy chicken recipes with a cozy intro"
          className="w-full rounded-2xl border border-neutral-300 p-4 outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">Preview</h2>

      {!recipes.length && (
        <p className="mt-3 text-neutral-600">No recipes yet. Try typing a request above.</p>
      )}

      <div className="mt-4 space-y-6">
        {recipes.map((r) => {
          const key = String(r.id ?? r.title);
          return (
            <article key={key} className="rounded-3xl border border-neutral-200 p-6">
              <header className="mb-3">
                <h3 className="font-serif text-4xl font-black leading-tight tracking-tight">{r.title}</h3>
                {r.author && <div className="mt-2 text-neutral-500">{r.author}</div>}
              </header>

              {/* Optional hero image */}
              {r.heroImage?.url ? (
                <figure className="mb-4 overflow-hidden rounded-2xl border border-neutral-200">
                  {/* Hide the image if it errors; don't nuke the rest of the content */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={r.heroImage.alt || r.title}
                    src={r.heroImage.url}
                    className="block w-full object-cover"
                    onError={(el) => {
                      (el.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </figure>
              ) : null}

              {/* Render sections from the API */}
              {(r.sections && r.sections.length > 0) ? (
                r.sections.map((s, i) => {
                  const html = safeHtml(s?.html);
                  const textish = html.replace(/<[^>]*>/g, '').trim();
                  if (!html.trim() || !textish) return null;
                  return (
                    <section key={`${key}-sec-${i}`} className="mt-4">
                      {s.heading ? (
                        <h4 className="mb-2 text-xl font-extrabold">{s.heading}</h4>
                      ) : null}
                      <div
                        className="prose prose-neutral max-w-none"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    </section>
                  );
                })
              ) : (
                <p className="italic text-neutral-500">No recipe body returned from server.</p>
              )}

              <div className="mt-6 flex justify-end">
                <button className="rounded-xl px-5 py-3 font-semibold border border-neutral-300">
                  Save highlight
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-10">
        <h3 className="text-xl font-bold">Request log</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-[13px] leading-5">
          {log.join('\n')}
        </pre>
      </section>
    </main>
  );
}
