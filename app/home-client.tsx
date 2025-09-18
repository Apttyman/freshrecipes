// app/home-client.tsx — CLIENT UI
"use client";

import { useState } from "react";

type GenResult = {
  html?: string;
  slug?: string;
  error?: string;
  debug?: string;
};

export default function HomeClient() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<GenResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setRes(null);
    try {
      const r = await fetch(`/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });
      const j: GenResult = await r.json();
      setRes(j);
    } catch (e: any) {
      setRes({ error: String(e) });
    }
  }

  async function save() {
    if (!res?.html) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: res.html, slug: res.slug }),
      });
      const j = await r.json();
      setSaving(false);
      if (j?.url) {
        window.location.href = j.url;
      } else {
        alert(
          j?.error ||
            "Save succeeded but no URL was returned by /api/save."
        );
      }
    } catch (e: any) {
      setSaving(false);
      alert(String(e));
    }
  }

  return (
    <main style={{ maxWidth: 840, margin: "24px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 36, margin: 0 }}>Fresh Recipes</h1>
        <a
          href="/archive"
          style={{
            textDecoration: "none",
            border: "1px solid #ccc",
            padding: "10px 14px",
            borderRadius: 10,
          }}
        >
          Open Archive
        </a>
      </header>

      <section
        style={{
          marginTop: 24,
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>What should we fetch &amp; render?</h2>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g., 3 iconic homemade ice cream recipes with step photos"
          rows={4}
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
            onClick={generate}
            style={{
              background: "#2563eb",
              color: "#fff",
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              fontSize: 18,
            }}
          >
            Generate HTML
          </button>
          <button
            onClick={save}
            disabled={!res?.html || saving}
            style={{
              background: "#fff",
              color: "#111",
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 18,
              opacity: !res?.html || saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save to Archive"}
          </button>
        </div>

        {res?.error && (
          <p style={{ color: "crimson", marginTop: 12 }}>
            {JSON.stringify({ error: res.error })}
          </p>
        )}
      </section>

      {res?.debug && (
        <details style={{ marginTop: 18 }}>
          <summary>Debug</summary>
          <pre
            style={{
              background: "#f6f8fa",
              border: "1px solid #eee",
              padding: 12,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              borderRadius: 8,
            }}
          >
{res.debug}
          </pre>
        </details>
      )}

      <details open={!!res?.html} style={{ marginTop: 18 }}>
        <summary style={{ fontSize: 20, fontWeight: 700 }}>
          Preview (inline)
        </summary>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 12,
            marginTop: 8,
            minHeight: 120,
          }}
          dangerouslySetInnerHTML={{ __html: res?.html || "" }}
        />
      </details>
    </main>
  );
}
