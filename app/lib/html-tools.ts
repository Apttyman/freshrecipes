// app/lib/html-tools.ts
// Tiny HTML helpers. Focus: sanitize model output and rewrite <img> to Cloudinary fetch URLs.

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const CLOUD_BASE =
  process.env.NEXT_PUBLIC_CLOUDINARY_FETCH_BASE ||
  (CLOUD ? `https://res.cloudinary.com/${CLOUD}/image/fetch` : "");

// reasonable default transform: automatic format+quality and a wide max width
const CLOUD_TRANSFORM = process.env.NEXT_PUBLIC_CLOUDINARY_TRANSFORM || "f_auto,q_auto,w_1600";

export function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // If the model wrapped in JSON like { html: "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {/* ignore */}
  }

  // Strip fenced code blocks ```html ... ``` or ``` ... ```
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}

/** If there are *no* <img>, inject a neutral hero at the top of <body> (or document). */
export function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;

  const hero =
    `<img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" loading="lazy" />`;

  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) {
    return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  }
  return `${hero}\n${html}`;
}

/**
 * Rewrite every <img src="..."> to Cloudinary "fetch" URLs.
 * Skips data: URIs and non-http(s).
 * Example output:
 *   https://res.cloudinary.com/<cloud>/image/fetch/f_auto,q_auto,w_1600/<encoded-src>
 */
export function rewriteImagesWithCloudinaryFetch(html: string): string {
  if (!CLOUD_BASE) return html; // cloud not configured → leave src as-is

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    // Extract src value (handles single/double/unquoted)
    const m = tag.match(/\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const rawSrc = m?.[1] ?? m?.[2] ?? m?.[3] ?? "";
    const src = rawSrc.trim();

    // Ignore data URIs or missing/relative sources
    if (!/^https?:\/\//i.test(src)) return tag;

    // Build Cloudinary fetch URL
    const encoded = encodeURIComponent(src);
    const cldUrl = `${CLOUD_BASE}/${CLOUD_TRANSFORM}/${encoded}`;

    // drop referrer/crossorigin attrs; add loading="lazy"
    let t = tag
      .replace(/\s(referrerpolicy|crossorigin)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\sloading\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

    // replace src value
    t = t.replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ` src="${cldUrl}"`);

    // ensure lazy loading
    t = t.replace(/\/?>$/, (m) => ` loading="lazy"${m}`);

    return t;
  });
}

/** Remove any <meta name="referrer"> and image referrer/crossorigin attributes. */
export function stripNoReferrer(html: string): string {
  let out = html.replace(
    /<meta[^>]+name=["']referrer["'][^>]*>/gi,
    ""
  );
  out = out.replace(/<img\b[^>]*>/gi, (tag) =>
    tag
      .replace(/\s(referrerpolicy|crossorigin)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  );
  return out;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}

export function stamp(): string {
  const d = new Date();
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}
