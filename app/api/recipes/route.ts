// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Coerce uploadedAt (string | number | undefined) → number
    const toTs = (v: unknown): number => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const n = Date.parse(String(v ?? ""));
      return Number.isFinite(n) ? n : 0;
    };

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
  } catch (e: any) {
    console.error("recipes route error:", e);
    return new Response("Failed to list recipes", { status: 500 });
  }
}
