// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Health = { ok: boolean; count?: number } | null;

export default function Home() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [html, setHtml] = useState<string>("");
  const [health, setHealth] = useState<Health>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/blob-health", { cache: "no-store" });
        if (res.ok) setHealth(await res.json());
        else setHealth({ ok: false });
      } catch {
        setHealth({ ok: false });
      }
    })();
  }, []);

  const badge = useMemo(() => {
    if (!health) return null;
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
          health.ok
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
        }`}
        title={health.ok ? "Blob accessible" : "Blob unavailable"}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            health.ok ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
        Blob {health.ok ? "Healthy" : "Unavailable"}
        {typeof health.count === "number" && (
          <span className="opacity-70">· {health.count}</span>
        )}
      </span>
    );
  }, [health]);

  // Extract absolute image URLs from returned HTML
  function extractImageUrls(docHtml: string): string[] {
    const urls = new Set<string>();
    // capture src="http..." or src='http...' or src=http...
    const re = /<img[^>]*\bsrc=(['"]?)(https?:\/\/[^'">\s)]+)\1/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(docHtml))) urls.add(m[2]);
    return [...urls];
  }

  async function onGenerate() {
    setError("");
    setLoading(true);
    setHtml("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || "Generate failed");

      setHtml(txt);

      // Open a preview tab immediately (nice on mobile too)
      const blob = new Blob([txt], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // do not revoke immediately; let the user view the tab
    } catch (e: any) {
      setError(e?.message || "Generate failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!html) return;
    setSaving(true);
    setError("");
    try {
      const images = extractImageUrls(html);
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html, images, query: instruction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      // Open the blob URL
      if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_800px_at_110%_-10%,rgba(46,91,255,.08),transparent_60%),radial-gradient(900px_700px_at_-10%_0%,rgba(20,184,166,.06),transparent_60%),linear-gradient(#fafbfc,#f7f8fb)]">
      {/* Top bar */}
      <header className="relative z-10 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-teal-400 shadow-sm" />
            <span className="text-sm font-semibold tracking-wide text-slate-800">
              FreshRecipes
            </span>
          </div>
          <div className="flex items-center gap-3">
            {badge}
            <a
              href="/archive"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Archive
            </a>
          </div>
        </div>
      </header>

      {/* Hero (Panda7-like: calm, confident, conversion-focused) */}
      <section className="relative isolate overflow-hidden border-b border-black/5 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Chef-authored recipes · Polished HTML output
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Generate editorial-quality recipe pages in one click.
            </h1>
            <p className="mt-4 max-w-prose text-base leading-7 text-slate-600">
              Paste a clear directive (e.g., “3 iconic Peruvian chicken recipes
              from renowned chefs”). We’ll fetch, compose, and return a complete
              HTML page styled like a premium food magazine — ready to publish
              and archive.
            </p>

            {/* Generator form */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <label
                htmlFor="instruction"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                What should we fetch &amp; render?
              </label>
              <textarea
                id="instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='Example: "3 authentic Peruvian chicken recipes by well-known chefs, with step images if available."'
                className="h-28 w-full resize-vertical rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={onGenerate}
                  disabled={loading || !instruction.trim()}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating…" : "Generate HTML"}
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || !html}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save to Archive"}
                </button>
                {error && (
                  <span className="text-sm font-medium text-rose-600">
                    {error}
                  </span>
                )}
              </div>
            </div>

           

          {/* Right side illustration / preview card */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="aspect-[4/3] w-full rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-inset ring-slate-200" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-4/6 rounded bg-slate-100" />
                <div className="h-3 w-3/6 rounded bg-slate-100" />
              </div>
            </div>
            <div className="pointer-events-none absolute -left-6 -top-6 hidden rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 md:block">
              No-code output
            </div>
          </div>
        </div>
      </section>



      {/* FAQ (kept concise; no “formatting suggestions” language anywhere) */}
      <section className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="text-2xl font-bold text-slate-900">FAQ</h2>
          <div className="mt-6 divide-y divide-slate-200">
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-slate-800">
                How do I preview the generated page?
                <span className="text-slate-400 group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                After you click <em>Generate HTML</em>, a new tab opens with the
                full page. You can save it to the Archive anytime.
              </p>
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-slate-800">
                Can I save and share the result?
                <span className="text-slate-400 group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                Yes. Use <em>Save to Archive</em> — you’ll get a public Blob URL
                you can share.
              </p>
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-slate-800">
                What if an image host blocks requests?
                <span className="text-slate-400 group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                Images are proxied via <code>/api/img</code> for reliability. In
                the archive, images can be re-hosted to Blob for permanence.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Footer — no language inviting the user to change formatting */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-center md:flex-row md:text-left">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} FreshRecipes. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 text-sm">
            <a
              className="text-slate-500 hover:text-slate-700"
              href="/archive"
              aria-label="Open archive"
            >
              Archive
            </a>
            <a
              className="text-slate-500 hover:text-slate-700"
              href="/api/health"
              aria-label="Health check"
            >
              Health
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
