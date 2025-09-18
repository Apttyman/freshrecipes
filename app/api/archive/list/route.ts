import { listItems } from "@/app/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await listItems();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: "List failed" }, { status: 500 });
  }
}
