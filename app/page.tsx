// app/page.tsx
"use client";

import { useState } from "react";
import { buttonClass } from "./layout";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!query.trim()) return;

    try {
      setLoading(true);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}). ${txt.slice(0, 180)}`);
      }

      // NOTE: your route may return JSON or HTML. We don’t render here;
      // keep this simple UI focused. If you want to show the result inline,
      // add your own rendering below.
      // const data = await res.json();
      // ...
    } catch (err: any) {
      setError(err?.message ?? "Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* One clean card – NO header/footer here */}
      <section className="mx-auto max-w-3xl">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 sm:p-6"
        >
          <label
            htmlFor="recipe-query"
            className="block text-[17px] font-semibold text-neutral-800 mb-3"
          >
            Describe what to fetch (e.g., ‘3 Michelin chef pasta recipes with step photos’)
          </label>

          <textarea
            id="recipe-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 3 Food52-style salad recipes with step photos"
            className="w-full min-h-[160px] rounded-xl border border-neutral-300 bg-white px-4 py-3
                       text-[16px] leading-6 outline-none focus:border-indigo-400
                       focus:ring-2 focus:ring-indigo-200 placeholder:text-neutral-400"
          />

          <div className="mt-4">
            <button
              type="submit"
              disabled={loading}
              className={`${buttonClass} w-full sm:w-auto`}
            >
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-700">
              <strong className="font-semibold">Error:</strong> {error}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
