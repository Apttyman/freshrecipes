// app/lib/html-tools.ts
/**
 * Rewrite all <img src="..."> to Cloudinary "fetch" URLs so images are
 * pulled and cached by Cloudinary (not by your Vercel server).
 * Works without Cloudinary secret; needs only cloud name.
 *
 * Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (or CLOUDINARY_CLOUD_NAME).
 */
const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  process.env.CLOUDINARY_CLOUD_NAME ||
  "";

const CLD_FETCH_BASE = CLOUD_NAME
  ? `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/f_auto,q_auto`
  : null;

// skip schemes Cloudinary can’t/shouldn’t fetch
const SKIP_SCHEMES = /^(data:|blob:|about:|cid:)/i;

// already rewritten?
const IS_ALREADY_CLD = /https:\/\/res\.cloudinary\.com\/[^/]+\/image\/fetch/i;

/**
 * Rewrites only the src value; keeps the original <img> tag intact.
 */
export function rewriteImagesToCloudinaryFetch(html: string): string {
  if (!CLD_FETCH_BASE) return html;

  return html.replace(
    /<img\b([^>]*?)\bsrc=(['"])([^'"]+)\2([^>]*)>/gi,
    (full, preAttrs, quote, src, postAttrs) => {
      try {
        if (!src || SKIP_SCHEMES.test(src) || IS_ALREADY_CLD.test(src)) {
          return full; // leave untouched
        }
        // Absolute-ify protocol-relative src
        const absoluteSrc = src.startsWith("//") ? `https:${src}` : src;

        const encoded = encodeURIComponent(absoluteSrc);
        const cldUrl = `${CLD_FETCH_BASE}/${encoded}`;

        return `<img${preAttrs}src=${quote}${cldUrl}${quote}${postAttrs}>`;
      } catch {
        return full;
      }
    }
  );
}
