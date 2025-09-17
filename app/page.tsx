// app/page.tsx
"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>(""); // shows real error/success text
  const iframeRef = useRef<HTMLIFrameElement>(null);

  async function onGenerate() {
    setMsg("");
    setPreviewHtml("");
    setSlug("");
    setBusy(true);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      // Try to parse JSON; fall back to text
      let data: any = null;
      try { data = await r.json(); } catch { /* fall through */ }

      if (!r.ok) {
        const errText = (data && (data.error || data.message)) || `HTTP ${r.status}`;
        setMsg(errText);                      // << show exact server error
        return;
      }

      const html = String(data?.html || "");
      const slugValue = String(data?.slug || "");
      if (!html) {
        setMsg("Generator returned empty HTML.");
        return;
      }

      setPreviewHtml(html);
      setSlug(slugValue);

      // Render inline preview
      if (iframeRef.current) {
        const doc = iframeRef.current.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        }
      }
    } catch (e: any) {
      setMsg(String(e?.message || e || "Generate failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!previewHtml || !slug) {
      setMsg("Nothing to save yet.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: previewHtml, slug }),
      });

      let data: any = null;
      try { data = await r.json(); } catch { /* fall through */ }

      if (!r.ok) {
        const errText = (data && (data.error || data.message)) || `HTTP ${r.status}`;
        setMsg(errText);
        return;
      }

      const url = String(data?.url || "");
      if (!url) {
        setMsg("Save succeeded but no URL was returned by /api/save.");
        return;
      }
      setMsg(`Saved ✓  →  ${url}`);
      // Optionally auto-open:
      // window.location.href = url;
    } catch (e: any) {
      setMsg(String(e?.message || e || "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Fresh Recipes</h1>
        <a
          href="/archive"
          className="inline-block rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Open Archive
        </a>
      </header>

      <section className="rounded-xl border p-4 sm:p-6">
        <label className="block text-lg font-semibold mb-2">
          What should we fetch &amp; render?
        </label>
        <textarea
          className="w-full rounded-lg border p-3 font-medium outline-none"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "3 iconic homemade ice cream recipes with cool photos"'
        />

        <div className="mt-4 flex gap-3">
          <button
            onClick={onGenerate}
            disabled={busy || !prompt.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate HTML"}
          </button>

          <button
            onClick={onSave}
            disabled={!previewHtml || !slug || saving}
            className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to Archive"}
          </button>
        </div>

        {msg && (
          <p className="mt-3 text-sm text-red-600 break-words">
            {JSON.stringify({ error: msg })}
          </p>
        )}
      </section>

      {previewHtml && (
        <details className="mt-6 rounded-xl border">
          <summary className="cursor-pointer p-3 font-semibold">
            Preview (inline)
          </summary>
          <div className="p-3">
            <iframe ref={iframeRef} className="w-full h-[70vh] rounded-lg border" />
          </div>
        </details>
      )}
    </main>
  );
}
