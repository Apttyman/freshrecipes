// app/api/blob-health/route.ts
import { list } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Quick sanity check: do we even have a token visible to the server?
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_ONLY_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, reason: "Missing BLOB token env var" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Try a lightweight listing against your recipes prefix
    // (works even if there are zero blobs)
    await list({ prefix: "recipes/" });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, reason: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
