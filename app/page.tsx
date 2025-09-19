'use client'

import React from 'react'

type ModelReturn = {
  html: string
  data: { query: string; recipes: any[] } | null
  error?: string
}

export default function HomePage() {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<ModelReturn | null>(null)
  const renderedRef = React.useRef<HTMLDivElement>(null)

  async function generate() {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = await resp.json()
      setResult(json)
      setTimeout(() => ensureImages(), 0)
    } catch {
      setResult({ html: '', data: null, error: 'Request failed. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  function ensureImages() {
    const root = renderedRef.current
    if (!root) return
    const imgs = root.querySelectorAll('img')
    imgs.forEach((img) => {
      const el = img as HTMLImageElement
      el.loading = 'lazy'
      el.decoding = 'async'
      el.referrerPolicy = 'no-referrer'
      el.crossOrigin = 'anonymous'
      el.addEventListener('error', () => {
        el.classList.add('img-error') // text remains; we do not strip anything
      })
    })
  }

  async function saveAllToArchive() {
    if (!result?.html) return
    try {
      const resp = await fetch('/api/archive/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: result?.data?.query ?? query,
          html: result.html,
          recipes: result?.data?.recipes ?? [],
        }),
      })
      if (!resp.ok) throw new Error('bad status')
      toast('Saved to Archive')
    } catch {
      // Fallback: download HTML so the user never loses work
      const blob = new Blob([result!.html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recipes-${Date.now()}.html`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()
      toast('Downloaded HTML')
    }
  }

  function toast(msg: string) {
    const div = document.createElement('div')
    div.textContent = msg
    Object.assign(div.style, {
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 14px', background: '#111420', color: '#fff',
      borderRadius: '12px', zIndex: '1000'
    } as CSSStyleDeclaration)
    document.body.appendChild(div)
    setTimeout(() => div.remove(), 1400)
  }

  return (
    <div className="stack">
      {/* Query */}
      <section className="card">
        <div className="query-grid">
          <input
            className="input"
            placeholder="Describe what to fetch (e.g., ‘3 Michelin-level pasta recipes with step photos’)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate() }}
            aria-label="Recipe query"
          />
          <div className="controls">
            <button className="btn" onClick={generate} disabled={loading}>
              {loading ? 'Generating…' : 'Generate'}
            </button>
            <button className="btn btn-ghost" onClick={saveAllToArchive} disabled={!result?.html}>
              Save
            </button>
            <a className="btn btn-ghost" href="/archive">Open Archive</a>
          </div>
        </div>
      </section>

      {/* Results */}
      {result?.error && (
        <section className="card rendered" role="status" aria-live="polite">
          <div className="canvas"><strong>Error:</strong> {result.error}</div>
        </section>
      )}

      {result?.html && (
        <section className="card rendered">
          <div className="toolbar">
            <button className="btn btn-ghost" onClick={saveAllToArchive}>Save</button>
            <a className="btn" href="/archive">Open Archive</a>
          </div>
          <div
            className="canvas"
            ref={renderedRef}
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        </section>
      )}
    </div>
  )
}
