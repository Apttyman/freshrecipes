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
      // After HTML mounts, normalize images
      setTimeout(() => ensureImages(), 0)
    } catch (e) {
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
      // Absolutely critical: do NOT rewrite URLs; just make them reliable
      el.loading = 'lazy'
      el.decoding = 'async'
      el.referrerPolicy = 'no-referrer'
      el.crossOrigin = 'anonymous'
      // keep text even if an image is broken
      el.addEventListener('error', () => {
        el.classList.add('img-error')
        // Do NOT remove surrounding text/steps
      })
    })
  }

  async function copyHtml() {
    if (!result?.html) return
    try {
      await navigator.clipboard.writeText(result.html)
      toast('Copied HTML to clipboard')
    } catch {
      toast('Copy failed')
    }
  }

  function toast(msg: string) {
    // super light inline toast
    const div = document.createElement('div')
    div.textContent = msg
    div.style.position = 'fixed'
    div.style.bottom = '16px'
    div.style.left = '50%'
    div.style.transform = 'translateX(-50%)'
    div.style.padding = '10px 14px'
    div.style.background = 'rgba(31,27,22,.9)'
    div.style.color = '#fff'
    div.style.borderRadius = '999px'
    div.style.zIndex = '1000'
    document.body.appendChild(div)
    setTimeout(() => div.remove(), 1500)
  }

  // Optional hooks for your existing archive endpoints (no behavior change if absent)
  async function saveAllToArchive() {
    if (!result?.html) return
    try {
      const resp = await fetch('/api/archive/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: result?.data?.query ?? query,
          html: result.html,
          // pass through recipes meta for your archive UI if it uses it
          recipes: result?.data?.recipes ?? [],
        }),
      })
      if (!resp.ok) throw new Error('bad status')
      toast('Saved to Archive')
    } catch {
      // Fallback: download as file so user never loses work
      const blob = new Blob([result!.html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recipes-${Date.now()}.html`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()
      toast('Downloaded HTML (Archive API unavailable)')
    }
  }

  return (
    <div className="stack">
      {/* Query input */}
      <section className="query-card">
        <div className="query-row">
          <input
            className="input"
            type="text"
            placeholder="e.g., 3 top chef pasta recipes with step photos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate() }}
            aria-label="Recipe query"
          />
          <button className="btn" type="button" onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
        <div className="action-row">
          <button className="btn btn-outline" type="button" onClick={() => { setQuery('3 top chef pasta recipes with step photos'); }}>
            Try Example
          </button>
          <span className="badge">Keeps your system prompt intact</span>
          <a className="btn btn-secondary" href="/archive">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M3 3h18v4H3V3zm2 6h14v12H5V9zm3 2v2h8v-2H8z" fill="currentColor"/></svg>
            Open Archive
          </a>
        </div>
        <p className="help">We’ll render the model’s full Food52-style HTML and keep all steps even if some images fail to load. Real images only—no rewriting.</p>
      </section>

      {/* Results */}
      {result?.error && (
        <section className="rendered">
          <strong>Error:</strong> {result.error}
        </section>
      )}

      {result?.html && (
        <section className="rendered">
          <div className="model-toolbar">
            <button className="btn btn-ghost" type="button" onClick={copyHtml}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v16h13a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 18H8V7h11v16z" fill="currentColor"/></svg>
              Copy HTML
            </button>
            <button className="btn" type="button" onClick={saveAllToArchive}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M5 20h14v-8H5v8zm0-10h14V6H5v4zm4 7h6v-2H9v2z" fill="currentColor"/></svg>
              Save All to Archive
            </button>
          </div>

          {/* We render the model’s FULL HTML document inside an iframe-like sandbox container.
              To preserve your current structure, we just insert the HTML directly. */}
          <div
            ref={renderedRef}
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        </section>
      )}
    </div>
  )
}
