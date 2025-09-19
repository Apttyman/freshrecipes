import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import FILE_SYSTEM_PROMPT from '../../prompt/system-prompt.txt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Choose file prompt by default; allow hot override via env
const SYSTEM_PROMPT = (process.env.SYSTEM_PROMPT && process.env.SYSTEM_PROMPT.trim().length
  ? process.env.SYSTEM_PROMPT
  : FILE_SYSTEM_PROMPT
).trim()

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

function missing(key: string) {
  return !process.env[key] || process.env[key]!.trim().length === 0
}

/**
 * Simple health check
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    model: MODEL,
    openaiKeyPresent: !missing('OPENAI_API_KEY'),
    promptSource: process.env.SYSTEM_PROMPT?.trim().length ? 'env' : 'file',
  })
}

/**
 * POST /api/generate
 * Body: { query: string } or { input: string }
 * Returns: { html: string }
 */
export async function POST(req: NextRequest) {
  if (missing('OPENAI_API_KEY')) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set' },
      { status: 500 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const userQuery: string =
    (typeof body?.query === 'string' && body.query.trim()) ||
    (typeof body?.input === 'string' && body.input.trim()) ||
    ''

  if (!userQuery) {
    return NextResponse.json(
      { error: 'Missing "query" (or "input") field' },
      { status: 400 }
    )
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `Input directives:\n` +
            userQuery +
            `\n\nReturn ONLY the final complete HTML document as instructed in the system prompt.`,
        },
      ],
    })

    const html =
      completion.choices?.[0]?.message?.content?.trim() || ''

    if (!html.startsWith('<!DOCTYPE html>') && !html.startsWith('<html')) {
      // Guard rail: ensure caller receives HTML even if the model deviates
      return NextResponse.json(
        {
          error:
            'Model did not return a complete HTML document. Check the SYSTEM_PROMPT and input.',
          preview: html.slice(0, 5000),
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ html })
  } catch (err: any) {
    const msg =
      typeof err?.message === 'string' ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `OpenAI request failed: ${msg}` },
      { status: 500 }
    )
  }
}
