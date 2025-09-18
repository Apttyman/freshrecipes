import { NextRequest } from "next/server";
import { deleteItem } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  try {
    await deleteItem(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
