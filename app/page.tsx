// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("Chicago hot dog");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setHtml(null);
    setSlug(null);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error || `HTTP ${r.status}`);
        return;
      }
      setHtml(data?.html || "");
      setSlug(data?.slug || "");
    } catch (e: any) {
      setError(String(e?.message || e || "Request failed"));
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!html) return;
    try {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, slug }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data?.error || `Save failed: HTTP ${r.status}`);
        return;
      }
      // Expecting { urlHtml, urlJson? } from your /api/save
      if (data?.urlHtml) window.location.href = data.urlHtml;
    } catch (e: any) {
      alert(String(e?.message || e || "Save failed"));
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold mb-2">Fresh Recipes</h1>
      <p className="text-slate-600 mb-6">
        Paste a directive and generate a complete HTML page.
      </p>

      <div className="rounded-xl border p-4 mb-4">
        <label className="block text-sm font-medium mb-2">
          What should we fetch &amp; render?
        </label>
        <textarea
          className="w-full rounded-lg border p-3 min-h-[96px] text-base"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 3 iconic Peruvian chicken recipes"
        />
        <div className="mt-3 flex gap-3">
          <button
            onClick={onGenerate}
            disabled={loading}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate HTML"}
          </button>
          <button
            onClick={onSave}
            disabled={!html}
            className="rounded-lg border px-4 py-2 disabled:opacity-60"
          >
            Save to Archive
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">
            {JSON.stringify({ error })}
          </p>
        )}
        {html && (
          <details className="mt-4">
            <summary className="cursor-pointer select-none">Preview (inline)</summary>
            <iframe
              title="preview"
              className="mt-2 w-full h-[70vh] rounded-lg border"
              srcDoc={html}
            />
          </details>
        )}
      </div>
    </main>
  );
}
