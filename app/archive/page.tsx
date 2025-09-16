// app/archive/page.tsx
"use client";

import { useEffect, useState } from "react";

type Row = {
  slug: string;
  title: string;
  query: string | null;
  createdAt: number;
  urlHtml: string | null;
  urlJson: string | null;
};

export default function ArchivePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/recipes", { cache: "no-store" });
        const data = await res.json();
        setRows(Array.isArray(data?.recipes) ? data.recipes : []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load archive");
      }
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_800px_at_110%_-10%,rgba(46,91,255,.08),transparent_60%),radial-gradient(900px_700px_at_-10%_0%,rgba(20,184,166,.06),transparent_60%),linear-gradient(#fafbfc,#f7f8fb)]">
      {/* Header (match home) */}
      <header className="relative z-10 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-teal-400 shadow-sm" />
            <span className="text-sm font-semibold tracking-wide text-slate-800">
              FreshRecipes
            </span>
          </div>
          <a
            href="/"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Archive</h1>

        {err && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {err}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-1/3 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  File
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  Description (original query)
                </th>
                <th className="w-44 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((r) => {
                const file = `${r.slug}.html`;
                const desc =
                  (r.query && r.query.trim()) ||
                  (r.title && r.title.trim()) ||
                  "—";
                return (
                  <tr key={r.slug} className="hover:bg-slate-50">
                    <td className="truncate px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/recipes/${encodeURIComponent(r.slug)}`}
                          className="text-blue-600 hover:underline"
                          title={`Open ${file} in app`}
                        >
                          {file}
                        </a>
                        {r.urlHtml && (
                          <a
                            href={r.urlHtml}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                            title="Open raw blob"
                          >
                            Blob
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div
                        className="max-w-[60ch] overflow-hidden text-ellipsis whitespace-nowrap text-slate-800"
                        title={desc}
                      >
                        {desc}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-600">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No recipes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-center md:flex-row md:text-left">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} FreshRecipes. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 text-sm">
            <a
              className="text-slate-500 hover:text-slate-700"
              href="/api/health"
              aria-label="Health check"
            >
              Health
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
