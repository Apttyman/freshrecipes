"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Step = { text: string; image?: string; source?: string };
type ImageRef = { url: string; alt: string; source: string };
type Recipe = {
  id: string;
  name: string;
  chef: string;
  description: string[];
  ingredients: string[];
  steps: Step[];
  sourceUrl: string;
  images: ImageRef[];
};

export default function HomePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string>("");
  const [blobOK, setBlobOK] = useState<null | boolean>(null);

  // Blob health badge
  useEffect(() => {
    (async () => {
      try {
        const rsp = await fetch("/api/blob-health", { cache: "no-store" });
        if (!rsp.ok) throw new Error("health route failed");
        const data = await rsp.json();
        setBlobOK(Boolean(data.ok));
      } catch {
        setBlobOK(false);
      }
    })();
  }, []);

  async function handleGenerate() {
    setError("");
    setLoading(true);
    setRecipes([]);
    try {
      const rsp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(txt || `HTTP ${rsp.status}`);
      }
      const data = await rsp.json();
      setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
    } catch (e: any) {
      setError(e?.message || "Failed to generate recipes");
    } finally {
      setLoading(false);
    }
  }

  // Basic, framework-agnostic styles (no Tailwind dependency)
  const s = {
    page: {
      minHeight: "100vh",
      background: "#0e1116",
      color: "#e6e6e6",
      padding: "24px",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
    },
    container: { maxWidth: 980, margin: "0 auto" },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    brand: {
      fontFamily:
        'ui-serif, "Iowan Old Style", "Times New Roman", Times, serif',
      fontSize: 32,
      letterSpacing: ".5px",
      margin: 0,
    },
    nav: { display: "flex", gap: 12, alignItems: "center" },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      padding: "6px 10px",
      borderRadius: 999,
      background: "#1b2330",
      border: "1px solid #2a3342",
      textDecoration: "none",
      color: "#dcdcdc",
    },
    inputRow: { display: "flex", gap: 12, marginBottom: 16 },
    input: {
      flex: 1,
      padding: "12px 14px",
      borderRadius: 10,
      border: "1px solid #2a3342",
      background: "#0b0f15",
      color: "#e6e6e6",
      outline: "none",
      fontSize: 16,
    },
    button: {
      padding: "12px 18px",
      borderRadius: 10,
      border: "1px solid #40614d",
      background:
        "linear-gradient(180deg, #4d7c66 0%, #3a5e4f 100%)",
      color: "white",
      fontWeight: 600,
      cursor: "pointer",
    },
    error: {
      background: "#2b1620",
      border: "1px solid #6e2a44",
      color: "#ffd7e1",
      padding: "10px 12px",
      borderRadius: 10,
      marginBottom: 16,
      fontSize: 14,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 20,
    } as React.CSSProperties,
    card: {
      background: "#0b0f15",
      border: "1px solid #222a36",
      borderRadius: 16,
      boxShadow: "0 8px 22px rgba(0,0,0,.35)",
      padding: 20,
    },
    title: {
      fontFamily:
        'ui-serif, "Iowan Old Style", "Times New Roman", Times, serif',
      fontSize: 24,
      margin: "0 0 8px",
      color: "#f2efe9",
    },
    subtitle: { margin: "0 0 16px", opacity: 0.8, fontStyle: "italic" },
    hero: {
      width: "100%",
      height: 260,
      objectFit: "cover",
      borderRadius: 12,
      display: "block",
      marginBottom: 14,
      background: "#10151d",
    },
    h3: { marginTop: 18, marginBottom: 10, fontSize: 16, color: "#eae7e1" },
    list: { margin: 0, paddingLeft: 18, lineHeight: 1.6 },
    stepImg: {
      width: "100%",
      height: 180,
      objectFit: "cover",
      borderRadius: 10,
      marginTop: 8,
      background: "#0f141d",
    },
    footer: {
      marginTop: 28,
      fontSize: 13,
      opacity: 0.7,
      borderTop: "1px solid #222a36",
      paddingTop: 12,
    },
  };

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.brand}>FreshRecipes</h1>
          <nav style={s.nav}>
            <Link href="/archive" style={s.pill}>
              📚 Previous Recipes
            </Link>
            <span style={s.pill}>
              Blob:{" "}
              {blobOK === null ? "…" : blobOK ? "✅ healthy" : "❌ error"}
            </span>
          </nav>
        </header>

        <div style={s.inputRow}>
          <input
            style={s.input}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='Try: “Fetch 5 pasta recipes from famous chefs”'
            aria-label="Recipe instruction"
          />
          <button
            style={s.button}
            onClick={handleGenerate}
            disabled={loading || !instruction.trim()}
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>

        {error ? <div style={s.error}>{error}</div> : null}

        <section style={s.grid}>
          {recipes.map((r) => (
            <article key={r.id} style={s.card}>
              <h2 style={s.title}>
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {r.name}
                </a>
              </h2>
              <p style={s.subtitle}>By {r.chef}</p>

              {r.images?.[0] && (
                <a
                  href={r.images[0].source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={r.images[0].url}
                    alt={r.images[0].alt || `${r.name} hero image`}
                    style={s.hero}
                  />
                </a>
              )}

              {r.description?.map((para, i) => (
                <p key={i} style={{ lineHeight: 1.7, margin: "10px 0" }}>
                  {para}
                </p>
              ))}

              <h3 style={s.h3}>Ingredients</h3>
              <ul style={s.list}>
                {r.ingredients?.map((ing, i) => (
                  <li key={i}>{ing}</li>
                ))}
              </ul>

              <h3 style={s.h3}>Preparation</h3>
              <ol style={s.list}>
                {r.steps?.map((st, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    <p>{st.text}</p>
                    {st.image && (
                      <a
                        href={st.source || r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={st.image}
                          alt={`Step ${i + 1}`}
                          style={s.stepImg}
                        />
                      </a>
                    )}
                  </li>
                ))}
              </ol>

              <div style={s.footer}>
                Source:{" "}
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#bcd9c9" }}
                >
                  {r.sourceUrl}
                </a>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
