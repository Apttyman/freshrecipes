import { notFound } from "next/navigation";
import { getItem } from "@/app/lib/store";

export const runtime = "nodejs"; // stable for blob access & server libs

export default async function SavedPage(props: any) {
  const params = await props?.params;
  const searchParams = (await props?.searchParams) ?? {};
  const id = params?.id as string | undefined;
  if (!id) return notFound();

  const item = await getItem(id);
  if (!item) return notFound();

  const autoPrint = (searchParams?.print as string) === "1";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{item.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`body{font:16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Helvetica,Arial,sans-serif;padding:24px;color:#0f172a;background:#fff}
          .bar{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e7eb;padding:10px 0;margin:-24px -24px 16px -24px}
          .wrap{max-width:1000px;margin:0 auto;padding:0 16px}
          .btn{padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;cursor:pointer}
          @media print {.bar{display:none}}`}</style>
      </head>
      <body>
        <div className="bar">
          <div className="wrap" style={{ display: "flex", gap: 8 }}>
            <a className="btn" href="/archive">← Back to Archive</a>
            <button className="btn" onClick={() => window.print()}>Print</button>
          </div>
        </div>
        <div className="wrap">
          <h1 style={{ marginTop: 0 }}>{item.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: item.html }} />
        </div>
        {autoPrint ? <script dangerouslySetInnerHTML={{ __html: "window.print()" }} /> : null}
      </body>
    </html>
  );
}
