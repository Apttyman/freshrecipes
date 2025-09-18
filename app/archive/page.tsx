"use client";

import useSWR from "swr";
import Link from "next/link";

type Row = { id: string; title: string; description: string; createdAt: string };
type Data = { full: Row[]; highlight: Row[] };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ArchivePage() {
  const { data, mutate } = useSWR<Data>("/api/archive/list", fetcher);

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch("/api/archive/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  function RowList({ rows }: { rows: Row[] }) {
    return (
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="card p-3 flex items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">
                <Link href={`/r/${r.id}`}>{r.title}</Link>
              </div>
              <div className="text-slate-600 text-sm truncate">{r.description}</div>
              <div className="text-slate-500 text-xs">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2">
              {/* Send/Print */}
              <Link className="btn" href={`/r/${r.id}?print=1`} title="Print to PDF">
                <ArrowUpIcon />
              </Link>
              {/* Delete */}
              <button className="btn" onClick={() => onDelete(r.id)} title="Delete">
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container">
      <header className="py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-semibold">Archive</h1>
          <Link href="/" className="btn">← Back</Link>
        </div>
      </header>

      {!data ? (
        <div className="card p-4">Loading…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Saved Results</h2>
            <RowList rows={data.full} />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Recipe Highlights</h2>
            <RowList rows={data.highlight} />
          </section>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18M8 6v-2a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}
