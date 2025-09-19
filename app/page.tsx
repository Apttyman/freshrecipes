"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  weight: ["700", "800", "900"],
});

type Section = {
  heading?: string | null;
  html?: string | null; // server gives HTML strings
};

type Recipe = {
  id: number | string;
  title: string;
  author?: string | null;
  // either a single HTML blob or structured sections
  sections?: Section[];
  html?: string | null;
  imageUrl?: string | null; // optional; never required to render
};

type ApiOk = { recipes: Recipe[] };

type LogLine = {
  kind: "req" | "res" | "err";
  text: string;
};

function coerceMarkdownImages(s: string) {
  // Minimal & safe: turn ![alt](url) into <img ...>.
  // (This never removes other content and won’t throw if there’s no match.)
  return s.replace(
    /!\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (_full, alt, url) =>
      `<img src="${url}" alt="${String(alt).replace(/"/g, "&quot;")}" />`
  );
}

function normalizeHtml(input?: string | null) {
  if (!input) return "";
  // Preserve server HTML; also tolerate stray \n and simple markdown images.
  let s = input;
  if (s.includes("\n") && !/<[a-z][\s\S]*>/i.test(s)) {
    // Looks like plain text — make newlines visible.
    s = s.replace(/\n/g, "<br/>");
  }
  return coerceMarkdownImages(s);
}

