"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Recipe, Section } from "./lib/types";

// --- small helpers -----------------------------------------------------------
function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

async function postJSON<T>(url: string, data: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// --- page component ----------------------------------------------------------
export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [saving, setSaving] = useState<Record<string | number, boolean>>({});
  const [saved, setSaved] = useState<Record<string | number, boolean>>({});

  // Generate recipes from your existing API
  const onGenerate = useCallback(async () => {
    setRecipes([]);
    setSaved({});
    setSaving({});
    const q = prompt.trim() || "chicken recipe";

    try {
      setLog((l) => [
        `→ POST /api/generate (prompt="${q}")`,
        ...l.slice(0, 50),
      ]);
      const data = await postJSON<{ recipes: Recipe[] }>("/api/generate", {
        query: q,
      });

      const list = Array.isArray(data?.recipes) ? data.recipes : [];
      setRecipes(list);

      setLog((l) => [
        `✓ Received ${list.length} recipe(s)`,
        ...l.slice(0, 50),
      ]);
    } catch (e: any) {
      setLog((l) => [
        `✗ Error generating: ${e?.message ?? String(e)}`,
        ...l.slice(0, 50),
      ]);
    }
  }, [prompt]);

  // Save a single recipe (exactly one button per recipe card)
  const saveRecipe = useCallback(async (r: Recipe) => {
    const key = r.id ?? r.title;
    setSaving((m) => ({ ...m, [key]: true }));
    setSaved((m) => ({ ...m, [key]: false }));

    try {
      const result = await postJSON<{ ok: boolean; count: number }>(
        "/api/archive",
        { recipe: r }
      );
      if (!result.ok) throw new Error("Archive API returned not ok");

      setSaved((m) => ({ ...m, [key]: true }));
      setLog((l) => [
        `✓ Archived "${r.title}"`,
        ...l.slice(0, 50),
      ]);
    } catch (e: any) {
      setLog((l) => [
        `✗ Archive failed for "${r.title}": ${e?.message ?? String(e)}`,
        ...l.slice(0, 50),
      ]);
    } finally {
      setSaving((m) => ({ ...m, [key]: false }));
    }
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-4xl font-extrabold tracking-tight">FreshRecipes</h1>
      <p className="mt-2 text-slate-600">
        Type a natural-language request. We’ll fetch and format it.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-black px-5 py-3 text-white font-semibold"
          onClick={onGenerate}
        >
          Generate
        </button>

        <button
          className={cls(
            "rounded-xl border px-5 py-3 font-semibold",
            recipes.length === 0
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-slate-50"
          )}
          onClick={() => {
            if (!recipes.length) return;
            const all = recipes
              .map((r) => {
                const body = r.sections?.map((s) => s.html).join("\n\n") ?? "";
                return `# ${r.title}\n${r.author ? `by ${r.author}\n` : ""}\n${body}`;
              })
              .join("\n\n---\n\n");
            navigator.clipboard?.writeText(all);
            setLog((l) => [`✓ Copied ${recipes.length} recipe(s)`, ...l]);
          }}
          disabled={!recipes.length}
        >
          Copy all
        </button>

        <button
          className={cls(
            "rounded-xl border px-5 py-3 font-semibold",
            recipes.length === 0
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-slate-50"
          )}
          onClick={async () => {
            if (!recipes.length) return;
            try {
              const result = await postJSON<{ ok: boolean; count: number }>(
                "/api/archive",
                { recipes }
              );
              if (!result.ok) throw new Error("Archive API returned not ok");
              setLog((l) => [
                `✓ Archived ${result.count} recipe(s)`,
                ...l.slice(0, 50),
              ]);
            } catch (e: any) {
              setLog((l) => [
                `✗ Archive failed: ${e?.message ?? String(e)}`,
                ...l.slice(0, 50),
              ]);
            }
          }}
          disabled={!recipes.length}
        >
          Save all to archive
        </button>
      </div>

      <textarea
        className="mt-5 w-full rounded-2xl border p-4 text-lg"
        rows={4}
        placeholder="Chicken recipe"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">Preview</h2>

      {recipes.length === 0 ? (
        <p className="mt-2 text-slate-500">No recipes yet. Try typing a request above.</p>
      ) : null}

      <div className="mt-4 space-y-6">
        {recipes.map((r) => {
          const key = r.id ?? r.title;
          return (
            <article
              key={key}
              className="rounded-3xl border bg-white p-6 shadow-sm"
            >
              <header className="mb-4">
                <h3 className="font-serif text-4xl font-extrabold leading-tight">
                  {r.title}
                </h3>
                {r.author ? (
                  <p className="mt-1 text-slate-500">Chef {r.author}</p>
                ) : null}
              </header>

              {/* Render body sections */}
              <div className="prose max-w-none">
                {r.sections?.map((s, i) => (
                  <section key={i} className="mb-5">
                    {s.heading ? (
                      <h4 className="mt-2 text-xl font-bold">{s.heading}</h4>
                    ) : null}
                    <div
                      className="[&>img]:rounded-2xl"
                      dangerouslySetInnerHTML={{ __html: s.html }}
                    />
                  </section>
                ))}
              </div>

              {/* ONE save button per recipe */}
              <div className="mt-4 flex justify-end">
                <button
                  className={cls(
                    "rounded-2xl border px-5 py-3 font-semibold",
                    saved[key] && "border-green-600 text-green-700",
                    saving[key] && "opacity-60 cursor-wait"
                  )}
                  onClick={() => saveRecipe(r)}
                  disabled={!!saving[key]}
                >
                  {saving[key]
                    ? "Saving…"
                    : saved[key]
                    ? "Saved ✓"
                    : "Save highlight"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Request log */}
      <div className="mt-10 rounded-3xl border bg-white p-4 text-sm">
        <h3 className="mb-2 font-semibold">Request log</h3>
        <pre className="whitespace-pre-wrap break-words text-slate-700">
          {log.join("\n")}
        </pre>
      </div>
    </main>
  );
}
