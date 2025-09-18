// app/page.tsx
"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GenResult = {
  html?: string;
  slug?: string;
  error?: string;
};

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<GenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string>("");

  function appendLog(line: string) {
    setLog((prev) => (prev ? prev + "\n" + line : line));
  }

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    setLog("");
    try {
      const url = `${window.location.origin}/api/generate?_=${Date.now()}`;
      appendLog(`→ POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      appendLog(`status: ${res.status} ${res.statusText}`);
      const ctype = res.headers.get("content-type") || "";
      appendLog(`content-type: ${ctype}`);

      if (ctype.includes("application/json")) {
        const data = (await res.json()) as GenResult;
        if (data.error) {
          setResult({ error: data.error });
          appendLog(`error: ${data.error}`);
          return;
        }
        setResult({ html: data.html ?? "", slug: data.slug });
        appendLog(`ok: ${data.html?.length || 0} bytes`);
      } else {
        const text = await res.text();
        appendLog(`raw: ${text.slice(0, 200)}…`);
        setResult({ error: "Unexpected non-JSON response" });
      }
    } catch (err: any) {
      appendLog(`threw: ${String(err)}`);
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result?.html) {
      appendLog("No HTML to save");
      return;
    }
    try {
      const url = `${window.location.origin}/api/save?_=${Date.now()}`;
      appendLog(`→ POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          html: result.html,
          title: prompt.trim().slice(0, 60) || "Recipe",
        }),
      });
      appendLog(`status: ${res.status} ${res.statusText}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        appendLog(`save error: ${JSON.stringify(data)}`);
        return;
      }
      const viewUrl =
        data?.viewUrl ||
        data?.url ||
        (data?.slug ? `/archive/${encodeURIComponent(data.slug)}` : null);
      if (viewUrl) {
        window.location.href = viewUrl;
      } else {
        appendLog("Save succeeded but no URL returned");
      }
    } catch (err: any) {
      appendLog(`save threw: ${String(err)}`);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
      <h1>Fresh Recipes</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Type your recipe request…"
        style={{ width: "100%", marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
          {loading ? "Generating…" : "Generate HTML"}
        </button>
        <button onClick={handleSave} disabled={!result?.html}>
          Save to Archive
        </button>
      </div>

      <pre
        style={{
          background: "#111",
          color: "#eee",
          padding: 12,
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          marginBottom: 12,
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        {log || "Logs will appear here…"}
      </pre>

      {result?.error ? (
        <div style={{ color: "red" }}>{result.error}</div>
      ) : result?.html ? (
        <iframe
          srcDoc={result.html}
          style={{ width: "100%", minHeight: 600, border: "1px solid #ccc" }}
        />
      ) : null}
    </main>
  );
}
