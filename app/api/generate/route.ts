// app/api/generate/route.ts
import { NextResponse } from 'next/server'

// If you use the Node OpenAI SDK (or any Node-only lib), do this:
export const runtime = 'nodejs'
// Disable caching for this route:
export const dynamic = 'force-dynamic'

type GenerateRequest = {
  query: string
}

type Recipe = {
  id: string
  title: string
  author?: string
  sections: Array<{ heading: string; html: string }>
  imageUrl?: string | null
}

function ok<T>(data: T) {
  return NextResponse.json(data, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
function bad(message: string, status = 400) {
  return NextResponse.json({ recipes: [], error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  try {
    // 1) Validate env first
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Return a shaped response so the client never crashes
      return bad('Missing model API key in server environment (OPENAI_API_KEY or ANTHROPIC_API_KEY). Set it in Vercel → Settings → Environment Variables (Production) and redeploy.', 500)
    }

    // 2) Parse body safely
    let body: GenerateRequest | null = null
    try {
      body = await req.json()
    } catch {
      return bad('Invalid JSON body. The client must POST application/json with { "query": string }', 400)
    }
    const query = (body?.query || '').trim()
    if (!query) return bad('Query is required.', 400)

    // 3) Call your model (replace this block with your real provider call)
    // Example with fetch (Edge/Node safe). Adjust URL/model as needed.
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
          { role: 'system', content: 'Return a JSON object with an array "recipes". Each recipe has id, title, author (optional), sections [{heading, html}], imageUrl (optional).' },
          { role: 'user', content: `Create 1–3 refined recipes for: ${query}. Return ONLY JSON.` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return bad(`Model request failed (${resp.status}). ${txt.slice(0, 300)}`, 502)
    }

    // 4) Parse model JSON safely
    const json = await resp.json().catch(() => null as any)
    // If using OpenAI chat, the JSON is inside choices[0].message.content
    const content = json?.choices?.[0]?.message?.content
    let data: any = null
    try {
      data = typeof content === 'string' ? JSON.parse(content) : content
    } catch {
      return bad('Model did not return valid JSON content.', 502)
    }

    // 5) Normalize shape for the UI
    const recipes: Recipe[] = Array.isArray(data?.recipes) ? data.recipes : []
    return ok({ recipes })
  } catch (err: any) {
    // Final catch-all — never let the route crash
    console.error('generate route error:', err)
    return bad('Internal error while generating recipes.', 500)
  }
}
