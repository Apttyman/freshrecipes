// app/api/generate/route.ts
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateRequest = { query: string }

function ok<T>(data: T) {
  return NextResponse.json(data, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
function bad(message: string, status = 400) {
  return NextResponse.json({ recipes: [], error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// --- load system prompt from app/prompt/system-prompt.txt (with fallbacks)
async function loadSystemPrompt() {
  const cwd = process.cwd()
  const candidates = [
    'app/prompt/system-prompt.txt',  // your actual path
    'prompt/system-prompt.txt',
    'app/system-prompt.txt',
    'system-prompt.txt',
  ]
  for (const rel of candidates) {
    try {
      const full = path.join(cwd, rel)
      return await readFile(full, 'utf8')
    } catch {}
  }
  throw new Error(`system-prompt.txt not found. Tried: ${candidates.join(', ')}`)
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return bad('Missing model API key in server environment (OPENAI_API_KEY or ANTHROPIC_API_KEY).', 500)
    }

    let body: GenerateRequest | null = null
    try {
      body = await req.json()
    } catch {
      return bad('Invalid JSON body. The client must POST application/json with { "query": string }', 400)
    }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    // Read the system prompt from disk
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

    if (typeof content === 'string' && content.includes('<html')) {
      // Full HTML document case
      return ok({ html: content })
    }

    let parsed: any = null
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content
    } catch {
      /* ignore */
    }
    if (Array.isArray(parsed?.recipes)) {
      return ok({ recipes: parsed.recipes })
    }

    return bad('Model did not return a complete HTML document or recipes.', 502)
  } catch (err: any) {
    console.error('generate route error:', err)
    return bad(`Internal error: ${err?.message || String(err)}`, 500)
  }
}
