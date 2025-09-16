'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function HomePage() {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<'idle'|'working'|'ready'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // HTML produced by /api/generate
  const [html, setHtml] = useState<string>('');

  // Blob URL for local preview / download
  const blobUrlRef = useRef<string | null>(null);

  // URL returned by archive endpoint (/api/recipes) – if available we show “Open page”
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);

  // housekeeping: revoke previous preview blob when html changes
  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (html) {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      blobUrlRef.current = URL.createObjectURL(blob);
    }
  }, [html]);

  // keyboard shortcut: Cmd/Ctrl + Enter to Generate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdEnter = (e.metaKey || e.ctrlKey) && e.key === 'Enter';
      if (isCmdEnter) {
        e.preventDefault();
        void handleGenerate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction]);

  const downloadName = useMemo(() => {
    // create a friendly download name from the instruction
    const base = (instruction || 'fresh-recipe')
      .toLowerCase()
      .replace(/[^\w\s-]+/g, '')
      .slice(0, 60)
      .trim()
      .replace(/\s+/g, '-');
    return `${base || 'fresh-recipe'}.html`;
  }, [instruction]);

  async function handleGenerate() {
    setStatus('working');
    setError(null);
    setHtml('');
    setArchiveUrl(null);

    try {
      // 1) Ask your server to generate a COMPLETE HTML file
      const rsp = await fetch('/api/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ instruction: instruction.trim() })
      });

      if (!rsp.ok) {
        const text = await rsp.text().catch(() => '');
        throw new Error(text || `Server error (${rsp.status})`);
      }

      // Expect pure HTML back
      const text = await rsp.text();
      if (!/^<!DOCTYPE html>/i.test(text.trim())) {
        throw new Error('Model did not return a full HTML document.');
      }
      setHtml(text);
      setStatus('ready');

      // 2) Try to archive it (optional but recommended)
      //    Requires the /api/recipes POST route I gave you earlier.
      try {
        const save = await fetch('/api/recipes', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            html: text,
            instruction: instruction.trim()
          })
        });

        if (save.ok) {
          const { url } = await save.json().catch(() => ({}));
          if (url && typeof url === 'string') setArchiveUrl(url);
        }
        // if archiving fails silently, we still keep the preview/download
      } catch { /* ignore archive failure for UX */ }

    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Something went wrong.');
    }
  }

  return (
    <main className="min-h-dvh bg-white text-slate-900 selection:bg-amber-200">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            Fresh Recipes
          </h1>

          <nav className="flex items-center gap-3">
            <a
              href="/recipes"
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Previous Recipes
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-slate-600">
          Generate designer-grade recipe pages from a single instruction. Your instruction becomes
          the exact task (e.g., “Fetch 5 pasta recipes from famous chefs” or “One Thomas Keller ice
          cream recipe with step photos”).
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="instruction" className="block text-sm font-semibold text-slate-800">
            Your instruction
          </label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g., Fetch 5 pasta recipes from famous chefs. Embed step photos if available; Food52-style layout."
            rows={6}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-amber-400"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={status === 'working' || !instruction.trim()}
              className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-50"
              aria-busy={status === 'working'}
            >
              {status === 'working' ? 'Generating…' : 'Generate (⌘/Ctrl + Enter)'}
            </button>

            {/* Download button becomes active once we have HTML */}
            {blobUrlRef.current && (
              <a
                href={blobUrlRef.current}
                download={downloadName}
                className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Download .html
              </a>
            )}

            {/* If the archive endpoint returned a URL, show “Open page” */}
            {archiveUrl && (
              <a
                href={archiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-emerald-600 text-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-50"
              >
                Open page
              </a>
            )}
          </div>

          {/* status & errors */}
          <div className="mt-3 text-sm">
            {status === 'ready' && (
              <p className="text-emerald-700">Ready — open Preview or Download.</p>
            )}
            {status === 'error' && (
              <p className="text-red-700">
                {error || 'Server error. Check your API route logs on Vercel.'}
              </p>
            )}
          </div>
        </div>

        {/* Live preview card */}
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Live Preview</h2>

          {!html && (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Your generated HTML will appear here.
            </div>
          )}

          {html && (
            <iframe
              className="h-[70vh] w-full overflow-hidden rounded-lg border border-slate-200 shadow-sm"
              src={blobUrlRef.current ?? undefined}
              title="Recipe Preview"
            />
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-600">
        <p>
          Tip: Keep instructions specific. You can request layout rules, color palettes, sourcing
          requirements, and per-step photos.
        </p>
      </div>
    </footer>
  );
<a
  href="/archive"
  className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
>
  Previous Recipes
</a>
}
