// app/api/generate/route.ts (DIAGNOSTIC SAFE MODE)
import OpenAI from "openai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE || undefined,
});

const MODEL =
  (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim()) ||
  "gpt-4o-mini";

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: "You are a recipe generator. Always return strict valid JSON following this schema: { recipes: Recipe[] }."
    },
    { role: "user", content: prompt }
  ],
  temperature: 0.7,
  response_format: { type: "json_object" } // ✅ guarantees valid JSON
});

// Keep system prompt (requirement #7)
const SYSTEM_PROMPT = `
You return structured JSON (not HTML) for recipes, with real, hotlinkable photo URLs and source links.
Return exactly: {"recipes": Recipe[]} where:
Recipe = {
  "title": string,
  "description": string,
  "image": string,   // absolute, public image URL of the final dish
  "source": string,  // canonical page
  "ingredients": string[],
  "steps": string[]
}
Rules:
- No placeholders or stock images.
- Prefer official sources (chef sites or major food publications).
- Titles ≤ 100 chars. Steps actionable and ordered.
- Return VALID JSON. No markdown fences.
`;

function now() { return Date.now(); }
function ms(start: number) { return `${Date.now() - start}ms`; }

async function verifyUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res = await fetch(url, { method: "HEAD", signal: ctl.signal });
    if (!res.ok) {
      res = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: ctl.signal });
    }
    clearTimeout(timer);
    if (!res || !res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.includes("image") || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url);
  } catch {
    return false;
  }
}

async function verifyAllImages(recipes: any[], origin: string, diag: boolean) {
  const t0 = now();
  const MAX_CONCURRENCY = 6;
  const idxs = [...recipes.keys()];
  let verified = 0, dropped = 0;

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, idxs.length) },
    async () => {
      while (idxs.length) {
        const i = idxs.shift()!;
        const r = recipes[i] || {};
        const url = r.image;
        if (typeof url === "string" && url) {
          const ok = await verifyUrl(url, 5000);
          if (ok) {
            r.image = `${origin}/api/img?u=${encodeURIComponent(url)}`;
            verified++;
          } else {
            delete r.image;
            dropped++;
          }
        }
      }
    }
  );
  await Promise.allSettled(workers);

  const out = recipes.filter((r) => !!r.title);
  const detail = diag ? { verifyTime: ms(t0), verified, dropped } : undefined;
  return { out, detail };
}

export async function POST(req: NextRequest) {
  const diag = req.nextUrl.searchParams.get("diag") === "1";
  const verifyFlag = req.nextUrl.searchParams.get("verify"); // "1"|"0"|null
  const skipVerify = verifyFlag === "0";

  const tAll = now();
  const steps: any[] = []; // only returned when diag=1

  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY missing", { status: 500 });
    }

    const tParse = now();
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok for diag */ }
    const instruction = (body?.instruction ?? "").toString().trim();
    if (!instruction) {
      return new Response("Missing 'instruction' string", { status: 400 });
    }
    if (diag) steps.push({ step: "parse", time: ms(tParse), instructionLen: instruction.length });

    const tAI = now();
    const ai = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
      temperature: 0.2,
      max_tokens: 3500, // keep reasonable
      response_format: { type: "json_object" as const },
    });
    const aiText = ai.choices?.[0]?.message?.content ?? "{}";
    if (diag) steps.push({ step: "openai", time: ms(tAI), model: MODEL, promptTokens: ai.usage?.prompt_tokens, completionTokens: ai.usage?.completion_tokens });

    const tJSON = now();
    let data: any = {};
    try {
      data = JSON.parse(aiText);
    } catch (e) {
      if (diag) steps.push({ step: "json-parse-error", sample: aiText.slice(0, 200) });
      return new Response("Model did not return valid JSON", { status: 502 });
    }
    if (!Array.isArray(data.recipes)) data.recipes = [];
    data.recipes = data.recipes
      .map((r: any) => ({
        title: String(r?.title ?? "").slice(0, 200),
        image: r?.image ?? "",
        source: r?.source ?? "",
        description: r?.description ?? "",
        ingredients: Array.isArray(r?.ingredients) ? r.ingredients : [],
        steps: Array.isArray(r?.steps) ? r.steps : [],
      }))
      .filter((r: any) => r.title);
    if (diag) steps.push({ step: "json-normalize", time: ms(tJSON), count: data.recipes.length });

    const origin = req.nextUrl.origin;

    if (skipVerify) {
      // Only rewrite existing images to proxy; no HEAD/GET calls
      const tRewrite = now();
      data.recipes = data.recipes.map((r: any) =>
        r.image ? { ...r, image: `${origin}/api/img?u=${encodeURIComponent(r.image)}` } : r
      );
      if (diag) steps.push({ step: "rewrite-only", time: ms(tRewrite) });
    } else {
      const tVer = now();
      const v = await verifyAllImages(data.recipes, origin, diag);
      data.recipes = v.out;
      if (diag) steps.push({ step: "verify", time: ms(tVer), ...(v.detail || {}) });
    }

    if (diag) steps.push({ step: "total", time: ms(tAll) });

    return new Response(
      JSON.stringify(diag ? { ...data, _diag: steps } : data),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e: any) {
    if (diag) steps.push({ step: "caught", error: String(e?.message || e) });
    return new Response(
      diag ? JSON.stringify({ error: "Internal error", _diag: steps }) : "Internal error",
      { status: 500, headers: { "content-type": diag ? "application/json" : "text/plain" } }
    );
  }
}
