import { getItem } from "@/app/lib/store";

export const runtime = "nodejs"; // stable + uses our global CSS/layout

export default async function SavedPage(props: any) {
  const params = await props?.params;
  const searchParams = (await props?.searchParams) ?? {};
  const id = params?.id as string | undefined;
  if (!id) return null;

  const item = await getItem(id);
  if (!item) return null;

  const autoPrint = (searchParams?.print as string) === "1";

  return (
    <div className="container">
      <header className="py-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <div className="flex gap-2">
          <a className="btn" href="/archive">← Back</a>
          <button className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </header>

      {/* Render saved HTML — global CSS styles it */}
      <div className="card p-4">
        <div className="recipe-surface" dangerouslySetInnerHTML={{ __html: item.html }} />
      </div>

      {autoPrint ? <script dangerouslySetInnerHTML={{ __html: "window.print()" }} /> : null}
    </div>
  );
}
