// app/api/recipes/route.ts
import { list } from "@vercel/blob";
export const runtime = "nodejs";

export async function GET() {
  const { blobs } = await list({ prefix: "recipes/" });
  // newest first
  blobs.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
  return new Response(JSON.stringify({
    recipes: blobs.map(b => ({
      key: b.pathname,
      url: b.url,
      size: b.size,
      uploadedAt: b.uploadedAt
    }))
  }), { headers: { "Content-Type": "application/json" } });
}
