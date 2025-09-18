"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";
// ✅ Must be a number or false, not a function
export const revalidate = 0;

type GenResult = {
  html?: string;
  slug?: string;
  error?: string;
};

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<GenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data: GenResult = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result?.html || !result?.slug) return;
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: result.slug,
          html: result.html,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save archive");
      }
      alert("Recipe archived successfully!");
    } catch (err: any) {
      alert(`Error saving: ${err.message}`);
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        FreshRecipes Generator
      </h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the recipes you want..."
        style={{
          width: "100%",
          height: "100px",
          marginBottom: "1rem",
          padding: "0.5rem",
        }}
      />
      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt}
          style={{ marginRight: "1rem" }}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        {result?.html && (
          <button onClick={handleSave} style={{ marginRight: "1rem" }}>
            Save to Archive
          </button>
        )}
        <a href="/archive" style={{ textDecoration: "underline" }}>
          Open Archive
        </a>
      </div>
      {error && (
        <p style={{ color: "red", marginBottom: "1rem" }}>Error: {error}</p>
      )}
      {result?.html && (
        <iframe
          srcDoc={result.html}
          style={{
            width: "100%",
            minHeight: "600px",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        />
      )}
    </main>
  );
}
