// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Missing BLOB_READ_WRITE_TOKEN.", { status: 500 });
  }

  // List everything under the recipes/ prefix
  const { blobs } = await list({
    prefix: "recipes/",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // Newest first
  const items = blobs
    .filter(b => b.pathname.endsWith(".html"))
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .map(b => ({
      name: b.pathname.replace(/^recipes\//, ""),
      url: b.url,
      uploadedAt: b.uploadedAt,
    }));

  return new Response(JSON.stringify({ ok: true, items }), {
    headers: { "Content-Type": "application/json" },
  });
}
