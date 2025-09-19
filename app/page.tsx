// app/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass, disabledButtonClass, secondaryButtonClass } from "./layout";

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
        throw new Error(
          txt || `Model did not return a complete HTML document. Check your model/keys.`
        );
      }

      // If your API returns something to show, handle it here
      // (this file is just restoring the UI state you asked for).
    } catch (err: any) {
      const msg =
        typeof err?.message === "string" && err.message.trim()
          ? err.message.trim()
          : "Model did not return a complete HTML document. Check your model/keys.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 sm:p-6"
      >
        <div className="mb-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="2 Michelin star pasta recipes"
            className="w-full min-h-[180px] rounded-xl border border-neutral-300 bg-white px-4 py-3
                       text-[18px] leading-7 outline-none focus:border-indigo-400
                       focus:ring-2 focus:ring-indigo-200 placeholder:text-neutral-400"
          />
        </div>

        <div className="flex flex-col gap-3">
          <button type="submit" disabled={loading} className={`${buttonClass} w-full`}>
            {loading ? "Generating…" : "Generate"}
          </button>

          {/* Disabled Save button (as in your screenshot) */}
          <button type="button" disabled className={`${disabledButtonClass} w-full`}>
            Save
          </button>

          {/* “Open Archive” button (present in the screenshot) */}
          <Link href="/archive" className={`${secondaryButtonClass} w-full`}>
            Open Archive
          </Link>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-4 text-rose-700">
          <strong className="font-semibold">Error:</strong>{" "}
          {error || "Model did not return a complete HTML document. Check your model/keys."}
        </div>
      )}
    </section>
  );
}
