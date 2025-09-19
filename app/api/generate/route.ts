// app/api/generate/route.ts
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateRequest = { query: string }

function ok<T>(data: T) {
  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
function bad(message: string, status = 400) {
  return NextResponse.json(
    { html: '', error: message },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

async function loadSystemPrompt(): Promise<string> {
  // Try a few likely locations for your system-prompt.txt
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
  // Fallback (keeps the route functional if the file moves)
  return `You are to fetch {input directives} and return a COMPLETE valid HTML document
  (<!DOCTYPE html> … </html>) that matches the Food52-like styling, chef bio,
  multi-paragraph intro, ingredients, and exact step count. Use only real image
  URLs from the source; omit images if not available. Do NOT return Markdown or JSON.`
}

export async function POST(req: Request) {
  try {
    // 1) Validate env
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return bad(
        'Missing model API key (OPENAI_API_KEY or ANTHROPIC_API_KEY). Set in Vercel → Settings → Environment Variables and redeploy.',
        500
      )
    }

    // 2) Parse body
    let body: GenerateRequest | null = null
    try {
      body = await req.json()
    } catch {
      return bad('Invalid JSON body. POST {"query": string}', 400)
    }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    // 3) Load your ORIGINAL system prompt from file
    const systemPrompt = await loadSystemPrompt()

    // 4) Call OpenAI (adjust if you prefer Anthropic)
    const providerUrl =
      process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const resp = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model,
        // IMPORTANT: do NOT force JSON here — your prompt returns HTML.
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              `Fetch ${query}. Return ONLY a complete, valid HTML document per the system prompt. ` +
              `No Markdown fences, no JSON, no explanations.`,
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return bad(`Model request failed (${resp.status}). ${txt.slice(0, 400)}`, 502)
    }

    const json = await resp.json().catch(() => null as any)
    const html = json?.choices?.[0]?.message?.content ?? ''

    if (typeof html !== 'string' || !html.toLowerCase().includes('<html')) {
      return bad('Model did not return a complete HTML document.', 502)
    }

    // 5) Send the raw HTML to the client
    return ok({ html })
  } catch (err: any) {
    console.error('generate route error:', err)
    return bad('Internal error while generating recipes.', 500)
  }
}
