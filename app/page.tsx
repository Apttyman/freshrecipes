"use client";

import { useState } from "react";
import { rewriteImages } from "@/app/lib/html-tools";

type GenResult = {
  html?: string;
  slug?: string;
  log?: string;
};

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [log, setLog] = useState("");
  const [toast, setToast] = useState<string>("");

  function appendLog(line: string) {
    setLog((s) => (s ? `${s}\n${line}` : line));
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
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) {
        const text = await res.text();
        appendLog(`✖ ${res.status} ${res.statusText}\n${text}`);
        throw new Error(res.statusText);
      }
      const data = (await res.json()) as GenResult;
      const safeHtml = data.html ? rewriteImages(data.html) : "";
      setResult({ ...data, html: safeHtml });
      appendLog("✓ Done");
    } catch (e: any) {
      appendLog(`✖ Error: ${e?.message ?? "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1400);
  }

  function copyFrom(selector: string) {
    const el = document.querySelector(selector);
    if (!el) return;
    const text = el.textContent?.trim() ?? "";
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast("Copied"));
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Copied");
  }

  return (
    <div className="container">
      <header className="py-8">
        <h1 className="text-3xl font-semibold">FreshRecipes</h1>
        <p className="text-slate-600">
          Type a natural-language request. We’ll fetch and format it.
        </p>
      </header>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <textarea
            aria-label="Recipe request"
            className="w-full rounded-lg border p-4 min-h-[140px]"
            placeholder="e.g., 3 Peruvian chicken recipes from named chefs; include ingredients and steps"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? "Generating…" : "Generate"}
            </button>
            {result?.html ? (
              <>
                <button
                  className="btn"
                  onClick={() => copyFrom("#recipe-html")}
                  aria-label="Copy all visible recipe text"
                >
                  Copy all
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    const w = window.open(
                      "",
                      "_blank",
                      "noopener,noreferrer,width=900,height=800"
                    );
                    if (!w || !result?.html) return;
                    w.document.write(
                      `<!doctype html><html><head><meta charset="utf-8"><title>Print recipes</title></head><body>${result.html}</body></html>`
                    );
                    w.document.close();
                    w.focus();
                    w.print();
                  }}
                >
                  Print
                </button>
              </>
            ) : null}
          </div>
        </div>

        {result?.html ? (
          <section aria-labelledby="preview" className="card p-4">
            <h2 id="preview" className="text-xl font-semibold mb-2">
              Preview
            </h2>
            <div id="recipe-html" dangerouslySetInnerHTML={{ __html: result.html }} />
          </section>
        ) : null}

        <details className="card p-4">
          <summary className="font-semibold cursor-pointer">Request log</summary>
          <pre className="text-sm whitespace-pre-wrap mt-2">{log}</pre>
        </details>
      </div>

      <button
        aria-label="Back to top"
        className="fixed right-4 bottom-4 btn"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ↑ Top
      </button>

      <div
        role="status"
        aria-atomic="true"
        aria-live="polite"
        className={`toast ${toast ? "show" : ""}`}
      >
        {toast}
      </div>
    </div>
  );
}
