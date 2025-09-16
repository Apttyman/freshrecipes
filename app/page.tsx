"use client";

import { useState } from "react";

interface Recipe {
  id: string;
  name: string;
  chef: string;
  description: string[];
  ingredients: string[];
  steps: { text: string; image?: string; source?: string }[];
  sourceUrl: string;
  images: { url: string; alt: string; source: string }[];
}

export default function HomePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const rsp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(txt);
      }
      const data = await rsp.json();
      setRecipes(data.recipes || []);
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
        <h1 className="text-4xl font-serif">Fresh Recipes</h1>
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

      {/* Error */}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Recipes */}
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
                    <a href={step.source} target="_blank" rel="noopener noreferrer">
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
