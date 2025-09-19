'use client'

import React from 'react'

type ResultShape = {
  html: string
  data: { query: string; recipes: any[] } | null
  error?: string
}

export default function HomePage() {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [res, setRes] = React.useState<ResultShape | null>(null)
  const htmlRef = React.useRef<HTMLDivElement>(null)

  async function generate() {
    if (!query.trim()) return
    setLoading(true)
    setRes(null)
    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = (await r.json()) as ResultShape
      setRes(json)
      if (json?.html) requestAnimationFrame(enhanceImages)
    } catch {
      setRes({ html: '', data: null, error: 'Request failed. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  function enhanceImages() {
    const root = htmlRef.current
    if (!root) return
    root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      img.loading = 'lazy'
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.crossOrigin = 'anonymous'
      img.addEventListener('error', () => {
        // keep steps/text; just hide busted image
        img.style.opacity = '0'
      })
    })
  }

  async function saveAllToArchive() {
    if (!res?.html) return
    try {
      const r = await fetch('/api/archive/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: res?.data?.query ?? query,
          html: res.html,
          recipes: res?.data?.recipes ?? [],
        }),
      })
      if (!r.ok) throw new Error('bad status')
      alert('Saved to Archive')
    } catch {
      // fallback download
      const blob = new Blob([res!.html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recipes-${Date.now()}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="page">
      {/* Header — single Archive button */}
      <header className="header">
        <div className="brand">
          <span className="logo" aria-hidden>✺</span>
          <span className="name">FreshRecipes</span>
        </div>
        <a className="btn link" href="/archive" aria-label="Open archive">Archive</a>
      </header>

      {/* Input card — bigger textarea, single Generate button, no extra Save, no inner Archive */}
      <section className="card">
        <textarea
          className="input"
          placeholder="Describe what to fetch (e.g., ‘3 Michelin chef pasta recipes with step photos’)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="row">
          <button className="btn primary" onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </section>

      {/* Error box */}
      {res?.error && (
        <section className="card">
          <div className="error"><strong>Error:</strong> {res.error}</div>
        </section>
      )}

      {/* Rendered result — includes Save + Archive (kept) */}
      {res?.html && (
        <section className="card">
          <div className="row end">
            <button className="btn" onClick={saveAllToArchive}>Save</button>
            <a className="btn" href="/archive">Archive</a>
          </div>
          <div ref={htmlRef} className="render" dangerouslySetInnerHTML={{ __html: res.html }} />
        </section>
      )}

      {/* Footer — ONLY copyright (no Archive/Deploy links) */}
      <footer className="footer">© {new Date().getFullYear()} FreshRecipes</footer>

      <style jsx>{`
        .page { max-width: 860px; margin: 0 auto; padding: 16px; }

        .header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 12px; }
        .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; }
        .logo { width: 28px; height: 28px; display: grid; place-items: center; background: #6c5ce7; color: #fff; border-radius: 8px; font-size: 16px; }
        .name { font-family: 'Playfair Display', ui-serif, Georgia, serif; font-size: 20px; }

        .card { background: #fff; border: 1px solid #eef0f6; border-radius: 12px; padding: 16px; margin-top: 14px; box-shadow: 0 3px 12px rgba(0,0,0,0.03); }
        .input { width: 100%; min-height: 160px; padding: 14px; border-radius: 10px; border: 1px solid #e5e7eb; outline: none; font-size: 16px; }
        .row { display: flex; gap: 10px; margin-top: 12px; }
        .row.end { justify-content: flex-end; }

        .btn { height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid #e5e7eb; background: #fff; font-weight: 800; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn.link { background: #fff; }
        .primary { background: #4f5cff; color: #fff; border-color: #4f5cff; }

        .error { color: #b00020; }

        .render { border: 1px solid #eef0f6; border-radius: 10px; padding: 10px; margin-top: 10px; }

        .footer { color: #6b7280; font-size: 14px; padding: 24px 4px; }
      `}</style>
    </div>
  )
}
