// app/api/generate/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateReq = { query?: string }

function ok(payload: any) {
  // Always 200 so the client never throws; errors live in payload.error
  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: Request) {
  let query = ''
  try {
    const body = (await req.json()) as GenerateReq
    query = (body?.query || '').trim()
  } catch {
    return ok({ html: '', data: null, error: 'Invalid JSON body.' })
  }
  if (!query) return ok({ html: '', data: null, error: 'Query is required.' })

  // Use OpenAI-compatible endpoint; supports proxy/base override
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const apiKey = process.env.OPENAI_API_KEY

  // If no key, return a graceful error (don’t throw)
  if (!apiKey) {
    return ok({
      html: '',
      data: { query, recipes: [] },
      error:
        'Missing OPENAI_API_KEY in environment. Add it in Vercel → Settings → Environment Variables and redeploy.',
    })
  }

  const systemPrompt = `Return ONLY a COMPLETE, valid HTML document (<!DOCTYPE html>…</html>) with embedded <style> (no external assets).
Design language: Food52-inspired—clean, airy, soft palette, bold Playfair-style serif titles, readable sans body, subtle dividers, slight card shadows, mobile-first responsive.
Content requirements for EACH recipe:
1) Recipe name (H1/H2).
2) Chef’s name and a short background paragraph (if available).
3) A rich, 3–5 paragraph introduction containing history/context, chef philosophy, uniqueness, and cultural/seasonal notes.
4) Ingredients list (<ul>).
5) Step-by-step instructions (<ol>): preserve the EXACT step count and roughly the same length/detail as the source; keep all timings/nuances; improve clarity lightly without shortening.
6) Images: use the REAL absolute image URLs from the source only. If a step has a source image, include one image for that step. If any image fails, keep ALL steps and text; never remove content because an image is bad. Omit gracefully when no valid image exists (no placeholders).
Accessibility/semantics: proper landmarks, headings hierarchy, alt text.
Keep CSS scoped to the page. No frameworks, no scripts.`

  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Fetch and render: ${query}` },
        ],
      }),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return ok({
        html: '',
        data: { query, recipes: [] },
        error: `Model request failed (${resp.status}). ${text.slice(0, 400)}`,
      })
    }

    const json = await resp.json().catch(() => null as any)
    const content = json?.choices?.[0]?.message?.content
    const html =
      typeof content === 'string' && content.trim().startsWith('<')
        ? content
        : ''

    if (!html) {
      return ok({
        html: '',
        data: { query, recipes: [] },
        error:
          'Model did not return a complete HTML document. Check your model/keys.',
      })
    }

    return ok({ html, data: { query, recipes: [] } })
  } catch (e: any) {
    return ok({
      html: '',
      data: { query, recipes: [] },
      error: `Internal error contacting model: ${e?.message || e}`,
    })
  }
}
