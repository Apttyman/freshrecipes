'use client'

import React, { useState, useRef } from 'react'

export default function Page() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')

  const logRef = useRef<HTMLDivElement>(null)

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    setHtml('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      let body: { html?: string; error?: string } | null = null
      try {
        body = await res.json()
      } catch {
        setError('Bad response from server.')
        setLoading(false)
        return
      }

      if (!res.ok || !body || !body.html) {
        setError(body?.error || `HTTP ${res.status}`)
      } else {
        setHtml(body.html)
      }
    } catch (e: any) {
      setError('Network error calling /api/generate.')
    } finally {
      setLoading(false)
      // keep request log in view on mobile
      setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(html)
    } catch {}
  }

  return (
    <main className="min-h-screen bg-[#f7f9fb] text-[#111827]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-4xl font-black tracking-tight">FreshRecipes</h1>
        <p className="mt-2 text-base text-[#4b5563]">
          Type a natural-language request. We’ll fetch and format it using your Food52-style prompt.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !query.trim()}
            className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            onClick={handleCopyAll}
            disabled={!html}
            className="rounded-xl border px-5 py-3 text-black disabled:opacity-40"
          >
            Copy all
          </button>
          {/* Archive button can be wired later */}
          <button disabled className="rounded-xl border px-5 py-3 opacity-40">
            Save all to archive
          </button>
        </div>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Smoked salmon tacos with citrus slaw"
          className="mt-4 h-40 w-full rounded-2xl border bg-white p-4 outline-none"
        />

        <h2 className="mt-8 text-3xl font-extrabold">Preview</h2>

        {!html && !error && (
          <p className="mt-3 text-[#6b7280]">No recipes yet. Try typing a request above.</p>
        )}

        {/* SAFETY: render model HTML in a sandboxed iframe so CSS/JS cannot escape */}
        {html && (
          <div className="mt-4 overflow-hidden rounded-2xl border shadow-sm">
            {/* sandbox with no permissions prevents any scripts from running */}
            <iframe
              title="Recipe Preview"
              sandbox=""             // no allow-scripts, no allow-same-origin
              srcDoc={html}          // full HTML document from the model
              className="h-[1400px] w-full bg-white"
            />
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}

        {/* Request log (simple) */}
        <div ref={logRef} className="mt-8 rounded-2xl border bg-white p-4">
          <div className="font-semibold">Request log</div>
          {loading && <div className="mt-1">→ POST /api/generate</div>}
          {error && <div className="mt-1">✖ Error: {error}</div>}
          {!loading && !error && html && <div className="mt-1">✓ Received HTML document</div>}
        </div>
      </div>
    </main>
  )
}
