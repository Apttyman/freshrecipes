// app/archive/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type Item = { key: string; url: string; size: number; uploadedAt?: number };

function niceSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function timeAgo(ts?: number) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function ArchivePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const rsp = await fetch("/api/recipes", { cache: "no-store" });
        const data = await rsp.json();
        setItems(Array.isArray(data.recipes) ? data.recipes : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(it => it.key.toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <main style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.titleBlock}>
          <h1 style={styles.h1}>Previous Recipes</h1>
          <p style={styles.sub}>Every generated HTML page saved via Blob.</p>
        </div>
        <Link href="/" style={styles.primaryLink}>← Back to Generator</Link>
      </header>

      <section style={styles.toolbar}>
        <input
          placeholder="Filter by name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Filter recipes"
          style={styles.search}
        />
        <span style={styles.countBadge}>
          {loading ? "Loading…" : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
        </span>
      </section>

      {(!loading && filtered.length === 0) && (
        <div style={styles.empty}>
          <p>No matching recipes yet.</p>
          <p style={{opacity:.7}}>Generate one on the home page, it will appear here automatically.</p>
        </div>
      )}

      <ul style={styles.grid}>
        {filtered.map((it) => {
          const name = it.key.replace(/^recipes\//, "");
          return (
            <li key={it.key} style={styles.card} className="card">
              <div style={styles.cardHead}>
                <a href={it.url} target="_blank" rel="noopener noreferrer" style={styles.cardTitle}>
                  {name}
                </a>
              </div>
              <div style={styles.meta}>
                <span>{niceSize(it.size)}</span>
                <span>•</span>
                <span>{timeAgo(it.uploadedAt)}</span>
              </div>
              <div style={styles.actions}>
                <a href={it.url} target="_blank" rel="noopener noreferrer" style={styles.actionBtn}>Open</a>
                <button
                  onClick={() => navigator.clipboard.writeText(it.url)}
                  style={styles.actionBtn}
                  aria-label="Copy link"
                >
                  Copy link
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* lightweight dark-mode support */}
      <style>{`
        :root { color-scheme: light dark; }
        @media (prefers-color-scheme: dark) {
          body { background: #0a0a0a; color: #eaeaea; }
        }
        .card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,.12); }
      `}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "28px 20px 56px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "baseline",
    marginBottom: 18,
  },
  titleBlock: { display: "grid", gap: 4 },
  h1: {
    margin: 0,
    fontSize: 32,
    letterSpacing: -.2,
    fontWeight: 700,
  },
  sub: { margin: 0, opacity: .7 },
  primaryLink: {
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.12)",
    background: "rgba(0,0,0,.04)",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "10px 0 20px",
  },
  search: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.14)",
    outline: "none",
    fontSize: 14,
    background: "transparent",
  },
  countBadge: { opacity: .7, fontSize: 13 },
  grid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    background: "rgba(255,255,255,.9)",
    boxShadow: "0 4px 18px rgba(0,0,0,.08)",
    transition: "transform .15s ease, box-shadow .15s ease",
    display: "grid",
    gap: 10,
  },
  cardHead: { display: "flex", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: 700, textDecoration: "none" },
  meta: { display: "flex", gap: 6, opacity: .7, fontSize: 13 },
  actions: { display: "flex", gap: 8, marginTop: 6 },
  actionBtn: {
    border: "1px solid rgba(0,0,0,.14)",
    padding: "8px 10px",
    borderRadius: 8,
    background: "transparent",
    fontSize: 13,
    textDecoration: "none",
  },
  empty: {
    border: "1px dashed rgba(0,0,0,.18)",
    padding: 24,
    borderRadius: 12,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 10,
  },
};
