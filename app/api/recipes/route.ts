// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

const toTs = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Date.parse(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Sort newest-first
    blobs.sort((a, b) => toTs(b.uploadedAt as any) - toTs(a.uploadedAt as any));

    return new Response(
      JSON.stringify({
        recipes: blobs.map((b) => ({
          key: b.pathname,
          url: b.url,
          size: b.size,
          uploadedAt: toTs(b.uploadedAt as any),
        })),
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e) {
    return new Response("Failed to list recipes", { status: 500 });
  }
}
