"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rewriteImages } from "@/app/lib/html-tools";

type GenResult = { html?: string; slug?: string; error?: string; detail?: string };

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultHtml, setResultHtml] = useState<string>("");
  const [log, setLog] = useState("");
  const [toast, setToast] = useState("");

  function appendLog(line: string) {
    setLog((s) => (s ? `${s}\n${line}` : line));
  }
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1400);
  }

  async function handleGenerate() {
    setLoading(true);
    setResultHtml("");
    setLog("");

    try {
      const url = `${window.location.origin}/api/generate?_=${Date.now()}`;
      appendLog(`→ POST ${url}`);

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: prompt, prompt }), // server accepts either key
      });

      const text = await res.text(); // <— INSIDE async fn
      if (!res.ok) {
        appendLog(`✖ ${res.status} ${res.statusText}\n${text || "(no body)"}`);
        throw new Error(res.statusText);
      }

      const data: GenResult = text ? JSON.parse(text) : {};
      const raw = data.html || "";
      const safe = rewriteImages(raw);
      const pretty = ensureCardsWithoutLosingContent(safe);
      setResultHtml(pretty);
      appendLog("✓ Done");
    } catch (e: any) {
      appendLog(`✖ Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------- SAVE HELPERS ----------
  async function saveWhole() {
    if (!resultHtml) return;
    const description = prompt.trim().slice(0, 200) || "Generated recipes";

    appendLog("→ Save all to archive");
    const r = await fetch("/api/archive/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "full",
        title: makeWholeTitle(resultHtml) ?? "Saved Recipes",
        description,
        html: resultHtml,
      }),
    });

    const body = await r.text();
    if (!r.ok) {
      appendLog(`✖ Save failed ${r.status}\n${body || "(no body)"}`);
      showToast("Save failed");
      return;
    }
    const { id } = JSON.parse(body) as { id: string };
    appendLog(`✓ Saved as ${id}`);
    showToast("Saved");
    window.open(`/r/${id}`, "_blank", "noopener,noreferrer");
  }

  async function saveCard(article: HTMLElement) {
    const title =
      article.querySelector("h1,h2,h3,h4")?.textContent?.trim() ||
      "Recipe Highlight";
    const html = article.outerHTML;

    appendLog(`→ Save highlight: ${title}`);
    const r = await fetch("/api/archive/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "highlight",
        title,
        description: title,
        html,
      }),
    });

    const body = await r.text();
    if (!r.ok) {
      appendLog(`✖ Save highlight failed ${r.status}\n${body || "(no body)"}`);
      showToast("Save failed");
      return;
    }
    const { id } = JSON.parse(body) as { id: string };
    appendLog(`✓ Highlight saved as ${id}`);
    showToast("Saved");
    window.open(`/r/${id}`, "_blank", "noopener,noreferrer");
  }

  function onSaveHighlightClick(e: Event) {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "[data-save-highlight]"
    );
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
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Copied");
    }
  }

  useEffect(() => {
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
            {resultHtml ? (
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

        {resultHtml ? (
          <section aria-labelledby="preview" className="card p-4">
            <h2 id="preview" className="text-xl font-semibold mb-2">
              Preview
            </h2>
            <div
              id="recipe-html"
              className="recipe-surface"
              // HTML is already beautified & safe, do not mutate on the fly
              dangerouslySetInnerHTML={{ __html: resultHtml }}
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

/* ----------- SAFE VISUAL WRAPPER (no content loss) ----------- */

function makeWholeTitle(html: string): string | null {
  const m =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? stripTags(m[1]).slice(0, 120) : null;
}
function stripTags(s: string) {
  const div = document.createElement("div");
  div.innerHTML = s;
  return div.textContent || div.innerText || s;
}

/**
 * If there are <article> cards, just add Save buttons.
 * Else, keep all content and wrap into cards by <h2> sections,
 * or a single card if no <h2> exists.
 */
function ensureCardsWithoutLosingContent(html: string): string {
  const toolbar = `
    <div class="btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn" data-save-highlight aria-label="Save this recipe highlight">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 4h12a2 2 0 0 1 2 2v13l-8-4-8 4V6a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        Save highlight
      </button>
    </div>`;

  // Already carded? just add buttons
  if (/<article\b/i.test(html)) {
    return html.replace(/<\/article>/gi, `${toolbar}</article>`);
  }

  // Optional title extraction
  let header = "";
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  if (h1Match) {
    header = h1Match[0];
    html = html.replace(h1Match[0], "");
  }

  // Split on H2 sections
  const parts = html
    .split(/(?=<h2\b[^>]*>)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const makeCard = (content: string) =>
    `<article class="recipe-card"><div class="recipe-body">${content}</div>${toolbar}</article>`;

  if (parts.length > 1) {
    return `<div class="recipe-page">${header}<div class="recipe-grid">${parts
      .map(makeCard)
      .join("")}</div></div>`;
  }

  // Single card fallback
  return `<div class="recipe-page">${header}<div class="recipe-grid">${makeCard(
    html
  )}</div></div>`;
}
