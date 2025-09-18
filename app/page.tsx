"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { rewriteImages, normalizeModelHtml } from "@/app/lib/html-tools";

// Types for API responses
type GenOk = {
  ok: true;
  id: string; // id for this generation (used when saving)
  title?: string;
  html: string; // full HTML returned by /api/generate
};

type GenErr = { ok: false; error: string };

type RecipeCard = {
  id: string;
  title: string;
  author?: string;
  html: string; // inner HTML of the card
};

// Small UI atoms
const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }
> = ({ variant = "primary", className = "", children, ...props }) => {
  const base =
    "rounded-xl border text-sm font-semibold px-5 h-11 inline-flex items-center gap-2 transition";
  const styles =
    variant === "primary"
      ? "bg-white border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100"
      : "bg-transparent border-slate-300 hover:bg-slate-100";
  return (
    <button {...props} className={`${base} ${styles} ${className}`.trim()}>
      {children}
    </button>
  );
};

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div
    {...props}
    className={`rounded-2xl border border-slate-200 shadow-sm bg-white ${className}`.trim()}
  >
    {children}
  </div>
);

// ------- helpers to split model HTML into recipe cards -----------------

/**
 * Given the model's full HTML, split into logical recipe "cards".
 * This is purely DOM-based so we avoid brittle regex.
 */
function extractRecipeCards(fullHtml: string): RecipeCard[] {
  const html = rewriteImages(fullHtml); // also normalizes markdown fences
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Strategy:
  // - A recipe begins at each H2 (or H1 if present).
  // - A "card" includes that heading plus content until the next H2.
  // - If there are no H2s, one big card using H1 title or first heading.
  const headings = doc.querySelectorAll("h2, h1");
  const body = doc.body;

  const cards: RecipeCard[] = [];

  if (headings.length === 0) {
    // Single card fallback
    const title =
      body.querySelector("h1,h2,h3")?.textContent?.trim() || "Recipe";
    cards.push({
      id: "recipe-0",
      title,
      html: body.innerHTML,
    });
    return cards;
  }

  headings.forEach((h, index) => {
    const title = h.textContent?.trim() || `Recipe ${index + 1}`;
    const art = doc.createElement("article");

    // Move this heading into the article (clone to preserve original until we relocate)
    art.appendChild(h.cloneNode(true));

    // Gather all following siblings until the next H2/H1
    const bodyDiv = doc.createElement("div");
    let node: ChildNode | null = h;

    // ---- FIX: rename `next` -> `nextNode` and give explicit type ----
    while (node) {
      const nextNode: ChildNode | null = node.nextSibling;
      if (node !== h) {
        bodyDiv.appendChild(node.cloneNode(true));
      }
      if (nextNode && (nextNode as Element).matches?.("h1,h2")) break;
      node = nextNode;
    }

    art.appendChild(bodyDiv);

    cards.push({
      id: `recipe-${index}`,
      title,
      html: art.innerHTML,
    });
  });

  // De-dup cards if DOM quirks created overlaps
  return cards.filter((c, i, arr) => arr.findIndex((x) => x.html === c.html) === i);
}

// ----------------- Main Page ------------------------------------------

