// lib/images.ts
type ImgCandidate = { url: string; alt?: string };

export async function headIsImage(u: string): Promise<boolean> {
  try {
    const h = await fetch(u, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (FreshRecipesBot)" },
    });
    if (!h.ok) return false;
    const ct = h.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

// naive HTML extraction helpers
function extractMeta(doc: string, prop: string): string[] {
  const rx = new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "gi"
  );
  const out: string[] = [];
  let m;
  while ((m = rx.exec(doc))) out.push(m[1]);
  return out;
}
function extractTwitterMeta(doc: string, name: string): string[] {
  const rx = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "gi"
  );
  const out: string[] = [];
  let m;
  while ((m = rx.exec(doc))) out.push(m[1]);
  return out;
}
function extractSchemaImage(doc: string): string[] {
  // very light-weight: look for "image": "<url>" or "image":["<url>",...]
  const urls: string[] = [];
  const rx = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = rx.exec(doc))) {
    try {
      const j = JSON.parse(m[1]);
      const items = Array.isArray(j) ? j : [j];
      for (const item of items) {
        if (
          item["@type"] === "Recipe" ||
          (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
        ) {
          const img = item.image;
          if (typeof img === "string") urls.push(img);
          else if (Array.isArray(img)) urls.push(...img.filter((x: any) => typeof x === "string"));
          else if (img?.url) urls.push(img.url);
        }
      }
    } catch {}
  }
  return urls;
}
function extractArticleImgs(doc: string): string[] {
  // grab likely imgs inside article/figure/recipe blocks
  const rx = /<(img)[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let m;
  while ((m = rx.exec(doc))) {
    const src = m[2];
    // ignore data: and tracking pixels
    if (!src.startsWith("data:") && src.length > 8) urls.push(src);
  }
  return urls;
}

function absolutize(maybe: string, base: string): string {
  try {
    return new URL(maybe, base).toString();
  } catch {
    return maybe;
  }
}

export async function fetchRealImagesFromSource(
  pageUrl: string,
  max: number = 8
): Promise<ImgCandidate[]> {
  try {
    const rsp = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (FreshRecipesBot)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!rsp.ok) return [];

    const html = await rsp.text();
    const base = pageUrl;

    const candidates: string[] = [];

    // priority: schema.org/Recipe
    for (const u of extractSchemaImage(html)) candidates.push(absolutize(u, base));
    // og/twitter images
    for (const u of extractMeta(html, "og:image")) candidates.push(absolutize(u, base));
    for (const u of extractTwitterMeta(html, "twitter:image")) candidates.push(absolutize(u, base));
    // any inline images as fallback
    for (const u of extractArticleImgs(html)) candidates.push(absolutize(u, base));

    // de-dupe & validate
    const uniq = Array.from(new Set(candidates));
    const out: ImgCandidate[] = [];
    for (const u of uniq) {
      if (out.length >= max) break;
      if (await headIsImage(u)) out.push({ url: u });
    }
    return out;
  } catch {
    return [];
  }
}

export async function serpImageFallback(
  query: string
): Promise<ImgCandidate[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("tbm", "isch");
    url.searchParams.set("api_key", key);

    const rsp = await fetch(url.toString(), { cache: "no-store" });
    if (!rsp.ok) return [];
    const data = await rsp.json();

    const imgs: string[] =
      (data?.images_results || []).map((x: any) => x.original || x.thumbnail) || [];

    const out: ImgCandidate[] = [];
    for (const u of imgs) {
      if (await headIsImage(u)) out.push({ url: u });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}
