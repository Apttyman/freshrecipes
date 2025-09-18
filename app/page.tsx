"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GenResult = { html?: string; error?: string; slug?: string };

export default function Home() {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState("");
  const [log, setLog] = useState<string>("");

  async function generate() {
    setLog("");
    setPreview("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: query }),
      });
      const txt = `POST /api/generate …\nstatus ${res.status}  |  ${res.headers
        .get("content-type")
        ?.split(";")[0]}\n`;
      const data = (await res.json()) as GenResult;
      setLog(txt + (data.error ? `ERR: ${data.error}` : `OK (${(data.html ?? "").length} bytes)`));

      if (data.error) {
        alert(data.error);
        return;
      }
      setPreview(data.html ?? "");
    } catch (e: any) {
      setLog(`Generate failed: ${String(e)}`);
      alert(`Generate failed: ${String(e)}`);
    }
  }

  async function saveToArchive() {
    if (!preview) {
      alert("Nothing to save yet.");
      return;
    }
    // naive title: first <h1> text or fallback
    const titleMatch = preview.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Recipe";

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: preview, title }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Save failed");
        return;
      }

      // Expect `url` (server now guarantees this)
      if (data?.url) {
        window.location.href = data.url; // navigate to archive page
        return;
      }

      // Fallbacks if user still has an old client/server mismatch
      if (data?.viewUrl) {
        window.location.href = data.viewUrl;
        return;
      }
      if (data?.slug) {
        window.location.href = `/archive/${encodeURIComponent(data.slug)}`;
        return;
      }

      // If absolutely nothing usable, show a single alert (matches your prior UX)
      alert("Save succeeded but no URL was returned by /api/save.");
    } catch (e: any) {
      alert(`Save failed: ${String(e)}`);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: 0 }}>Fresh Recipes</h1>
        <a
          href="/archive"
          style={{
            textDecoration: "none",
            border: "1px solid #ddd",
            padding: "12px 16px",
            borderRadius: 12,
            fontWeight: 600,
          }}
        >
          Open Archive
        </a>
      </header>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          background: "#fff",
        }}
      >
        <label style={{ fontWeight: 700, fontSize: 22, display: "block", marginBottom: 8 }}>
          What should we fetch & render?
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          placeholder="e.g. 3 iconic Peruvian chicken recipes with photos"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontSize: 18,
          }}
        />
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <button
            onClick={generate}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "14px 18px",
              borderRadius: 14,
              fontSize: 20,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Generate HTML
          </button>
          <button
            onClick={saveToArchive}
            disabled={!preview}
            style={{
              opacity: preview ? 1 : 0.5,
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              padding: "14px 18px",
              borderRadius: 14,
              fontSize: 20,
              fontWeight: 700,
              cursor: preview ? "pointer" : "default",
            }}
          >
            Save to Archive
          </button>
        </div>

        {/* Tiny log */}
        <pre
          style={{
            marginTop: 16,
            whiteSpace: "pre-wrap",
            background: "#0b0b0b",
            color: "#e5e7eb",
            padding: 12,
            borderRadius: 12,
            fontSize: 14,
          }}
        >
          {log}
        </pre>
      </section>

      {/* Preview */}
      <details open style={{ marginTop: 24 }}>
        <summary style={{ fontWeight: 800, fontSize: 24 }}>Preview (inline)</summary>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 12,
            marginTop: 12,
            background: "#fff",
          }}
          // we deliberately render raw HTML for preview
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </details>
    </main>
  );
}
