import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const runtime = "edge";

function buildOrigin() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  return `${proto}://${host}`;
}

async function fetchItem(id: string) {
  const origin = buildOrigin();
  const res = await fetch(`${origin}/api/archive/get?id=${id}`, {
    cache: "no-store",
    // Explicit pass-through to avoid caching layers on edge
    headers: { "accept": "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as { html: string; title: string; description: string };
}

export default async function SavedPage({ params, searchParams }: any) {
  const { id } = params;
  const item = await fetchItem(id);
  if (!item) return notFound();
  const autoPrint = searchParams?.print === "1";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{item.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`body{font:16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Helvetica,Arial,sans-serif;padding:24px;color:#111;background:#fff}
          .bar{position:sticky;top:0;background:#fff;border-bottom:1px solid #eee;padding:10px 0;margin: -24px -24px 16px -24px}
          .wrap{max-width:1000px;margin:0 auto;padding:0 16px}
          .btn{padding:8px 10px;border:1px solid #ddd;border-radius:8px;background:#f9f9f9}
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
