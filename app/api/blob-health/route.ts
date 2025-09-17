import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_RW;
  if (!token) return NextResponse.json({ ok: false, reason: "missing_token" }, { status: 200 });
  try {
    const { list } = await import("@vercel/blob");
    await list({ token, limit: 1 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}
