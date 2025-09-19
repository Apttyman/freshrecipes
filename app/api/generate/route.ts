import { NextResponse } from 'next/server'
import SYSTEM_PROMPT from '../../prompt/system-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateRequest = { query: string }

function ok<T>(data: T) {
  return NextResponse.json(data, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
function bad(message: string, status = 400) {
  return NextResponse.json({ recipes: [], error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return bad('Missing OPENAI_API_KEY.', 500)

    let body: GenerateRequest | null = null
    try { body = await req.json() } catch { return bad('POST JSON with { "query": string }', 400) }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    // Allow env override but default to the compiled-in string
    const systemPrompt = process.env.SYSTEM_PROMPT || SYSTEM_PROMPT

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
        // Do NOT force JSON here; we want to allow full HTML OR JSON.
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return bad(`Model request failed (${resp.status}). ${txt.slice(0, 300)}`, 502)
    }

    const json = await resp.json().catch(() => null as any)
    const content: string | undefined = json?.choices?.[0]?.message?.content

    // Case A: complete HTML document -> return { html } for your iframe
    if (typeof content === 'string' && content.includes('<html') && content.includes('</html>')) {
      return ok({ html: content })
    }

    // Case B: recipes JSON -> return { recipes } for your JSON renderer
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      if (Array.isArray(parsed?.recipes)) return ok({ recipes: parsed.recipes })
    } catch {
      /* not JSON; fall through */
    }

    return bad('Model did not return a complete HTML document or recipes.', 502)
  } catch (err: any) {
    console.error('generate route error:', err)
    return bad(`Internal error while generating recipes. ${err?.message || ''}`, 500)
  }
}
