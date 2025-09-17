// app/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [html, setHtml] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setStatus("");
    setLoading(true);
    setHtml("");
    setSlug("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      // Non-200? Still try to read the body for debug
      const data = await res.json().catch(() => ({} as any));

      // Expecting: { html, slug, rawSnippet?, error? }
      const pageHtml = (data?.html ?? "").toString();
      const newSlug = (data?.slug ?? "").toString();

      if (pageHtml.trim()) {
        setHtml(pageHtml);
        setSlug(newSlug);
      } else {
        // Visible debug right in the page (no DevTools needed)
        const dbg = `
<pre style="white-space:pre-wrap;font:13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:#b00020; padding:12px; border:1px solid #f3c; border-radius:8px; background:#fff5f8">
⚠️ Debug: No HTML returned by /api/generate
HTTP: ${res.status} ${res.statusText || ""}
Error: ${data?.error || "(none)"}

Raw snippet:
${(data?.rawSnippet ?? "").toString() || "(empty)"}
</pre>`;
        setHtml(dbg);
        setSlug(newSlug);
      }
    } catch (err: any) {
      setHtml(
        `<pre style="white-space:pre-wrap;font:13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:#b00020; padding:12px; border:1px dashed #f99; border-radius:8px; background:#fff5f8">
🚫 Network error calling /api/generate

${String(err)}
</pre>`
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!html.trim()) {
      setStatus("Nothing to save yet.");
      return;
    }
    setSaving(true);
    setStatus("");

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, html }),
      });

      const data = await res.json().catch(() => ({} as any));

      // Prefer API-provided URL; otherwise fall back to pretty route
      const url =
        (data?.url as string) ||
        (slug ? `/recipes/${encodeURIComponent(slug)}` : "");

      if (res.ok && url) {
        setStatus(`✅ Saved. Open: ${url}`);
      } else if (res.ok) {
        setStatus(
          `⚠️ Save succeeded but no URL was returned by /api/save. Slug: ${slug || "(none)"}`
        );
      } else {
        setStatus(`❌ Save failed: ${data?.error || res.statusText}`);
      }
    } catch (err: any) {
      setStatus(`❌ Save error: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>
          Fresh Recipes
        </h1>
        <Link
          href="/archive"
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "10px 14px",
            textDecoration: "none",
            background: "#f7f7f7",
          }}
        >
          Open Archive
        </Link>
      </header>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: "#fff",
        }}
      >
        <label
          htmlFor="prompt"
          style={{ display: "block", fontWeight: 700, marginBottom: 8 }}
        >
          What should we fetch &amp; render?
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "3 recipes of homemade ice cream with cool photos"'
          rows={4}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            outline: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{
              cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px 18px",
              fontWeight: 700,
              minWidth: 180,
            }}
          >
            {loading ? "Generating…" : "Generate HTML"}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !html.trim()}
            style={{
              cursor: saving || !html.trim() ? "not-allowed" : "pointer",
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px 18px",
              fontWeight: 700,
              minWidth: 180,
              opacity: html.trim() ? 1 : 0.4,
            }}
          >
            {saving ? "Saving…" : "Save to Archive"}
          </button>
        </div>

        {status && (
          <p
            style={{
              marginTop: 10,
              color: status.startsWith("✅") ? "#065f46" : "#b00020",
              fontSize: 14,
              wordBreak: "break-word",
            }}
          >
            {status.startsWith("✅") ? (
              <>
                ✅ Saved.{" "}
                <a
                  href={status.replace(/^✅ Saved\. Open:\s*/, "")}
                  style={{ color: "#2563eb" }}
                >
                  Open saved page
                </a>
              </>
            ) : (
              status
            )}
          </p>
        )}
      </section>

      <details open style={{ marginTop: 8 }}>
        <summary
          style={{
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 8,
          }}
        >
          Preview (inline)
        </summary>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: 12,
            minHeight: 240,
            overflow: "auto",
          }}
          // On purpose: this is a preview surface for fully-formed HTML
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </details>
    </main>
  );
}
