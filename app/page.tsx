// app/page.tsx
"use client";

import { useState } from "react";

type GenPayload = { html?: string; slug?: string; error?: string };

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [html, setHtml] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string>("");

  const appendLog = (line: string) =>
    setLog((prev) => (prev ? prev + "\n" + line : line));

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setHtml("");
    setSlug("");
    setLog("");
    try {
      appendLog("POST /api/generate …");
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      appendLog(`status ${r.status} ${r.statusText} | ${r.headers.get("content-type")}`);
      const data = (await r.json()) as GenPayload;
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      appendLog(`OK (${(JSON.stringify(data).length).toLocaleString()} bytes)`);
      setHtml(data.html ?? "");
      setSlug(data.slug ?? "");
    } catch (err: any) {
      const msg = String(err?.message || err);
      setHtml("");
      setSlug("");
      appendLog(`ERROR: ${msg}`);
      alert(`Generate failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!html || saving) return;
    setSaving(true);
    appendLog("POST /api/save …");
    try {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html, slug }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      const url = data?.url || data?.pageUrl || "";
      appendLog(`Saved. URL: ${url || "(no url returned)"}`);
      if (url) {
        // open in new tab
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        alert('Save succeeded but no URL was returned by /api/save.');
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      appendLog(`SAVE ERROR: ${msg}`);
      alert(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: 0 }}>Fresh Recipes</h1>
        <button
          type="button"
          onClick={() => (window.location.href = "/archive")}
          style={btnOutline}
        >
          Open Archive
        </button>
      </header>

      <section style={card}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
          What should we fetch &amp; render?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. 3 iconic Peruvian chicken recipes with step photos"
          style={textarea}
        />

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{ ...btnPrimary, opacity: loading || !prompt.trim() ? 0.6 : 1 }}
          >
            {loading ? "Generating…" : "Generate HTML"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!html || saving}
            style={{ ...btnOutline, opacity: !html || saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save to Archive"}
          </button>
        </div>

        {/* Inline console */}
        <pre
          style={{
            marginTop: 12,
            background: "#111",
            color: "#eee",
            fontSize: 12,
            padding: 12,
            borderRadius: 8,
            maxHeight: 180,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {log || "—"}
        </pre>
      </section>

      <details open style={{ marginTop: 16 }}>
        <summary style={{ fontWeight: 800, fontSize: 20 }}>Preview (inline)</summary>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, marginTop: 8, padding: 12 }}>
          {html ? (
            <iframe
              title="preview"
              srcDoc={html}
              style={{ width: "100%", height: 900, border: "0", borderRadius: 8, background: "#fff" }}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div style={{ color: "#999", fontStyle: "italic", padding: "24px 0" }}>
              (Nothing yet — click “Generate HTML”)
            </div>
          )}
        </div>
      </details>
    </main>
  );
}

/* -------------------------- tiny inline styles -------------------------- */

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
};

const textarea: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: 12,
  fontSize: 16,
  lineHeight: 1.4,
  outline: "none",
};

const btnBase: React.CSSProperties = {
  borderRadius: 12,
  padding: "14px 18px",
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid transparent",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#2563eb",
  color: "white",
};

const btnOutline: React.CSSProperties = {
  ...btnBase,
  background: "white",
  color: "#111",
  border: "1px solid #e5e7eb",
};
