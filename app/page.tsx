'use client'

import * as React from 'react'

type StepImage = { url: string; alt?: string | null; role?: string | null }
type Step = { num: number; text: string; images?: StepImage[] }
type IngredientSection = { section?: string | null; items: string[] }
type RecipeData = {
  id: string
  title: string
  heroImage?: { url: string; alt?: string | null } | null
  chef?: {
    name?: string | null
    background?: string | null
    source?: { name?: string | null; url?: string | null } | null
  } | null
  description?: { paragraphs: string[]; tone?: string | null } | null
  ingredients: IngredientSection[]
  instructions: { stepCount: number; steps: Step[] }
  media?: { gallery?: StepImage[] } | null
  meta?: {
    yield?: string | null
    time?: { active?: string | null; total?: string | null } | null
    cuisine?: string | null
    tags?: string[]
  } | null
}
type ModelReturn = {
  html: string
  data: { query: string; recipes: RecipeData[] }
}

type ArchiveEntry = {
  id: string
  savedAt: number
  query: string
  data: RecipeData[]
  html: string
}
type HighlightEntry = {
  id: string // recipe id
  savedAt: number
  query: string
  recipe: RecipeData
}

// ----- localStorage helpers (client-only) -----
const ARCHIVE_KEY = 'freshrecipes.archive.v1'
const HIGHLIGHT_KEY = 'freshrecipes.highlights.v1'

function loadArchive(): ArchiveEntry[] {
  try {
    const s = localStorage.getItem(ARCHIVE_KEY)
    return s ? (JSON.parse(s) as ArchiveEntry[]) : []
  } catch {
    return []
  }
}
function saveArchive(entries: ArchiveEntry[]) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(entries))
}
function loadHighlights(): HighlightEntry[] {
  try {
    const s = localStorage.getItem(HIGHLIGHT_KEY)
    return s ? (JSON.parse(s) as HighlightEntry[]) : []
  } catch {
    return []
  }
}
function saveHighlights(entries: HighlightEntry[]) {
  localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(entries))
}

// Simple toast
function useToast() {
  const [msg, setMsg] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 1600)
    return () => clearTimeout(t)
  }, [msg])
  return {
    msg,
    show: (m: string) => setMsg(m),
    node: msg ? (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/90 px-4 py-2 text-sm text-white shadow">
        {msg}
      </div>
    ) : null,
  }
}

