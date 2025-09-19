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
        // Keep steps/text; just hide busted image
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
      toast('Saved to Archive')
    } catch {
      // Fallback: let the user download the HTML immediately
      const blob = new Blob([res!.html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recipes-${Date.now()}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
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
      {/* Header (Archive button stays here) */}
      <header className="site-header">
        <div className="brand">
          <span className="app-badge" aria-hidden>✺</span>
          <span className="app-name">FreshRecipes</span>
        </div>
        <nav className="nav">
          <a className="btn btn-outline" href="/archive" aria-label="Open archive">
            Archive
          </a>
        </nav>
      </header>

      {/* Query card */}
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
            <button
              className="btn btn-outline"
              onClick={saveAllToArchive}
              disabled={!res?.html}
              aria-disabled={!res?.html}
              title={!res?.html ? 'Generate first to enable saving' : 'Save this render'}
            >
              Save
            </button>
            {/* Removed the extra Open Archive button here by request */}
          </div>
        </div>
      </section>

      {/* Error card */}
      {res?.error && (
        <section className="card rendered" role="status" aria-live="polite">
          <div className="canvas">
            <strong>Error:</strong> {res.error}
          </div>
        </section>
      )}

      {/* Rendered HTML card */}
      {res?.html && (
        <section className="card rendered">
          <div className="toolbar">
            <button className="btn btn-outline" onClick={saveAllToArchive}>
              Save
            </button>
            <a className="btn btn-primary" href="/archive">Archive</a>
          </div>
          <div ref={htmlRef} className="canvas" dangerouslySetInnerHTML={{ __html: res.html }} />
        </section>
      )}

      {/* Page styles */}
      <style jsx>{`
        :root {
          --bg: #f8f9fb;
          --card: #ffffff;
          --ink: #0f1222;
          --muted: #6b7280;
          --primary: #4f5cff;
          --ring: rgba(79, 92, 255, 0.35);
          --shadow: 0 10px 30px rgba(15, 18, 34, 0.06);
          --radius: 18px;
        }
        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body { margin: 0; background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; }

        .stack { max-width: 860px; margin: 0 auto; padding: 24px 16px 80px; display: flex; flex-direction: column; gap: 20px; }

        .site-header {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--card); padding: 14px 18px; border-radius: 14px;
          box-shadow: var(--shadow);
        }
        .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 20px; }
        .app-badge {
          display: inline-grid; place-items: center; width: 34px; height: 34px;
          border-radius: 10px; background: linear-gradient(135deg, #7c5cff, #ff8aa3);
          color: white; font-size: 18px;
        }
        .app-name { font-family: 'Playfair Display', ui-serif, Georgia, serif; letter-spacing: 0.2px; }
        .nav { display: flex; gap: 10px; }

        .card {
          background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow);
          padding: 18px; 
        }
        .query-grid { display: grid; gap: 14px; }
        .input.textarea {
          width: 100%; min-height: 140px; padding: 16px 18px; border-radius: 14px;
          border: 1px solid #e6e8ef; outline: none; font-size: 18px; line-height: 1.5;
          background: #fcfcfe;
        }
        .input.textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 6px var(--ring); }
        .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 720px) { .controls { grid-template-columns: 1fr 1fr; } }

        .btn {
          appearance: none; border: 1px solid transparent; border-radius: 14px;
          height: 54px; padding: 0 18px; font-weight: 800; font-size: 18px;
          display: inline-grid; place-items: center; cursor: pointer; transition: transform .04s ease, box-shadow .2s ease, opacity .2s ease;
        }
        .btn:active { transform: translateY(1px); }
        .btn[disabled], .btn[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }

        .btn-primary {
          background: var(--primary); color: #fff; box-shadow: 0 10px 20px rgba(79, 92, 255, .25);
        }
        .btn-primary:hover { box-shadow: 0 12px 26px rgba(79, 92, 255, .3); }

        .btn-outline {
          background: #fff; color: var(--ink); border-color: #e6e8ef;
        }
        .btn-outline:hover { border-color: var(--primary); box-shadow: 0 0 0 5px var(--ring); }

        .rendered .toolbar {
          display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 10px;
        }
        .canvas {
          background: #fff; border: 1px solid #eef0f6; border-radius: 14px; padding: 14px;
        }
      `}</style>
    </div>
  )
}
