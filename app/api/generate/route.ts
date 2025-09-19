// app/api/generate/route.ts
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// This route runs on Node (not Edge) so we can read the system prompt file.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
function err(message: string, status = 500) {
  return ok({ error: message }, status);
}

type Body = { query?: string };

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return err(
        'Server is missing OPENAI_API_KEY. Add it in Vercel → Settings → Environment Variables and redeploy.',
        500
      );
    }

    let body: Body | null = null;
    try {
      body = await req.json();
    } catch {
      return err('Invalid JSON. POST { "query": string } with Content-Type: application/json.', 400);
    }

    const userQuery = (body?.query || '').trim();
    if (!userQuery) return err('Query is required.', 400);

    // Load your rich system prompt from a file in the repo root (adjust the path if yours differs)
    // e.g. /system-prompt.txt
    const sysPath = path.join(process.cwd(), 'system-prompt.txt');
    let systemPrompt = '';
    try {
      systemPrompt = await readFile(sysPath, 'utf8');
    } catch {
      return err('Cannot read system-prompt.txt from project root. Make sure it exists.', 500);
    }

    // Ask the model to return a COMPLETE HTML document only
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        // IMPORTANT: we want raw HTML text back (no JSON wrapping)
        messages: [
          {
            role: 'system',
            content:
              `${systemPrompt}\n\nSTRICT: Return ONLY a complete HTML document (` +
              '<!DOCTYPE html> … </html>) with inline <style>. No JSON, no Markdown.',
          },
          { role: 'user', content: userQuery },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return err(`Model request failed (${resp.status}). ${text.slice(0, 400)}`, 502);
    }

    const json = await resp.json().catch(() => null as any);
    const content: string | undefined = json?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      return err('Model returned no content.', 502);
    }

    // Validate it's a full HTML document
    const html = content.trim();
    const looksLikeDoc =
      /<!doctype html/i.test(html) &&
      /<html[\s>]/i.test(html) &&
      /<\/html>/i.test(html) &&
      /<head[\s>]/i.test(html) &&
      /<body[\s>]/i.test(html);

    if (!looksLikeDoc) {
      return err('Model did not return a complete HTML document.', 502);
    }

    return ok({ html });
  } catch (e: any) {
    console.error('generate route error:', e);
    return err('Internal error while generating HTML.', 500);
  }
}
