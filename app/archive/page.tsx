// app/archive/page.tsx
"use client";

import { useEffect, useState } from "react";

type Item = {
  name: string;
  url: string;
  uploadedAt: string;
};

export default function ArchivePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/recipes", { cache: "no-store" });
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((it) =>
    decodeURIComponent(it.name).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 32, margin: 0 }}>
          Previous Recipes
        </h1>
        <p style={{ color: "#666", marginTop: 6 }}>
          Click any item to open the archived HTML page.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by filename…"
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
          }}
        />
        <a
          href="/"
          style={{
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            textDecoration: "none",
            color: "#111827",
            background: "#f9fafb",
            fontWeight: 600,
          }}
        >
          Home
        </a>
      </div>

      {loading ? (
        <div
          style={{
            border: "1px dashed #e5e7eb",
            borderRadius: 12,
            padding: 24,
            color: "#6b7280",
          }}
        >
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            border: "1px dashed #e5e7eb",
            borderRadius: 12,
            padding: 24,
            color: "#6b7280",
          }}
        >
          No saved recipes yet.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((it) => (
            <li
              key={it.url}
              style={{
                marginBottom: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                borderRadius: 12,
                padding: "12px 16px",
              }}
            >
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", fontWeight: 600 }}
              >
                {decodeURIComponent(it.name)}
              </a>
              <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                {new Date(it.uploadedAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
