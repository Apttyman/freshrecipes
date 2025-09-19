// app/api/generate/route.ts
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateRequest = { query: string }

function ok<T>(data: T) {
  return NextResponse.json(data, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
function bad(message: string, status = 400) {
  return NextResponse.json({ recipes: [], error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// --- Load system prompt bundled with this route
async function loadSystemPrompt(): Promise<string> {
  // The txt file lives at app/prompt/system-prompt.txt
  // This route is at app/api/generate/route.ts
  // So the relative path is ../../prompt/system-prompt.txt
  try {
    const url = new URL('../../prompt/system-prompt.txt', import.meta.url)
    return await readFile(url, 'utf8')
  } catch (e) {
    // Fallbacks for local dev only
    try {
      const url2 = new URL('../../../prompt/system-prompt.txt', import.meta.url)
      return await readFile(url2, 'utf8')
    } catch {}
    // Final fallback: allow env override
    const fromEnv = process.env.SYSTEM_PROMPT
    if (fromEnv) return fromEnv
    throw new Error('system-prompt.txt not found next to this route (../../prompt/system-prompt.txt).')
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return bad('Missing model API key (OPENAI_API_KEY or ANTHROPIC_API_KEY).', 500)

    let body: GenerateRequest | null = null
    try { body = await req.json() } catch { return bad('POST JSON with { "query": string }', 400) }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    const systemPrompt = await loadSystemPrompt()

    const providerUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const resp = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return bad(`Model request failed (${resp.status}). ${txt.slice(0, 300)}`, 502)
    }

    const json = await resp.json().catch(() => null as any)
    const content: string | undefined = json?.choices?.[0]?.message?.content

    // Full HTML document case
    if (typeof content === 'string' && content.includes('<html')) return ok({ html: content })

    // Structured recipes JSON case
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      if (Array.isArray(parsed?.recipes)) return ok({ recipes: parsed.recipes })
    } catch { /* not JSON */ }

    return bad('Model did not return a complete HTML document or recipes.', 502)
  } catch (err: any) {
    console.error('generate route error:', err)
    return bad(`Internal error while generating recipes. ${err?.message || ''}`, 500)
  }
}