const ARCHIVE_KEY = "freshrecipes-archive";

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [savedIds, setSavedIds] = useState<Record<string | number, boolean>>({});

  // ----- logging helpers -----------------------------------------------------
  const pushLog = useCallback((line: LogLine) => {
    setLog((prev) => [line, ...prev].slice(0, 50));
  }, []);

  // ----- archive helpers -----------------------------------------------------
  const saveToArchive = useCallback((items: Recipe[]) => {
    try {
      const existing: Recipe[] = JSON.parse(
        localStorage.getItem(ARCHIVE_KEY) || "[]"
      );
      const merged = [...items, ...existing];
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(merged));
      items.forEach((r) =>
        setSavedIds((m) => ({ ...m, [r.id]: true }))
      );
    } catch (e) {
      pushLog({ kind: "err", text: `Archive error: ${(e as Error).message}` });
    }
  }, [pushLog]);

  // ----- actions -------------------------------------------------------------
  const onGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setRecipes([]);
    pushLog({ kind: "req", text: `POST /api/generate — body: ${JSON.stringify({ prompt })}` });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }), // ✅ what the API expects
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        pushLog({
          kind: "err",
          text: `HTTP ${res.status} from /api/generate ${text ? `— ${text.slice(0, 160)}` : ""}`,
        });
        setBusy(false);
        return;
      }

      const data = (await res.json()) as ApiOk;
      pushLog({
        kind: "res",
        text: `OK — received ${Array.isArray(data?.recipes) ? data.recipes.length : 0} recipe(s)`,
      });

      setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
    } catch (e) {
      pushLog({ kind: "err", text: `Load failed — ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }, [prompt, pushLog]);

  const onCopyAll = useCallback(async () => {
    try {
      const text = recipes
        .map((r) => {
          const sections = r.sections?.map((s) => {
            const plain =
              s?.html
                ?.replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim() ?? "";
            return `${s?.heading ?? ""}\n${plain}`.trim();
          }).join("\n\n") ||
          (r.html
            ?.replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim() ?? "");
          return `# ${r.title}\n${r.author ? `by ${r.author}\n` : ""}${sections}`;
        })
        .join("\n\n---\n\n");

      await navigator.clipboard.writeText(text);
      pushLog({ kind: "res", text: "Copied all recipes to clipboard." });
    } catch (e) {
      pushLog({ kind: "err", text: `Copy failed — ${(e as Error).message}` });
    }
  }, [recipes, pushLog]);

  const onSaveOne = useCallback((r: Recipe) => {
    saveToArchive([r]);
    pushLog({ kind: "res", text: `Saved “${r.title}” to archive.` });
  }, [saveToArchive, pushLog]);

  const onSaveAll = useCallback(() => {
    if (!recipes.length) return;
    saveToArchive(recipes);
    pushLog({ kind: "res", text: `Saved ${recipes.length} recipe(s) to archive.` });
  }, [recipes, saveToArchive, pushLog]);

  // ----- UI pieces -----------------------------------------------------------
  const actionsDisabled = busy || !prompt.trim();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight mb-3">FreshRecipes</h1>
      <p className="text-lg text-zinc-600 mb-6">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="flex gap-3 mb-4">
        <button
          disabled={actionsDisabled}
          onClick={onGenerate}
          className={`px-5 py-3 rounded-xl font-semibold text-white ${actionsDisabled ? "bg-zinc-400" : "bg-black hover:bg-zinc-800"}`}
        >
          {busy ? "Generating…" : "Generate"}
        </button>

        <button
          disabled={!recipes.length}
          onClick={onCopyAll}
          className={`px-5 py-3 rounded-xl font-semibold border ${!recipes.length ? "opacity-50" : "hover:bg-zinc-50"}`}
        >
          Copy all
        </button>

        <button
          disabled={!recipes.length}
          onClick={onSaveAll}
          className={`px-5 py-3 rounded-xl font-semibold border ${!recipes.length ? "opacity-50" : "hover:bg-zinc-50"}`}
        >
          Save all to archive
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., Empanada recipe with chicken and olives"
        className="w-full h-40 rounded-2xl border p-4 mb-8"
      />

      <h2 className="text-2xl font-extrabold mb-3">Preview</h2>

      {!recipes.length ? (
        <p className="text-zinc-500 mb-6">No recipes yet. Try typing a request above.</p>
      ) : null}

      <div className="space-y-6">
        {recipes.map((r) => {
          const hasSections = Array.isArray(r.sections) && r.sections.length > 0;
          return (
            <article
              key={r.id}
              className="rounded-2xl border p-6 shadow-sm bg-white"
            >
              <header className="mb-4">
                <h3 className={`${playfair.className} text-4xl leading-tight font-black`}>
                  {r.title}
                </h3>
                {r.author ? (
                  <p className="text-zinc-500 mt-2">{r.author}</p>
                ) : null}
              </header>

              {/* Body */}
              <div className="space-y-4">
                {hasSections
                  ? r.sections!.map((s, idx) => (
                      <section key={idx}>
                        {s?.heading ? (
                          <h4 className="text-2xl font-extrabold mb-2">
                            {s.heading}
                          </h4>
                        ) : null}
                        <div
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: normalizeHtml(s?.html) || "<em>(No content)</em>",
                          }}
                        />
                      </section>
                    ))
                  : (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html:
                          normalizeHtml(r.html) ||
                          "<em>(No recipe body returned from server.)</em>",
                      }}
                    />
                  )}

                {/* Single save button per recipe */}
                <div className="pt-2">
                  <button
                    onClick={() => onSaveOne(r)}
                    className={`px-5 py-3 rounded-xl font-semibold border hover:bg-zinc-50 ${savedIds[r.id] ? "opacity-60" : ""}`}
                    disabled={!!savedIds[r.id]}
                    aria-disabled={!!savedIds[r.id]}
                  >
                    {savedIds[r.id] ? "Saved" : "Save highlight"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Request log */}
      <section className="mt-10">
        <h3 className="text-xl font-bold mb-3">Request log</h3>
        <div className="rounded-2xl border p-4 bg-white max-h-80 overflow-auto text-sm font-mono whitespace-pre-wrap">
          {log.length === 0 ? (
            <span className="text-zinc-500">No entries yet.</span>
          ) : (
            log.map((l, i) => {
              const bullet = l.kind === "req" ? "→" : l.kind === "res" ? "✓" : "✖";
              return (
                <div key={i} className="mb-2">
                  {bullet} {l.text}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
