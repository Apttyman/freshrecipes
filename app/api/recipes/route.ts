// app/api/recipes/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "recipes/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    blobs.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));

    return new Response(
      JSON.stringify({
        recipes: blobs.map((b) => ({
          key: b.pathname,
          url: b.url,
          size: b.size,
          uploadedAt: b.uploadedAt,
        })),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response("Error listing blobs: " + err.message, { status: 500 });
  }
}
