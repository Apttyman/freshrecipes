// app/page.tsx
"use client";

import { useState, useEffect } from "react";

interface RecipeStep { text: string; image?: string; source?: string }
interface RecipeImage { url: string; alt: string; source: string }
interface Recipe {
  id: string;
  name: string;
  chef: string;
  description: string[];
  ingredients: string[];
  steps: RecipeStep[];
  sourceUrl: string;
  images: RecipeImage[];
}

export default function HomePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState("");
  const [savedUrl, setSavedUrl] = useState<string>(""); // NEW
  const [blobOk, setBlobOk] = useState<boolean | null>(null); // badge

  // Blob health badge
  useEffect(() => {
    (async () => {
      try {
        const rsp = await fetch("/api/blob-health", { cache: "no-store" });
        const j = await rsp.json();
        setBlobOk(!!j.ok);
      } catch {
        setBlobOk(false);
      }
    })();
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setSavedUrl(""); // clear previous
    try {
      const rsp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!rsp.ok) throw new Error(await rsp.text());
      const data = await rsp.json();
      const out: Recipe[] = Array.isArray(data.recipes) ? data.recipes : [];
      setRecipes(out);

      // ⬇️ Immediately save a snapshot HTML to Blob via server
      if (out.length > 0) {
        const saveRsp = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: instruction || out[0]?.name || "FreshRecipes",
            instruction,
            recipes: out, // server will render HTML snapshot
          }),
        });
        if (saveRsp.ok) {
          const s = await saveRsp.json();
          setSavedUrl(s.url);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate recipes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf8f5] text-gray-900 p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-serif">Fresh Recipes</h1>
          {/* Blob badge */}
          <span className="text-sm px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            Blob: {blobOk === null ? "…" : blobOk ? "✅" : "❌"}
          </span>
        </div>
        <a
          href="/archive"
          className="px-4 py-2 bg-[#c76d4e] text-white rounded hover:bg-[#a85539]"
        >
          Previous Recipes
        </a>
      </header>

      {/* Input */}
      <div className="mb-6 flex gap-2">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. 3 French desserts"
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-[#5c7c6d] text-white rounded hover:bg-[#476253]"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Save link (if any) */}
      {savedUrl && (
        <div className="mb-6">
          <a
            href={savedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white border shadow text-sm hover:shadow-md"
          >
            Open saved page ↗
          </a>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Recipes (inline render for preview) */}
      <section className="grid gap-8 md:grid-cols-2">
        {recipes.map((recipe) => (
          <article
            key={recipe.id}
            className="bg-white shadow rounded p-6 border"
          >
            <h2 className="text-2xl font-serif mb-2">
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                {recipe.name}
              </a>
            </h2>
            <p className="italic text-gray-600 mb-2">By {recipe.chef}</p>

            {recipe.images[0] && (
              <a href={recipe.images[0].source} target="_blank" rel="noopener noreferrer">
                <img
                  src={recipe.images[0].url}
                  alt={recipe.images[0].alt}
                  className="w-full h-64 object-cover rounded mb-4"
                />
              </a>
            )}

            {recipe.description.map((para, i) => (
              <p key={i} className="mb-2 text-sm leading-relaxed">
                {para}
              </p>
            ))}

            <h3 className="text-lg font-semibold mt-4 mb-2">Ingredients</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Steps</h3>
            <ol className="list-decimal list-inside text-sm space-y-2">
              {recipe.steps.map((step, i) => (
                <li key={i}>
                  <p>{step.text}</p>
                  {step.image && (
                    <a href={step.source || recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={step.image}
                        alt={`Step ${i + 1}`}
                        className="w-full h-48 object-cover rounded mt-2"
                      />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </main>
  );
}
