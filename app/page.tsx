// app/page.tsx
"use client"; // MUST be first

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useState } from "react";

type GenResult = { html?: string; slug?: string; error?: string; debug?: any };

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [html, setHtml] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [log, setLog] = useState<string>("");

  async function handleGenerate() {
    setErr("");
    setHtml("");
    setSlug("");
    setLog("");

    const url = `/api/generate?v=${Date.now()}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      // Minimal network debug (shows up on the page)
      const ct = res.headers.get("content-type") || "";
      const sz = res.headers.get("content-length") || "";
      setLog(
        `request: POST ${url}\nstatus: ${res.status}\ncontent-type: ${ct}\ncontent-length: ${sz}`
      );

      // If server didn’t return JSON, surface raw body
      if (!ct.includes("application/json")) {
        const raw = await res.text();
        setErr(`Non-JSON response:\n${raw.slice(0, 2000)}`);
        return;
      }

      const data: GenResult = await res.json();

      if (data.error) {
        setErr(data.error);
        return;
      }
      setHtml(data.html || "");
      setSlug(data.slug || "");
    } catch (e: any) {
      setErr(`Network error: ${e?.message || String(e)}`);
    }
  }

  async function handleSave() {
    setErr("");
    if (!html) return;

    try {
      const res = await fetch(`/api/save?v=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, slug }),
      });

      const ct = res.headers.get("content-type") || "";
      const sz = res.headers.get("content-length") || "";
      setLog(
        (prev) =>
          prev +
          `\n\nrequest: POST /api/save\nstatus: ${res.status}\ncontent-type: ${ct}\ncontent-length: ${sz}`
      );

      if (!ct.includes("application/json")) {
        const raw = await res.text();
        setErr(`Save returned non-JSON:\n${raw.slice(0, 2000)}`);
        return;
      }

      const data = await res.json();
      if (data.error) {
        setErr(data.error);
        return;
      }
      // Optionally navigate: window.location.href = `/archive/${slug}`;
    } catch (e: any) {
      setErr(`Save error: ${e?.message || String(e)}`);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 40, margin: 0 }}>Fresh Recipes</h1>
        <a
          href="/archive"
          style={{
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 10,
            textDecoration: "none",
            background: "#fff",
          }}
        >
          Open Archive
        </a>
      </header>

      {/* tiny build stamp so you can confirm updates */}
      <div style={{ color: "#888", fontSize: 12, marginTop: 6 }}>
        build: {new Date().toISOString().slice(11, 19)}
      </div>

      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          marginTop: 20,
          background: "#fafafa",
        }}
      >
        <label style={{ fontWeight: 700, fontSize: 20 }}>
          What should we fetch &amp; render?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. 3 iconic homemade ice cream recipes with step photos"
          style={{
            width: "100%",
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontSize: 18,
          }}
        />

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <button
            onClick={handleGenerate}
            style={{
              padding: "16px 20px",
              background: "#1e63ff",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            Generate HTML
          </button>

          <button
            onClick={handleSave}
            disabled={!html}
            style={{
              padding: "16px 20px",
              background: html ? "#fff" : "#f3f3f3",
              color: "#111",
              border: "1px solid #ddd",
              borderRadius: 12,
              fontSize: 20,
              fontWeight: 700,
              opacity: html ? 1 : 0.6,
            }}
          >
            Save to Archive
          </button>
        </div>

        {/* inline debug */}
        {log && (
          <pre
            style={{
              marginTop: 12,
              whiteSpace: "pre-wrap",
              background: "#f7f7ff",
              border: "1px dashed #cbd5ff",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
            }}
          >
            {log}
          </pre>
        )}

        {err && (
          <div style={{ color: "#c00", marginTop: 12, fontFamily: "ui-monospace, monospace" }}>
            {JSON.stringify({ error: err })}
          </div>
        )}
      </section>

      {/* Preview */}
      <details open style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 20, fontWeight: 800 }}>Preview (inline)</summary>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 10,
            marginTop: 10,
            minHeight: 200,
            background: "#fff",
          }}
        >
          {html ? (
            <iframe
              title="preview"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: 800, border: 0, borderRadius: 12 }}
              srcDoc={html}
            />
          ) : (
            <div style={{ color: "#999" }}>No content yet.</div>
          )}
        </div>
      </details>
    </main>
  );
}
