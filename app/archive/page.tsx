"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { key: string; url: string; size: number; uploadedAt?: number };

export default function ArchivePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const rsp = await fetch("/api/recipes", { cache: "no-store" });
        if (!rsp.ok) throw new Error(await rsp.text());
        const data = await rsp.json();
        setItems(data.recipes || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load archive");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const page = {
    minHeight: "100vh",
    background: "#0e1116",
    color: "#e6e6e6",
    padding: "24px",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
  } as React.CSSProperties;

  const container = { maxWidth: 880, margin: "0 auto" };
  const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  };
  const brand = {
    fontFamily: 'ui-serif, "Iowan Old Style", "Times New Roman", Times, serif',
    fontSize: 28,
    margin: 0,
  };
  const pill = {
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
  };
  const list: React.CSSProperties = {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: 14,
  };
  const item = {
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 8px 18px rgba(0,0,0,.32)",
    background: "#0b0f15",
    border: "1px solid #222a36",
  };
  const meta = { opacity: 0.75, fontSize: 13, marginTop: 6 };

  return (
    <main style={page}>
      <div style={container}>
        <header style={header}>
          <h1 style={brand}>Previous Recipes</h1>
          <Link href="/" style={pill}>
            ← Back to Generator
          </Link>
        </header>

        {loading && <p>Loading…</p>}
        {!loading && err && <p style={{ color: "#ffb3c1" }}>{err}</p>}
        {!loading && !err && items.length === 0 && <p>No recipes saved yet.</p>}

        <ul style={list}>
          {items.map((it) => (
            <li key={it.key} style={item as React.CSSProperties}>
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 18, fontWeight: 650, color: "#eae7e1" }}
              >
                {it.key.replace(/^recipes\//, "")}
              </a>
              <div style={meta}>
                {(it.size / 1024).toFixed(1)} KB ·{" "}
                {it.uploadedAt
                  ? new Date(it.uploadedAt).toLocaleString()
                  : ""}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