export default function Page() {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ModelReturn | null>(null)

  const toast = useToast()

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const body = (await res.json().catch(() => null)) as
        | { error?: string } & Partial<ModelReturn>
        | null

      if (!res.ok || !body) {
        setError(body?.error || `HTTP ${res.status}`)
      } else if (!body.html || !body.data) {
        setError(body?.error || 'Bad payload from server.')
      } else {
        setResult({ html: body.html, data: body.data as ModelReturn['data'] })
      }
    } catch {
      setError('Network error calling /api/generate.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyHtml() {
    if (!result?.html) return
    try {
      await navigator.clipboard.writeText(result.html)
      toast.show('HTML copied')
    } catch {}
  }

  function handleSaveAll() {
    if (!result) return
    const entries = loadArchive()
    entries.unshift({
      id: `${Date.now()}`,
      savedAt: Date.now(),
      query: result.data.query,
      data: result.data.recipes,
      html: result.html,
    })
    saveArchive(entries.slice(0, 50)) // keep last 50
    toast.show('Saved to archive')
  }

  function handleSaveHighlight(recipe: RecipeData) {
    const existing = loadHighlights()
    const already = existing.find((e) => e.id === recipe.id)
    if (already) {
      toast.show('Already in highlights')
      return
    }
    existing.unshift({
      id: recipe.id,
      savedAt: Date.now(),
      query: result?.data.query || '',
      recipe,
    })
    saveHighlights(existing.slice(0, 200))
    toast.show('Recipe highlighted')
  }

  // Prevent overlay containers from blocking clicks on buttons
  // (defensive, in case model HTML has position:fixed)
  React.useEffect(() => {
    if (!result?.html) return
    const fix = () => {
      const culprit = document.querySelector<HTMLDivElement>('#model-overlay-blocker')
      if (culprit) culprit.style.pointerEvents = 'none'
    }
    fix()
    const t = setTimeout(fix, 50)
    return () => clearTimeout(t)
  }, [result?.html])

  return (
    <main className="min-h-screen bg-[#f7f9fb] text-[#111827]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-4xl font-black tracking-tight">FreshRecipes</h1>
        <p className="mt-2 text-[15px] text-[#4b5563]">
          Natural-language recipe finder. Returns polished Food52-style HTML plus structured data.
        </p>

        {/* Controls */}
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Three top chef pasta recipes with summer vegetables"
            className="h-28 w-full resize-none rounded-2xl border border-gray-200 bg-white p-4 outline-none sm:col-span-1"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !query.trim()}
            className="h-12 rounded-xl bg-black px-5 text-white disabled:opacity-50 sm:h-auto"
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            onClick={handleCopyHtml}
            disabled={!result?.html}
            className="h-12 rounded-xl border border-gray-300 bg-white px-5 text-black disabled:opacity-40 sm:h-auto"
          >
            Copy HTML
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!result}
            className="h-12 rounded-xl border border-gray-300 bg-white px-5 text-black disabled:opacity-40 sm:h-auto"
          >
            Save all to archive
          </button>
        </div>

        {/* Inline data card grid for "Save Highlight" buttons */}
        {result?.data?.recipes?.length ? (
          <>
            <h2 className="mt-10 text-2xl font-extrabold">Recipes (structured)</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {result.data.recipes.map((r) => (
                <div
                  key={r.id}
                  className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                >
                  {r.heroImage?.url ? (
                    <div className="relative h-44 w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.heroImage.url}
                        alt={r.heroImage.alt || r.title}
                        className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                      />
                    </div>
                  ) : null}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold leading-tight">{r.title}</h3>
                        {r.chef?.name ? (
                          <p className="mt-0.5 text-[13px] text-gray-600">
                            by {r.chef.name}
                            {r.chef?.source?.name ? (
                              <>
                                {' '}
                                · <span className="text-gray-500">{r.chef.source.name}</span>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => handleSaveHighlight(r)}
                        className="shrink-0 rounded-full border border-gray-300 px-3 py-1 text-[13px] font-medium"
                        aria-label={`Save ${r.title} to highlights`}
                      >
                        ★ Highlight
                      </button>
                    </div>

                    {/* small preview: first paragraph + first 2 ingredients, first 2 steps */}
                    <div className="mt-3 space-y-3 text-[14px] leading-6 text-gray-700">
                      {r.description?.paragraphs?.[0] ? (
                        <p className="line-clamp-3">{r.description.paragraphs[0]}</p>
                      ) : null}
                      {r.ingredients?.length ? (
                        <div>
                          <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                            Ingredients
                          </div>
                          <ul className="list-disc pl-5">
                            {(r.ingredients[0]?.items || []).slice(0, 3).map((it, i) => (
                              <li key={i}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {r.instructions?.steps?.length ? (
                        <div>
                          <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                            Steps
                          </div>
                          <ol className="list-decimal pl-5">
                            {r.instructions.steps.slice(0, 2).map((s) => (
                              <li key={s.num}>{s.text}</li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* Preview of the exact HTML document from the model (isolated) */}
        <h2 className="mt-10 text-2xl font-extrabold">Preview (model HTML)</h2>
        {!result?.html && !error && (
          <p className="mt-2 text-sm text-gray-600">Nothing yet. Generate to see results.</p>
        )}
        {result?.html ? (
          <div className="mt-4 overflow-hidden rounded-2xl border shadow-sm">
            <iframe
              title="Recipe Preview"
              // sandbox without allow-scripts keeps arbitrary HTML inert and isolated
              sandbox=""
              srcDoc={result.html}
              className="h-[1600px] w-full bg-white"
            />
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">{error}</p>
        ) : null}
      </div>

      {toast.node}
    </main>
  )
}
