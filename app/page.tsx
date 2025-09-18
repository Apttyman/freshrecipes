// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setDebug(null);
    setHtml("");
    setSlug("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      const text = await res.text(); // read raw
      // try to parse JSON; if it fails, show raw text so the phone UI isn’t blank
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Non-JSON from /api/generate (status ${res.status})`);
        setDebug(text.slice(0, 2000));
        return;
      }

      if (!res.ok) {
        setError(`HTTP ${res.status}`);
      }

      if (data?.error) {
        setError(String(data.error));
      }
      if (data?.rawSnippet) {
        setDebug(String(data.rawSnippet));
      }

      const gotHtml = (data?.html ?? "").toString();
      const gotSlug = (data?.slug ?? "").toString();

      if (gotHtml.trim().length === 0) {
        if (!data?.error) setError("Empty HTML in response.");
        return;
      }

      setHtml(gotHtml);
      setSlug(gotSlug);
    } catch (e: any) {
      setError(`Request failed: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!html) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html, slug }),
      });
      const t = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(t);
      } catch {
        setError(`Non-JSON from /api/save (status ${res.status})`);
        setDebug(t.slice(0, 2000));
        return;
      }

      if (!res.ok || data?.error) {
        setError(`Save failed: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }

      // If API returns a URL, open it. Otherwise notify.
      const url: string | undefined = data?.url || data?.htmlUrl || data?.view;
      if (url) {
        window.location.href = url;
      } else {
        setError(`Save succeeded but no URL was returned by /api/save.`);
      }
    } catch (e: any) {
      setError(`Save request failed: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>Fresh Recipes</h1>
        <a
          href="/archive"
          style={{
            border: "1px solid #ddd",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          Open Archive
        </a>
      </header>

      <section
        style={{
          border: "1px solid #eee",
          padding: 16,
          borderRadius: 16,
          marginTop: 12,
        }}
      >
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>What should we fetch &amp; render?</h2>
        <textarea
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., 3 iconic homemade ice cream recipes with step photos"
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            fontSize: 18,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <button
            onClick={handleGenerate}
            disabled={busy || !input.trim()}
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 14,
              padding: "16px 20px",
              fontSize: 20,
              fontWeight: 700,
              opacity: busy || !input.trim() ? 0.6 : 1,
            }}
          >
            {busy ? "Working…" : "Generate HTML"}
          </button>

          <button
            onClick={handleSave}
            disabled={busy || !html}
            style={{
              background: "white",
              color: "#111",
              border: "1px solid #ddd",
              borderRadius: 14,
              padding: "16px 20px",
              fontSize: 20,
              fontWeight: 700,
              opacity: busy || !html ? 0.5 : 1,
            }}
          >
            Save to Archive
          </button>
        </div>

        {error && (
          <div
            style={{
              color: "#b91c1c",
              background: "#fee2e2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 10,
              marginTop: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {JSON.stringify({ error }, null, 2)}
          </div>
        )}
        {debug && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}>Show raw response (debug)</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
              }}
            >
              {debug}
            </pre>
          </details>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <details open>
          <summary style={{ fontSize: 22, fontWeight: 700 }}>
            Preview (inline)
          </summary>
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              marginTop: 10,
              padding: 4,
              minHeight: 200,
            }}
          >
            {html ? (
              <iframe
                title="preview"
                sandbox="allow-same-origin allow-popups allow-forms"
                style={{ width: "100%", height: "75vh", border: "none", borderRadius: 10 }}
                srcDoc={html}
              />
            ) : (
              <div style={{ color: "#666", padding: 16, fontStyle: "italic" }}>
                Nothing to show yet.
              </div>
            )}
          </div>
        </details>
      </section>
    </main>
  );
}
