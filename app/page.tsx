// app/page.tsx
// app/page.tsx (very top)
export const dynamic = "force-dynamic";
export const revalidate = 0;

"use client";

import { useState } from "react";

type GenResult = {
  html?: string;
  slug?: string;
  error?: string;
  rawSnippet?: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [html, setHtml] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const [uiError, setUiError] = useState<string | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);

  // always-visible small log so you can debug on phone
  const [log, setLog] = useState<string[]>([]);
  const appendLog = (msg: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${msg}`].slice(-20));

  async function handleGenerate() {
    setBusy(true);
    setUiError(null);
    setRawFallback(null);
    setHtml("");
    setSlug("");
    setLog([]);

    try {
      appendLog("POST /api/generate …");
      const res = await fetch(`/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // send both `prompt` and `q` just in case server expects either
        body: JSON.stringify({ prompt: input, q: input }),
      });

      const contentType = res.headers.get("content-type") || "unknown";
      const text = await res.text();
      appendLog(`status ${res.status} ${res.ok ? "OK" : "ERR"} | ${contentType} | ${text.length} bytes`);

      // If it’s not JSON, show the body so it doesn’t look blank
      if (!contentType.toLowerCase().includes("application/json")) {
        setUiError(`Non-JSON from /api/generate (HTTP ${res.status})`);
        setRawFallback(text.slice(0, 2000));
        return;
      }

      let data: GenResult;
      try {
        data = JSON.parse(text);
      } catch (e: any) {
        setUiError(`JSON parse error from /api/generate`);
        setRawFallback(text.slice(0, 2000));
        return;
      }

      if (!res.ok || data.error) {
        setUiError(data.error ? String(data.error) : `HTTP ${res.status}`);
        if (data.rawSnippet) setRawFallback(String(data.rawSnippet));
        return;
      }

      const gotHtml = (data.html || "").toString();
      const gotSlug = (data.slug || "").toString();

      if (!gotHtml.trim()) {
        setUiError("Empty HTML in response.");
        if (data.rawSnippet) setRawFallback(String(data.rawSnippet));
        return;
      }

      setHtml(gotHtml);
      setSlug(gotSlug);
      appendLog(`Rendered HTML (${gotHtml.length} chars)`);
    } catch (e: any) {
      setUiError(`Request failed: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!html) return;
    setBusy(true);
    setUiError(null);

    try {
      appendLog("POST /api/save …");
      const res = await fetch(`/api/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html, slug }),
      });

      const ct = res.headers.get("content-type") || "unknown";
      const t = await res.text();
      appendLog(`save status ${res.status} | ${ct} | ${t.length} bytes`);

      if (!ct.toLowerCase().includes("application/json")) {
        setUiError(`Non-JSON from /api/save (HTTP ${res.status})`);
        setRawFallback(t.slice(0, 2000));
        return;
      }

      let data: any;
      try {
        data = JSON.parse(t);
      } catch {
        setUiError("JSON parse error from /api/save.");
        setRawFallback(t.slice(0, 2000));
        return;
      }

      if (!res.ok || data?.error) {
        setUiError(`Save failed: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }

      const url: string | undefined = data?.url || data?.htmlUrl || data?.view;
      if (url) {
        window.location.href = url;
      } else {
        setUiError("Save succeeded but no URL was returned by /api/save.");
      }
    } catch (e: any) {
      setUiError(`Save request failed: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>Fresh Recipes</h1>
        <a
          href="/archive"
          style={{ border: "1px solid #ddd", padding: "10px 14px", borderRadius: 10, textDecoration: "none" }}
        >
          Open Archive
        </a>
      </header>

      <section style={{ border: "1px solid #eee", padding: 16, borderRadius: 16, marginTop: 12 }}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>What should we fetch &amp; render?</h2>
        <textarea
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., 3 homemade ice cream recipes with step photos"
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

        {/* Inline network log for phone debugging */}
        <details open style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Network log</summary>
          <pre
            style={{
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 160,
              overflow: "auto",
            }}
          >
            {log.join("\n") || "—"}
          </pre>
        </details>

        {uiError && (
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
            {uiError}
          </div>
        )}
        {rawFallback && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}>Show raw response (first 2KB)</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
              }}
            >
              {rawFallback}
            </pre>
          </details>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <details open>
          <summary style={{ fontSize: 22, fontWeight: 700 }}>Preview (inline)</summary>
          <div style={{ border: "1px solid #eee", borderRadius: 12, marginTop: 10, padding: 4, minHeight: 200 }}>
            {html ? (
              <iframe
                title="preview"
                sandbox="allow-same-origin allow-popups allow-forms"
                style={{ width: "100%", height: "75vh", border: "none", borderRadius: 10 }}
                srcDoc={html}
              />
            ) : (
              <div style={{ color: "#666", padding: 16, fontStyle: "italic" }}>Nothing to show yet.</div>
            )}
          </div>
        </details>
      </section>
    </main>
  );
}
