// app/archive/page.tsx
"use client";

import { useEffect, useState } from "react";

type Row = {
  key: string;
  url: string;
  uploadedAt: number;
  description: string;
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
    <div className="min-h-dvh bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-slate-900">Archive</h1>
          <a
            href="/"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {err && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {err}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-1/3 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  File
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  Description (original query)
                </th>
                <th className="w-40 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="truncate px-4 py-3 align-top">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {r.key.split("/").pop()}
                    </a>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {r.description || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-slate-600">
                    {new Date(r.uploadedAt).toLocaleString()}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No recipes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
