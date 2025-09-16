// app/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Health = { ok: boolean; message?: string };

export default function HomePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [blobHealth, setBlobHealth] = useState<Health>({ ok: false });

  // ping blob health once on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/blob-health", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        setBlobHealth({ ok: !!j.ok, message: j.message || (j.ok ? "OK" : "Fail") });
      } catch {
        setBlobHealth({ ok: false, message: "health route failed" });
      }
    })();
  }, []);

  const disabledReason = !instruction.trim()
    ? "Type an instruction"
    : !blobHealth.ok
    ? "Blob token not live"
    : loading
    ? "Working…"
    : "";

  const canGenerate = !!instruction.trim() && blobHealth.ok && !loading;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError("");
    try {
      // this POST returns a full HTML file; open Preview in a new tab
      const rsp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(txt || `HTTP ${rsp.status}`);
      }
      const html = await rsp.text();
      // open the HTML in a new tab so users can see it immediately
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      setError(e?.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  }, [instruction, canGenerate]);

  return (
    <main className="min-h-screen bg-[#0f0f10] text-[#f5f3ef] px-5 py-8">
      {/* Header */}
      <header className="mx-auto max-w-3xl flex items-center justify-between mb-8">
        <h1 className="text-4xl font-serif">Fresh Recipes</h1>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              blobHealth.ok ? "bg-green-600/25 text-green-300" : "bg-red-600/25 text-red-300"
            }`}
            title={blobHealth.message}
          >
            Blob: {blobHealth.ok ? "✅ OK" : "❌ Off"}
          </span>
          <Link
            href="/archive"
            className="rounded-md bg-[#c76d4e] hover:bg-[#a85539] px-3 py-2 text-sm"
          >
            Previous Recipes
          </Link>
        </div>
      </header>

      {/* Instruction */}
      <section className="mx-auto max-w-3xl bg-[#171718] rounded-xl border border-white/10 p-4">
        <label className="block text-lg font-semibold mb-2">Your instruction</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={4}
          placeholder={`e.g., Fetch 5 of the top pasta recipes from famous chefs.\nInclude full descriptions, ingredients, numbered steps, and **real** images linked to sources.\nOutput Food52-style, responsive.`}
          className="w-full resize-y rounded-md bg-black/40 text-[#f5f3ef] placeholder-white/30 border border-white/10 p-3 focus:outline-none focus:ring-2 focus:ring-[#c76d4e]"
        />
        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-8">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`rounded-md px-4 py-2 text-sm font-medium transition
              ${canGenerate ? "bg-[#5c7c6d] hover:bg-[#476253] text-white" : "bg-white/10 text-white/40 cursor-not-allowed"}`}
          >
            {loading ? "Generating…" : "Generate"}
          </button>

          <div className="text-sm opacity-70">
            {disabledReason ? `Why disabled: ${disabledReason}` : "Ready — press Generate"}
          </div>
        </div>
      </section>

      {/* Errors */}
      {error && (
        <p className="mx-auto max-w-3xl mt-4 text-red-300">
          {error}
        </p>
      )}

      {/* Footer tip */}
      <p className="mx-auto max-w-3xl mt-10 text-sm opacity-60">
        Tip: Keep instructions specific. You can request layout rules, color palettes, sourcing
        requirements, and per-step photos.
      </p>
    </main>
  );
}
