import { put, list, del } from "@vercel/blob";

// Storage model: one JSON blob per item, public.
// path: recipes/{id}.json
// JSON: { id, kind, title, description, html, createdAt }

export type Kind = "full" | "highlight";
export type ArchiveItem = {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  html: string;
  createdAt: string;
};

const PREFIX = "recipes/";

function needToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not configured");
  }
}

export async function saveItem(input: {
  kind: Kind;
  title: string;
  description: string;
  html: string;
}) {
  needToken();
  const id = crypto.randomUUID();
  const item: ArchiveItem = {
    id,
    ...input,
    createdAt: new Date().toISOString(),
  };
  const pathname = `${PREFIX}${id}.json`;
  await put(pathname, JSON.stringify(item), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: "application/json; charset=utf-8",
  });
  return { id };
}

export async function getItem(id: string): Promise<ArchiveItem | null> {
  needToken();
  const pathname = `${PREFIX}${id}.json`;
  // list() to get full URL (put doesn't return a deterministic URL here)
  const li = await list({ prefix: PREFIX, token: process.env.BLOB_READ_WRITE_TOKEN });
  const blob = li.blobs.find((b) => b.pathname === pathname);
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ArchiveItem;
}

export async function deleteItem(id: string) {
  needToken();
  const pathname = `${PREFIX}${id}.json`;
  await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
}

export async function listItems(): Promise<{
  full: Pick<ArchiveItem, "id" | "title" | "description" | "createdAt">[];
  highlight: Pick<ArchiveItem, "id" | "title" | "description" | "createdAt">[];
}> {
  needToken();
  const li = await list({ prefix: PREFIX, token: process.env.BLOB_READ_WRITE_TOKEN });
  const entries: ArchiveItem[] = [];
  for (const b of li.blobs) {
    if (!b.pathname.endsWith(".json")) continue;
    const r = await fetch(b.url, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as ArchiveItem;
      entries.push(j);
    }
  }
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    full: entries
      .filter((e) => e.kind === "full")
      .map(({ id, title, description, createdAt }) => ({
        id,
        title,
        description,
        createdAt,
      })),
    highlight: entries
      .filter((e) => e.kind === "highlight")
      .map(({ id, title, description, createdAt }) => ({
        id,
        title,
        description,
        createdAt,
      })),
  };
}
