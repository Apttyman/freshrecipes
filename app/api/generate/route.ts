// app/api/generate/route.ts
import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateRequest = { query: string }

// ---- prompt loader (tolerant paths) ----
async function loadSystemPrompt(): Promise<string> {
  const cwd = process.cwd()
  const candidates = [
    process.env.PROMPT_PATH && path.resolve(cwd, process.env.PROMPT_PATH),
    path.join(cwd, 'app', 'system-prompt.txt'),
    path.join(cwd, 'prompts', 'system-prompt.txt'),
    path.join(cwd, 'src', 'prompts', 'system-prompt.txt'),
    path.join(cwd, 'config', 'system-prompt.txt'),
    path.join(cwd, 'system-prompt.txt'), // last resort (root)
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    try {
      const text = await fs.readFile(p, 'utf8')
      if (text.trim()) return text
    } catch {
      // keep trying next candidate
    }
  }
  throw new Error(
    'Could not find system-prompt.txt. Set PROMPT_PATH or place it in app/, prompts/, src/prompts/, or config/.'
  )
}

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
function bad(message: string, status = 400) {
  return ok({ error: message }, status)
}

export async function POST(req: Request) {
  try {
    // keys
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return bad(
        'Missing model API key (OPENAI_API_KEY or ANTHROPIC_API_KEY). Add it in Vercel → Settings → Environment Variables.',
        500
      )
    }

    // body
    let body: GenerateRequest | null = null
    try {
      body = await req.json()
    } catch {
      return bad('Invalid JSON body; expected { "query": string }', 400)
    }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    // load the big system prompt from one of the tolerated paths
    const systemPrompt = await loadSystemPrompt()

    // call your model (OpenAI-compatible)
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
        temperature: 0.7,
        // The system prompt contains your full Food52-style HTML rules.
        messages: [
          { role: 'system', content: systemPrompt },
          // The app sends only the user's query text
          { role: 'user', content: query },
        ],
        // Let the model freely return either HTML or JSON; we’ll detect below.
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return bad(`Model request failed (${resp.status}). ${txt.slice(0, 400)}`, 502)
    }

    // Try to parse as OpenAI chat response
    const raw = await resp.json().catch(() => null as any)
    const content: string | undefined = raw?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      return bad('Empty response from model.', 502)
    }

    // Dual-mode normalization:
    // 1) If it looks like a full HTML document, send { html }
    if (content.includes('<html') && content.includes('</html>')) {
      return ok({ html: content })
    }

    // 2) Otherwise, try JSON. We accept either raw JSON or a JSON fence the model might return.
    let parsed: any = null
    try {
      const maybeJson = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
      parsed = JSON.parse(maybeJson)
    } catch {
      // not JSON either
    }

    if (parsed && Array.isArray(parsed.recipes)) {
      return ok({ recipes: parsed.recipes })
    }

    // If neither, bubble a precise error (your page shows this nicely)
    return bad(
      'Model did not return a complete HTML document or a valid { recipes } JSON object. Check your model/prompt.',
      502
    )
  } catch (err: any) {
    console.error('generate route error:', err)
    return bad('Internal error while generating recipes.', 500)
  }
}
