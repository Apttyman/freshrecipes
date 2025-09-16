// app/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
function BlobBadge() {
  const [ok, setOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    fetch("/api/blob-health", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setOk(Boolean(d.ok)))
      .catch(() => setOk(false));
  }, []);

  const bg = ok == null ? "bg-gray-400" : ok ? "bg-green-500" : "bg-red-500";
  const label = ok == null ? "Blob…" : ok ? "Blob OK" : "Blob FAIL";

  return (
    <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-white/70 border">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${bg}`} />
      {label}
    </span>
  );
}
type GenResponse = {
  ok: boolean;
  previewHtml?: string;   // full HTML for live preview
  blobUrl?: string;       // public Vercel Blob URL of saved file
  pageUrl?: string;       // same as blobUrl (alias), or a routed URL if you add one
  filename?: string;      // e.g. recipes/2025-03-10_12-01-22_cacio-e-pepe.html
  error?: string;
};

export default function HomePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // preview state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPreviewHtml(null);
    setPageUrl(null);
    setFilename(null);

    try {
      const rsp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });

      // If your route streams errors, capture body text for clarity
      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(txt || `Request failed with ${rsp.status}`);
      }

      const data = (await rsp.json()) as GenResponse;

      if (!data.ok) {
        throw new Error(data.error || "Generation failed.");
      }

      setPreviewHtml(data.previewHtml || null);
      setPageUrl(data.pageUrl || data.blobUrl || null);
      setFilename(data.filename || null);
    } catch (e: any) {
      setError(e?.message || "Failed to generate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf8f5] text-gray-900 p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-serif tracking-tight">Fresh Recipes</h1>
        <Link
          href="/archive"
          className="px-4 py-2 rounded bg-[#c76d4e] text-white hover:bg-[#a85539] transition"
        >
          Previous Recipes
        </Link>
      </header>

      {/* Instruction input + CTA */}
      <section className="mb-6 grid gap-3">
        <label className="text-sm font-medium text-gray-700">Your instruction</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Fetch 5 rice recipes from top Canadian chefs"'
          className="w-full min-h-[100px] border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5c7c6d] bg-white"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !instruction.trim()}
            className="px-4 py-2 rounded bg-[#5c7c6d] text-white hover:bg-[#476253] disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate"}
          </button>

          {pageUrl && (
            <>
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                title="Open the saved page"
              >
                Open page
              </a>
              <a
                href={pageUrl}
                download={filename ?? "recipe.html"}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                title="Download the HTML"
              >
                Download .html
              </a>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Tip: Keep instructions specific. You can request layout rules, color palettes, and sourcing requirements.
        </p>
      </section>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Live Preview */}
      {previewHtml ? (
        <section className="rounded-xl border border-gray-200 shadow bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold">Live Preview</h2>
            {filename && <span className="text-xs text-gray-500">{filename}</span>}
          </div>
          <div className="h-[70vh]">
            {/* Use an iframe with srcDoc so the HTML is fully isolated and styled as-is */}
            <iframe
              title="Recipe Preview"
              className="w-full h-full"
              srcDoc={previewHtml}
              sandbox="allow-same-origin allow-popups allow-forms allow-scripts"
            />
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          Your generated page will preview here.
        </section>
      )}
    </main>
  );
}
