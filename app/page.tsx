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
        // Back-compat: send both keys so older APIs still work
        body: JSON.stringify({ query: prompt, prompt }),
      });
      if (!res.ok) {
        const text = await res.text();
        appendLog(`✖ ${res.status} ${res.statusText}\n${text}`);
        throw new Error(res.statusText);
      }
      const data = (await res.json()) as GenResult;
      const safeHtml = data.html ? rewriteImages(data.html) : "";
      // purely visual: beautify without changing the prompt contract
      const pretty = beautifyToCards(safeHtml);
      setResult({ ...data, html: pretty });
      appendLog("✓ Done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`✖ Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

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
          <Link href="/archive" className="btn">Open Archive</Link>
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
                <button className="btn" onClick={saveWhole} aria-label="Save all to archive">
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
            <div
              id="recipe-html"
              className="recipe-surface"
              // IMPORTANT: we beautify the HTML before inserting (purely presentational)
              dangerouslySetInnerHTML={{ __html: result.html! }}
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

/* ---------- VISUAL HELPERS (no prompt changes) ---------- */

/** Make a reasonable page title from first H1/H2 if present */
function makeWholeTitle(html: string): string | null {
  const m =
    html.match(/<h1[^>]*>(.*?)<\/h1>/i) ||
    html.match(/<h2[^>]*>(.*?)<\/h2>/i);
  return m ? stripTags(m[1]).slice(0, 120) : null;
}
function stripTags(s: string) {
  const div = document.createElement("div");
  div.innerHTML = s;
  return div.textContent || div.innerText || s;
}

/**
 * Purely visual “beautifier”:
 * - If content already has <article> elements -> adds minimal controls and returns.
 * - Otherwise, splits by H2/H3 into cards, wraps in a responsive grid, and injects Save buttons.
 * - Never alters the user/system prompt.
 */
function beautifyToCards(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const alreadyArticles = doc.querySelectorAll("article").length > 0;

    if (!alreadyArticles) {
      // Build cards by splitting on h2/h3 sections
      const root = doc.body;
      const sections = Array.from(root.querySelectorAll("h2, h3"));
      const grid = doc.createElement("div");
      grid.className = "recipe-grid";

      if (sections.length) {
        sections.forEach((hdr, idx) => {
          const card = doc.createElement("article");
          card.className = "recipe-card";
          const body = doc.createElement("div");
          body.className = "recipe-body";

          // Collect nodes until next header
          const nodes: ChildNode[] = [];
          let n = hdr as ChildNode;
          while (n && n.parentNode === root) {
            const next = n.nextSibling;
            nodes.push(n);
            if (next && (next as Element).matches?.("h2, h3")) break;
            n = next as ChildNode;
            if (!n) break;
          }
          nodes.forEach((nd) => body.appendChild(nd));
          card.appendChild(body);
          grid.appendChild(card);

          // optional cover if an <img> immediately follows header
          const firstImg = card.querySelector("img");
          if (firstImg) firstImg.classList.add("recipe-cover");
          const titleEl = card.querySelector("h1,h2,h3,h4");
          if (titleEl) titleEl.classList.add("recipe-title");
        });

        // Replace body with grid
        root.innerHTML = "";
        root.appendChild(grid);
      }

      // Add a big page title if there’s an <h1>
      const h1 = doc.querySelector("h1");
      if (h1) {
        const wrap = doc.createElement("div");
        wrap.className = "recipe-page";
        const subtitle = doc.querySelector("p, .subtitle");
        const gridNode = doc.querySelector(".recipe-grid") || doc.body.firstElementChild;
        wrap.appendChild(h1);
        if (subtitle) {
          const sub = doc.createElement("div");
          sub.className = "recipe-subtitle";
          sub.textContent = subtitle.textContent ?? "";
          subtitle.remove();
          wrap.appendChild(sub);
        }
        if (gridNode) wrap.appendChild(gridNode);
        doc.body.innerHTML = "";
        doc.body.appendChild(wrap);
      }
    }

    // Inject a small "Save highlight" button into each card
    doc.querySelectorAll("article").forEach((a) => {
      const toolbar = doc.createElement("div");
      toolbar.className = "btns";
      toolbar.style.cssText =
        "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px";
      toolbar.innerHTML = `
        <button class="btn" data-save-highlight aria-label="Save this recipe highlight">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 4h12a2 2 0 0 1 2 2v13l-8-4-8 4V6a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          Save highlight
        </button>
      `;
      a.appendChild(toolbar);
    });

    return doc.body.innerHTML;
  } catch {
    // If DOMParser fails, at least add highlight buttons to raw HTML
    return injectSaveButtons(html);
  }
}

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
  return html.replace(
    /<article\b([^>]*)>([\s\S]*?)<\/article>/gi,
    (_full: string, attrs: string, inner: string) =>
      `<article${attrs}>${inner}${toolbar}</article>`
  );
}
