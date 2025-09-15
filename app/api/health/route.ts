export async function GET() {
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  return new Response(JSON.stringify({ ok: true, openaiKeyPresent: hasKey }), {
    headers: { "Content-Type": "application/json" },
  });
}
