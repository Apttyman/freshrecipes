"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * NOTE:
 * - One "Save highlight" button per recipe card (article.recipe-card) — not per section.
 * - We strip any previously injected per-section toolbars and append a single toolbar
 *   to the end of each recipe card.
 * - The save highlight call posts only the ONE recipe’s HTML.
 */

type GenResponse = {
  html?: string;       // model-rendered HTML string
  error?: string;
};

export default function Page() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");

  const previewRef = useRef<HTMLDivElement | null>(null);

  function appendLogLine(s: string) {
    setLog((old) => [...old.slice(-50), s]);
  }

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    appendLogLine(`→ POST /api/generate  q="${query}"`);
    try {
      const res = await fetch(`/api/generate?_=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const body = (await res.json()) as GenResponse;
      if (!body.html) throw new Error("No HTML returned");
      setPreviewHtml(body.html);
      appendLogLine("✓ OK");
    } catch (e: any) {
      const msg = e?.message || "Generation failed";
      setError(msg);
      appendLogLine(`✖ Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // ----- Save APIs -----------------------------------------------------------

  async function saveAllToArchive() {
    try {
      const root = previewRef.current;
      if (!root) return;
      const content = root.innerHTML;
      appendLogLine("→ POST /api/archive (save all)");
      const r = await fetch(`/api/archive?_=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "bundle",
          query,
          html: content,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      appendLogLine("✓ Saved all");
    } catch (e: any) {
      appendLogLine(`✖ Save all error: ${e?.message || e}`);
    }
  }

  async function saveSingleHighlight(cardEl: HTMLElement) {
    try {
      const title =
        cardEl.querySelector("h1, h2, h3, .title")?.textContent?.trim() ||
        "Recipe";
      const html = cardEl.outerHTML;
      appendLogLine(`→ POST /api/archive (highlight "${title}")`);
      const r = await fetch(`/api/archive?_=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "highlight",
          query,
          title,
          html,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      appendLogLine(`✓ Saved highlight: ${title}`);
    } catch (e: any) {
      appendLogLine(`✖ Save highlight error: ${e?.message || e}`);
    }
  }

  // ----- Post-processing: ensure ONE toolbar per recipe ---------------------

  function injectSingleToolbarPerRecipe(container: HTMLElement) {
    // 1) Remove any OLD per-section toolbars we may have injected before.
    container.querySelectorAll(".recipe-toolbar").forEach((n) => n.remove());

    // 2) Find each recipe card and append ONE toolbar at the end.
    const cards = container.querySelectorAll<HTMLElement>(
      "article.recipe-card, article[data-recipe], .recipe-card"
    );
    cards.forEach((card) => {
      // Safety: avoid duplicates if SSR ever includes our toolbar
      if (card.querySelector(":scope > .recipe-toolbar")) return;

      const toolbar = document.createElement("div");
      toolbar.className =
        "recipe-toolbar mx-4 mt-4 mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm";
      toolbar.innerHTML = `
        <div class="flex items-center justify-between gap-3 p-4">
          <button type="button"
            class="save-highlight inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Save highlight
          </button>
        </div>
      `;

      const btn = toolbar.querySelector<HTMLButtonElement>(".save-highlight")!;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        saveSingleHighlight(card);
      });

      card.appendChild(toolbar);
    });
  }

  // After we render the preview HTML, run our injection once.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    injectSingleToolbarPerRecipe(el);
  }, [previewHtml]);

  // For resiliency, re-inject if the model inserts images later (just in case).
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const obs = new MutationObserver(() => injectSingleToolbarPerRecipe(el));
    obs.observe(el, { subtree: true, childList: true });
    return () => obs.disconnect();
  }, []);

  // ----- UI -----------------------------------------------------------------

  const requestLog = useMemo(
    () => log.map((l, i) => <div key={i} className="text-xs text-slate-600">{l}</div>),
    [log]
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
        FreshRecipes
      </h1>
      <p className="mt-2 text-slate-600">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href="/archive"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold shadow-sm hover:bg-slate-50"
        >
          Open Archive
        </a>
      </div>

      <div className="mt-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          placeholder="e.g., 3 top chef pasta recipes"
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 shadow-sm outline-none focus:border-slate-400"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          disabled={loading || !query.trim()}
          onClick={handleGenerate}
          className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>

        <button
          onClick={() => {
            const el = previewRef.current;
            if (!el) return;
            navigator.clipboard.writeText(el.innerText || "");
            appendLogLine("✓ Copied all (text)");
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold shadow-sm hover:bg-slate-50"
        >
          Copy all
        </button>

        <button
          onClick={saveAllToArchive}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold shadow-sm hover:bg-slate-50"
        >
          Save all to archive
        </button>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">Preview</h2>

        <div
          ref={previewRef}
          className="prose prose-slate mt-4 max-w-none"
          // Model-provided HTML
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="font-semibold text-slate-800">Request log</div>
          <div className="mt-2 space-y-1">{requestLog}</div>
        </div>
      </section>
    </main>
  );
}
