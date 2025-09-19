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
      // We always get 200 with a shaped body
      const json = (await r.json()) as ResultShape
      setRes(json)
      if (json?.html) requestAnimationFrame(enhanceImages)
    } catch {
      setRes({ html: '', data: null, error: 'Request failed at network layer.' })
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
        // fade broken image but KEEP the text/steps (never remove!)
        img.style.opacity = '0.0'
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
      toast('Saved to Archive')
    } catch {
      // Fallback: download HTML so the user never loses a render
      const blob = new Blob([res!.html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recipes-${Date.now()}.html`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast('Downloaded HTML')
    }
  }

  function toast(msg: string) {
    const el = document.createElement('div')
    el.textContent = msg
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 14px',
      background: '#121420',
      color: '#fff',
      borderRadius: '12px',
      fontWeight: '700',
      zIndex: '1000',
    } as CSSStyleDeclaration)
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1400)
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="query-grid">
          <textarea
            className="input textarea"
            placeholder="Describe what to fetch (e.g., ‘3 Michelin chef pasta recipes with step photos’)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="controls">
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Generating…' : 'Generate'}
            </button>
            <button className="btn btn-outline" onClick={saveAllToArchive} disabled={!res?.html}>
              Save
            </button>
            <a className="btn btn-outline" href="/archive">Open Archive</a>
          </div>
        </div>
      </section>

      {res?.error && (
        <section className="card rendered" role="status" aria-live="polite">
          <div className="canvas"><strong>Error:</strong> {res.error}</div>
        </section>
      )}

      {res?.html && (
        <section className="card rendered">
          <div className="toolbar">
            <button className="btn btn-outline" onClick={saveAllToArchive}>Save</button>
            <a className="btn btn-primary" href="/archive">Open Archive</a>
          </div>
          <div ref={htmlRef} className="canvas" dangerouslySetInnerHTML={{ __html: res.html }} />
        </section>
      )}
    </div>
  )
}
