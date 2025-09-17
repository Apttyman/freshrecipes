// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("Chicago hot dog");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [savedLink, setSavedLink] = useState<string | null>(null);

  async function onGenerate() {
    setGenerating(true);
    setSaving(false);
    setSavedLink(null);
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
      setGenerating(false);
    }
  }

  async function onSave() {
    if (!html) return;
    setSaving(true);
    setError(null);
    setSavedLink(null);
    try {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, slug: slug || fallbackSlug(prompt) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error || `Save failed: HTTP ${r.status}`);
        return;
      }
      const url: string | undefined = data?.urlHtml || data?.url || data?.href;
      if (url) {
        setSavedLink(url);
        window.location.href = url; // also navigate
      } else {
        setError("Save succeeded but no URL was returned by /api/save.");
      }
    } catch (e: any) {
      setError(String(e?.message || e || "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fresh Recipes</h1>
        <a
          href="/archive"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Open Archive
        </a>
      </div>

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

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate HTML"}
          </button>
          <button
            onClick={onSave}
            disabled={!html || saving}
            className="rounded-lg border px-4 py-2 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save to Archive"}
          </button>
          <a
            href="/archive"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
          >
            View Archive
          </a>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">
            {JSON.stringify({ error })}
          </p>
        )}

        {html && (
          <details className="mt-4" open>
            <summary className="cursor-pointer select-none">Preview</summary>
            <iframe
              title="preview"
              className="mt-2 w-full h-[70vh] rounded-lg border"
              srcDoc={html}
            />
          </details>
        )}

        {savedLink && (
          <p className="mt-3 text-sm">
            Saved:{" "}
            <a href={savedLink} className="underline" target="_blank" rel="noreferrer">
              {savedLink}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

function fallbackSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}
