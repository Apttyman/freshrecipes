// app/page.tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/** Data types expected from /api/generate */
type Section = { heading?: string | null; html?: string | null };
type Recipe = {
  id: number | string;
  title: string;
  author?: string | null;
  sections?: Section[];
  html?: string | null;       // optional single-body html
  imageUrl?: string | null;   // optional hero image
};

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const listTopRef = useRef<HTMLDivElement>(null);

  const log = useCallback((line: string) => {
    setLogLines((prev) => [...prev, line]);
  }, []);

  const canCopyAll = recipes.length > 0;
  const canSaveAll = recipes.length > 0;

  const copyAllText = useMemo(() => {
    if (recipes.length === 0) return "";
    const blocks = recipes.map((r) => {
      const parts: string[] = [];
      parts.push(`# ${r.title}`);
      if (r.author) parts.push(`by ${r.author}`);
      if (r.sections?.length) {
        for (const s of r.sections) {
          if (s.heading) parts.push(`\n## ${s.heading}`);
          if (s.html) {
            // strip tags for copy so it’s clean plaintext
            const text = s.html.replace(/<[^>]+>/g, "");
            parts.push(text.trim());
          }
        }
      } else if (r.html) {
        parts.push(r.html.replace(/<[^>]+>/g, "").trim());
      }
      return parts.join("\n");
    });
    return blocks.join("\n\n---\n\n");
  }, [recipes]);

  const onGenerate = useCallback(async () => {
    const q = prompt.trim();
    if (!q) return;
    setBusy(true);
    setRecipes([]);
    setLogLines([]);
    log(`→ POST /api/generate`);

    try {
      // IMPORTANT: send JSON with proper header
      const res = await fetch(`/api/generate?_=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        log(`✖ Error: HTTP ${res.status}`);
        setRecipes([]);
        return;
      }

      const list = Array.isArray(data?.recipes) ? (data.recipes as Recipe[]) : [];
      if (list.length === 0) {
        log(`ℹ No recipes returned.`);
      }
      setRecipes(list);

      // scroll preview into view a bit
      setTimeout(() => listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      log(`✖ Error: ${e?.message ?? "Load failed"}`);
      setRecipes([]);
    } finally {
      setBusy(false);
    }
  }, [prompt, log]);

  const onCopyAll = useCallback(async () => {
    if (!canCopyAll) return;
    try {
      await navigator.clipboard.writeText(copyAllText);
      log("✓ Copied all to clipboard");
    } catch {
      log("✖ Copy failed");
    }
  }, [canCopyAll, copyAllText, log]);

  // Archive = save full results list
  const onSaveAll = useCallback(() => {
    if (!canSaveAll) return;
    try {
      const key = "freshrecipes.archive";
      const prev: Recipe[] = JSON.parse(localStorage.getItem(key) || "[]");
      const next = [...prev, ...recipes];
      localStorage.setItem(key, JSON.stringify(next));
      log(`✓ Saved ${recipes.length} recipe(s) to archive`);
    } catch {
      log("✖ Save failed");
    }
  }, [canSaveAll, recipes, log]);

  // Highlight = save exactly one per recipe card (dedup by id)
  const onSaveHighlight = useCallback((r: Recipe) => {
    try {
      const key = "freshrecipes.highlights";
      const prev: Recipe[] = JSON.parse(localStorage.getItem(key) || "[]");
      const exists = prev.some((p) => String(p.id) === String(r.id));
      const next = exists ? prev : [...prev, r];
      localStorage.setItem(key, JSON.stringify(next));
      log(`✓ Saved highlight for “${r.title}”`);
    } catch {
      log("✖ Save highlight failed");
    }
  }, [log]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Title */}
      <h1 className="text-4xl font-black tracking-tight">FreshRecipes</h1>
      <p className="mt-3 text-neutral-600">
        Ask for what you want (e.g., &ldquo;3 top chef pasta recipes&rdquo;). We’ll format the result beautifully.
      </p>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onGenerate}
          disabled={busy}
          className={
            "rounded-xl px-5 py-3 text-base font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black " +
            (busy ? "bg-neutral-500" : "bg-black hover:bg-neutral-800")
          }
        >
          {busy ? "Generating…" : "Generate"}
        </button>

        <button
          onClick={onCopyAll}
          disabled={!canCopyAll}
          className={
            "rounded-xl px-5 py-3 text-base font-semibold " +
            (canCopyAll
              ? "bg-white text-black ring-1 ring-neutral-300 hover:bg-neutral-50"
              : "bg-neutral-200 text-neutral-500")
          }
        >
          Copy all
        </button>

        <button
          onClick={onSaveAll}
          disabled={!canSaveAll}
          className={
            "rounded-xl px-5 py-3 text-base font-semibold " +
            (canSaveAll
              ? "bg-white text-black ring-1 ring-neutral-300 hover:bg-neutral-50"
              : "bg-neutral-200 text-neutral-500")
          }
        >
          Save all to archive
        </button>
      </div>

      {/* Prompt box */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., 3 top chef pasta recipes using seasonal ingredients"
        className="mt-5 w-full rounded-2xl border border-neutral-300 p-4 text-lg outline-none focus:ring-2 focus:ring-black"
        rows={5}
      />

      {/* Preview */}
      <h2 className="mt-10 mb-4 text-3xl font-extrabold tracking-tight">Preview</h2>

      <div ref={listTopRef} />

      {recipes.length === 0 && (
        <p className="text-neutral-500">No recipes yet. Try typing a request above.</p>
      )}

      <div className="space-y-6">
        {recipes.map((r) => (
          <article
            key={r.id}
            className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <header>
              <h3 className="font-black tracking-tight text-4xl md:text-5xl leading-tight">
                {r.title}
              </h3>
              {r.author && (
                <p className="mt-2 text-lg text-neutral-600">{r.author}</p>
              )}
            </header>

            {/* Optional image */}
            {r.imageUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="block h-auto w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Body */}
            <div className="mt-5 space-y-6">
              {r.sections && r.sections.length > 0 ? (
                r.sections.map((s, i) => (
                  <section key={i}>
                    {s.heading && (
                      <h4 className="text-2xl font-extrabold mt-2 mb-3">{s.heading}</h4>
                    )}
                    {s.html && (
                      <div
                        className="prose prose-neutral max-w-none"
                        // Intentionally allow HTML returned by your generator
                        dangerouslySetInnerHTML={{ __html: s.html }}
                      />
                    )}
                  </section>
                ))
              ) : r.html ? (
                <div
                  className="prose prose-neutral max-w-none"
                  dangerouslySetInnerHTML={{ __html: r.html }}
                />
              ) : (
                <p className="text-neutral-500 italic">
                  No recipe body returned from server.
                </p>
              )}
            </div>

            {/* Per-recipe toolbar (ONE highlight button per recipe) */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => onSaveHighlight(r)}
                className="rounded-2xl bg-white px-5 py-3 text-base font-semibold ring-1 ring-neutral-300 hover:bg-neutral-50"
              >
                Save highlight
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Request log */}
      <h3 className="mt-10 mb-2 text-2xl font-bold">Request log</h3>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 font-mono text-sm">
        {logLines.length === 0 ? (
          <p className="text-neutral-500">—</p>
        ) : (
          <ul className="space-y-1">
            {logLines.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
