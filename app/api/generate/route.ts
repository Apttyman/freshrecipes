// app/api/generate/route.ts
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateRequest = { query: string }

// ===== Types for the structured payload we expect back =====
export type StepImage = { url: string; alt?: string | null; role?: string | null }
export type Step = { num: number; text: string; images?: StepImage[] }
export type IngredientSection = { section?: string | null; items: string[] }
export type RecipeData = {
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
export type ModelReturn = {
  html: string
  data: { query: string; recipes: RecipeData[] }
}

function ok<T>(data: T) {
  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
function bad(message: string, status = 400) {
  return NextResponse.json(
    { html: '', data: null, error: message },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

// Load the authored system prompt from disk (your original spec)
async function loadSystemPrompt(): Promise<string> {
  const candidates = [
    join(process.cwd(), 'system-prompt.txt'),
    join(process.cwd(), 'app', 'lib', 'system-prompt.txt'),
    join(process.cwd(), 'app', 'system-prompt.txt'),
  ]
  for (const p of candidates) {
    try {
      const s = await readFile(p, 'utf8')
      if (s?.trim()) return s
    } catch {}
  }
  return `Fetch {input directives}. Output complete Food52-style HTML (chef bio, multi-paragraph intro, exact step counts, real images) — no placeholders.`
}

// Hybrid contract: JSON + full HTML, with explicit 1:1 step→photo rule when the source provides photos
function buildHybridContractPrompt(authoredSystem: string) {
  return `
${authoredSystem.trim()}

CRITICAL OUTPUT CONTRACT — RETURN ONE JSON OBJECT WITH:
{
  "html": "<!DOCTYPE html> ... FULL Food52-style HTML document ... </html>",
  "data": {
    "query": "user input that you fulfilled",
    "recipes": [
      {
        "id": "stable-id-or-slug",
        "title": "Dish name",
        "heroImage": { "url": "https://...", "alt": "..." } | null,
        "chef": {
          "name": "Chef Name",
          "background": "Bio/context paragraph(s)",
          "source": { "name": "Site/Publication", "url": "https://..." }
        },
        "description": { "paragraphs": ["para1", "para2", "para3"], "tone": "Food52-like" },
        "ingredients": [
          { "section": "Main", "items": ["..."] },
          { "section": "Garnish", "items": ["..."] }
        ],
        "instructions": {
          "stepCount": <int>,
          "steps": [
            { "num": 1, "text": "Full step text...", "images": [{"url":"https://...","alt":"...","role":"step"}] }
            // EXACT 1:1 with the original step count. NEVER merge or drop steps.
            // IF THE SOURCE DISPLAYS A PHOTO FOR THIS SPECIFIC STEP, INCLUDE THAT PHOTO'S REAL URL IN images[] FOR THIS STEP (1:1).
            // NEVER FABRICATE OR SUBSTITUTE STOCK/PLACEHOLDER IMAGES.
          ]
        },
        "media": { "gallery": [{"url":"https://...","alt":"..."}] },
        "meta": {
          "yield": "4 servings",
          "time": { "active": "25m", "total": "45m" },
          "cuisine": "Italian",
          "tags": ["pasta", "weeknight"]
        }
      }
    ]
  }
}

STRICT RULES:
- "html" must be a COMPLETE, valid HTML document with inline <style>, no external CSS/JS.
- "data" must describe EXACTLY the same recipes as "html" (same titles, chef info, paragraphs, ingredient items, and per-step text).
- Use ONLY real image URLs from the original sources. If a specific step has no real photo in the source, omit images for that step BUT KEEP THE STEP TEXT INTACT (do not drop or shorten).
- Return ONLY JSON (no markdown fences, no commentary).`
    .replace(/\r/g, '')
    .trim()
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return bad(
        'Missing OPENAI_API_KEY. Set it in Vercel → Settings → Environment Variables (Production) and redeploy.',
        500
      )
    }

    // Parse input
    let body: GenerateRequest | null = null
    try {
      body = await req.json()
    } catch {
      return bad('Invalid JSON body. POST {"query": string}', 400)
    }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    // Build system instructions (author + hybrid contract)
    const authored = await loadSystemPrompt()
    const systemPrompt = buildHybridContractPrompt(authored)

    // OpenAI Chat Completions (json_object)
    const providerUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const resp = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              `Fetch ${query}. Follow the CRITICAL OUTPUT CONTRACT exactly. ` +
              `Ensure "html" and "data" match 1:1 and that stepCount equals steps.length.`,
          },
        ],
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return bad(`Model request failed (${resp.status}). ${txt.slice(0, 400)}`, 502)
    }

    // Chat Completions: JSON will be inside choices[0].message.content
    const raw = await resp.json().catch(() => null as any)
    const content = raw?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return bad('Model returned empty content.', 502)
    }

    let parsed: ModelReturn | null = null
    try {
      parsed = JSON.parse(content) as ModelReturn
    } catch {
      return bad('Model did not return valid JSON.', 502)
    }

    // Basic validations to protect downstream UI
    if (!parsed?.html || typeof parsed.html !== 'string' || !parsed.html.toLowerCase().includes('<html')) {
      return bad('Model did not return a complete HTML document in "html".', 502)
    }
    if (!parsed.data || !Array.isArray(parsed.data.recipes)) {
      return bad('Model did not include a valid "data.recipes" array.', 502)
    }
    for (const r of parsed.data.recipes) {
      const stepCount = r?.instructions?.stepCount
      const steps = r?.instructions?.steps
      if (!Array.isArray(steps) || typeof stepCount !== 'number' || steps.length !== stepCount) {
        return bad('Validation failed: instructions.stepCount must equal steps.length.', 502)
      }
      // NOTE: we cannot verify source photos exist at runtime;
      // the contract above instructs the model to include a per-step photo only when the source truly has one.
    }

    return ok(parsed)
  } catch (err: any) {
    console.error('generate route error:', err)
    return bad('Internal error while generating recipes.', 500)
  }
}
