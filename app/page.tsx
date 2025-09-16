// app/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type GenResponse = {
  ok: boolean;
  previewHtml?: string;
  blobUrl?: string;
  pageUrl?: string;
  filename?: string;
  error?: string;
};

export default function HomePage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (!rsp.ok) {
        const txt = await rsp.text();
        throw new Error(txt || `Request failed with ${rsp.status}`);
      }

      const data = (await rsp.json()) as GenResponse;
      if (!data.ok) throw new Error(data.error || "Generation failed.");

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
        <div className="flex items-center gap-3">
          <Link
            href="/previous" // <-- matches your repo (app/previous/page.tsx)
            className="px-4 py-2 rounded bg-[#c76d4e] text-white hover:bg-[#a85539] transition"
          >
            Previous Recipes
          </Link>
          {/* If you added the BlobBadge component earlier, drop it here:
             <BlobBadge />
          */}
        </div>
      </header>

      {/* Input */}
      <section className="mb-6 grid gap-3">
        <label className="text-sm font-medium text-gray-700">Your instruction</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Fetch 5 pasta recipes from famous chefs"'
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
          Tip: Be explicit—ask for number of recipes, cuisines, and sourcing rules (images must link to originals).
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
