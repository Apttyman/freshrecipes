// app/previous/page.tsx
export default async function Previous() {
  const indexUrl = `https://${process.env.VERCEL_BLOB_STORAGE_HOST || "blob.vercel-storage.com"}/recipes/index.json`;
  let items: { url: string; slug: string; title: string; ts: number }[] = [];
  try {
    const res = await fetch(indexUrl, { cache: "no-store" });
    if (res.ok) items = await res.json();
  } catch {}
  return (
    <main style={{maxWidth:900, margin:"0 auto", padding:"24px"}}>
      <h1>Previous Recipes</h1>
      <ul>
        {items.map(i => (
          <li key={i.slug} style={{margin:"10px 0"}}>
            <a href={i.url} target="_blank" rel="noopener">
              {new Date(i.ts).toLocaleString()} — {i.title}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
