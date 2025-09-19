// app/api/archive/route.ts
import { NextRequest, NextResponse } from "next/server";

type Section = { heading: string; html: string };
export type Recipe = {
  id: number | string;
  title: string;
  author?: string;
  imageUrl?: string | null;
  sections: Section[];
};

export const runtime = "nodejs"; // simple Node runtime; change to "edge" if you want

/** POST /api/archive
 * Body: { recipe: Recipe }  OR  { recipes: Recipe[] }
 * Returns: { ok: true, count: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const recipes: Recipe[] = Array.isArray(body?.recipes)
      ? body.recipes
      : body?.recipe
      ? [body.recipe]
      : [];

    if (!recipes.length) {
      return NextResponse.json(
        { ok: false, error: "No recipe(s) provided" },
        { status: 400 }
      );
    }

    // 🔧 Place to actually persist (DB, KV, Firestore, etc.)
    // For now we just echo back what we would save.
    // You can replace this with your storage of choice.
    // await kv.set(`recipes:${Date.now()}`, recipes)

    return NextResponse.json({ ok: true, count: recipes.length });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
