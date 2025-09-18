import { NextRequest } from "next/server";
import { getItem } from "@/app/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  try {
    const item = await getItem(id);
    if (!item) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(item);
  } catch {
    return Response.json({ error: "Get failed" }, { status: 500 });
  }
}