export default function Page() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [gen, setGen] = useState<GenOk | null>(null);

  const reqIdRef = useRef(0);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  const onGenerate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setGen(null);
    const id = ++reqIdRef.current;

    try {
      const url = `/api/generate?_=${Date.now()}`;
      appendLog(`→ POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const text = await res.text();
      let data: GenOk | GenErr;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, error: text || "Malformed response" };
      }

      if (!res.ok || (data as GenErr).error) {
        const err = (data as GenErr).error || `HTTP ${res.status}`;
        appendLog(`✖ ${res.status} ${err}`);
        setError(err);
        setBusy(false);
        return;
      }

      const ok = data as GenOk;
      // Normalize HTML once here so downstream is consistent
      const normalized = normalizeModelHtml(ok.html);
      setGen({ ...ok, html: normalized });
      appendLog(`✓ Response ${res.status}`);
    } catch (e: any) {
      const msg = e?.message || "Load failed";
      appendLog(`✖ Error: ${msg}`);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [appendLog, query]);

  const cards = useMemo<RecipeCard[]>(() => {
    if (!gen?.html) return [];
    return extractRecipeCards(gen.html);
  }, [gen]);

  const saveAllToArchive = useCallback(async () => {
    if (!gen) return;
    try {
      const res = await fetch("/api/archive/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          html: gen.html,
          title: gen.title || query || "FreshRecipes Result",
          kind: "full",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      appendLog("✓ Saved whole result to archive");
      alert("Saved whole result to archive.");
    } catch (e: any) {
      appendLog(`✖ Save failed: ${e?.message || e}`);
      alert("Save failed.");
    }
  }, [appendLog, gen, query]);

  const saveHighlight = useCallback(
    async (card: RecipeCard) => {
      try {
        const res = await fetch("/api/archive/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            html: card.html,
            title: card.title,
            kind: "highlight",
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        appendLog(`✓ Saved highlight: ${card.title}`);
        alert(`Saved highlight: ${card.title}`);
      } catch (e: any) {
        appendLog(`✖ Save highlight failed: ${e?.message || e}`);
        alert("Save highlight failed.");
      }
    },
    [appendLog, query]
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          FreshRecipes
        </h1>
        <p className="mt-2 text-slate-600">
          Type a natural-language request. We’ll fetch and format it.
        </p>
      </header>

      <div className="flex gap-3 mb-4">
        <Link href="/archive" className="no-underline">
          <Button variant="primary">Open Archive</Button>
        </Link>
      </div>

      <Card className="p-4 mb-4">
        <label className="block text-base font-semibold text-slate-800 mb-2">
          Your request
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., 3 chicken recipes by famous chefs"
          rows={4}
          className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={onGenerate} disabled={busy || !query.trim()}>
            {busy ? "Generating…" : "Generate"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (!gen?.html) return;
              navigator.clipboard.writeText(gen.html);
              appendLog("✓ Copied full HTML to clipboard");
            }}
            disabled={!gen?.html}
          >
            Copy all
          </Button>
          <Button
            variant="ghost"
            onClick={saveAllToArchive}
            disabled={!gen?.html}
          >
            Save all to archive
          </Button>
        </div>
      </Card>

      {/* Inline Preview */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Preview</h2>

        {error && (
          <Card className="p-4 mb-4 border-red-200">
            <p className="text-red-600 font-semibold">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        )}

        {!error && !gen && (
          <p className="text-slate-500">No result yet. Try generating above.</p>
        )}

        {!error && gen && cards.length === 0 && (
          <Card className="p-6">
            <p className="text-slate-600">
              No recipe sections detected. Showing raw output:
            </p>
            <div
              className="prose prose-slate mt-4"
              dangerouslySetInnerHTML={{ __html: gen.html }}
            />
          </Card>
        )}

        {!error && cards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {cards.map((card) => (
              <Card key={card.id} className="overflow-hidden">
                <div className="p-5">
                  <h3 className="text-xl font-bold leading-tight mb-2">
                    {card.title}
                  </h3>
                  <div
                    className="prose prose-slate max-w-none [&_.recipe-cover]:w-full [&_.recipe-cover]:rounded-xl [&_.recipe-cover]:mb-4"
                    dangerouslySetInnerHTML={{ __html: card.html }}
                  />
                </div>
                <div className="border-t border-slate-200 p-4">
                  <Button
                    variant="primary"
                    onClick={() => saveHighlight(card)}
                    className="w-full justify-center"
                  >
                    {/* inline svg bookmark */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                    </svg>
                    Save highlight
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Request Log */}
      <section className="mb-20">
        <Card className="p-4">
          <details open>
            <summary className="font-semibold">Request log</summary>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
              {log.map((l, i) => (i ? "\n" : "") + l)}
            </pre>
          </details>
        </Card>
      </section>

      {/* Back to top */}
      <a
        href="#"
        className="fixed bottom-5 right-5 rounded-full shadow-md bg-white border border-slate-200 px-4 py-2 text-sm font-semibold"
      >
        ↑ Top
      </a>
    </main>
  );
}
