// app/archive/[slug]/page.tsx
import { get } from "@vercel/blob";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ArchivePage({ params }: { params: { slug: string } }) {
  const key = `archive/${params.slug}/index.html`;
  try {
    const { url } = await get(key); // throws if key not found
    const html = await (await fetch(url, { cache: "no-store" })).text();
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  } catch {
    notFound();
  }
}
