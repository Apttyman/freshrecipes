"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rewriteImages } from "@/app/lib/html-tools";

type GenResult = { html?: string; slug?: string; log?: string };

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [log, setLog] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  function appendLog(line: string) {
    setLog((s) => (s ? `${s}\n${line}` : line));
  }
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1400);
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
        // Back-compat: send both keys so older API keeps working.
        body: JSON.stringify({ query: prompt, prompt }),
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`✖ Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // SAVE HELPERS
  async function saveWhole() {
    if (!result?.html) return;
    const description = prompt.trim().slice(0, 200);
    const payload = {
      kind: "full" as const,
      title: makeWholeTitle(result.html) ?? "Saved Recipes",
      description: description || "Generated recipes",
      html: result.html,
    };
    const r = await fetch("/api/archive/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      showToast("Save failed");
      return;
    }
    const { id } = (await r.json()) as { id: string };
    showToast("Saved");
    window.open(`/r/${id}`, "_blank", "noopener,noreferrer");
  }

  async function saveCard(article: HTMLElement) {
    const title =
      article.querySelector("h1,h2,h3,h4")?.textContent?.trim() ||
      "Recipe Highlight";
    const html = article.outerHTML;
    const r = await fetch("/api/archive/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "highlight" as const,
        title,
        description: title,
        html,
      }),
    });
    if (!r.ok) {
      showToast("Save failed");
      return;
    }
    const { id } = (await r.json()) as { id: string };
    showToast("Saved");
    window.open(`/r/${id}`, "_blank", "noopener,noreferrer");
  }

  function onSaveHighlightClick(e: Event) {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>("[data-save-highlight]");
    if (!btn) return;
    e.preventDefault();
    const card = btn.closest<HTMLElement>("article");
    if (!card) return;
    void saveCard(card);
  }

  function copyAll() {
    const el = document.querySelector("#recipe-html");
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

  useEffect(() => {
    // delegate clicks for per-card Save buttons rendered within result.html
    function handler(ev: Event) {
      if ((ev.target as HTMLElement | null)?.closest("[data-save-highlight]")) {
        onSaveHighlightClick(ev);
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="container">
      <header className="py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold">FreshRecipes</h1>
            <p className="text-slate-600">
              Type a natural-language request. We’ll fetch and format it.
            </p>
          </div>
          <Link href="/archive" className="btn">
            Open Archive
          </Link>
        </div>
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
          <div className="flex gap-2 flex-wrap">
            <button
              className="btn"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? "Generating…" : "Generate"}
            </button>
            {result?.html ? (
              <>
                <button className="btn" onClick={copyAll} aria-label="Copy all">
                  Copy all
                </button>
                <button
                  className="btn"
                  onClick={saveWhole}
                  aria-label="Save all to archive"
                >
                  Save all to archive
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
            {/* Inject a small button into each recipe card for "Save highlight" */}
            <div
              id="recipe-html"
              dangerouslySetInnerHTML={{
                __html: injectSaveButtons(result.html),
              }}
            />
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

// --- helpers ---

function makeWholeTitle(html: string): string | null {
  const m =
    html.match(/<h1[^>]*>(.*?)<\/h1>/i) ||
    html.match(/<h2[^>]*>(.*?)<\/h2>/i);
  return m ? stripTags(m[1]).slice(0, 120) : null;
}
function stripTags(s: string) {
  // This branch runs in the browser only (client component).
  const div = document.createElement("div");
  div.innerHTML = s;
  return div.textContent || div.innerText || s;
}

/** Injects a "Save highlight" button in each `article` card. */
function injectSaveButtons(html: string): string {
  const toolbar =
    `<div class="btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
       <button class="btn" data-save-highlight aria-label="Save this recipe highlight">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
           <path d="M6 4h12a2 2 0 0 1 2 2v13l-8-4-8 4V6a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" fill="none"/>
         </svg>
         Save highlight
       </button>
     </div>`;

  // Add toolbar near end of each article if possible
  return html.replace(
    /<article\b([^>]*)>([\s\S]*?)<\/article>/gi,
    (_full: string, attrs: string, inner: string) => {
      const injected = inner.replace(
        /<\/div>\s*<\/article>$/i,
        (_match: string) => `${toolbar}</div></article>`
      );
      if (injected !== inner) return `<article${attrs}>${injected}</article>`;
      return `<article${attrs}>${inner}${toolbar}</article>`;
    }
  );
}
