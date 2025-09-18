import { NextRequest } from "next/server";
import { saveItem } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind, title, description, html } = body as {
      kind: "full" | "highlight";
      title: string;
      description: string;
      html: string;
    };
    if (!html || !title || !kind) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }
    const { id } = await saveItem({ kind, title, description, html });
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: "Save failed" }, { status: 500 });
  }
}
