// app/lib/html-tools.ts
//
// Tiny HTML utilities used by /api/generate.  Safe, incremental.
// - toPureHtml: strips code fences / JSON wrappers
// - addNoReferrer: adds <meta name="referrer"> and per-<img> attrs
// - rewriteImagesToCloudinary: wraps every <img src> with Cloudinary "fetch" URL
//
// Requires: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (no key/secret needed)

export function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  // If the model returned JSON like: { "html": "<html>...</html>" }
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch { /* ignore parse error */ }
  }

  // Strip fenced code blocks: ```html ... ``` or ``` ... ```
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}

export function addNoReferrer(html: string): string {
  let out = html || "";

  // Ensure <head> contains meta referrer
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
    }
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }

  // Normalize per-<img> attributes
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
    return t.replace(/\s{2,}/g, " ");
  });

  return out;
}

/**
 * Wrap every <img src="..."> with Cloudinary "fetch" URL:
 *   https://res.cloudinary.com/<cloud>/image/fetch/<encoded original URL>
 *
 * Notes:
 *  - Only rewrites absolute http(s) URLs.
 *  - If src is already a Cloudinary fetch, leaves as-is.
 *  - No Cloudinary API key/secret needed for fetch.
 */
export function rewriteImagesToCloudinary(html: string, cloudName: string): string {
  if (!cloudName) return html; // no-op if not configured

  const base = `https://res.cloudinary.com/${cloudName}/image/fetch/`;

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\ssrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i);
    if (!srcMatch) return tag;

    // Extract the original URL regardless of quote style
    const orig = (srcMatch[2] || srcMatch[3] || srcMatch[4] || "").trim();
    if (!/^https?:\/\//i.test(orig)) return tag; // only absolute URLs

    // Already a Cloudinary fetch?
    if (orig.startsWith(base)) return tag;

    const wrapped = base + encodeURIComponent(orig);

    // Replace just the src value inside the tag (keep other attrs intact)
    const replaced = tag.replace(srcMatch[1], `"${wrapped}"`);
    return replaced;
  });
}
