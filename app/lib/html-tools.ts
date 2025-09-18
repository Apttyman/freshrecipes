// Image URL rewriting helpers for LLM-provided HTML

const CLOUD_NAME =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    : undefined;

const CLD_FETCH_BASE = CLOUD_NAME
  ? `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/f_auto,q_auto`
  : null;

const PROXY_BASE = "/api/img?u="; // local proxy fallback

const SKIP_SCHEMES = /^(data:|blob:|about:|chrome:|edge:)/i;
const IS_ALREADY_CLD = /res\.cloudinary\.com/i;

/**
 * Core rewriter. If Cloudinary is configured, use "fetch" delivery.
 * Otherwise, fall back to the local /api/img?u= proxy.
 * Leaves data: and already-cloudinary URLs untouched.
 */
export function rewriteImages(html: string): string {
  const base = CLD_FETCH_BASE ?? PROXY_BASE;

  return html.replace(
    /<img\b([^>]*?)\bsrc=(['"])([^'"]+)\2([^>]*)>/gi,
    (full, preAttrs, quote, src, postAttrs) => {
      try {
        if (!src || SKIP_SCHEMES.test(src) || IS_ALREADY_CLD.test(src)) {
          return full;
        }
        const encoded = encodeURIComponent(src);
        const newSrc = CLD_FETCH_BASE
          ? `${base}/${encoded}`
          : `${base}${encoded}`;
        return `<img${preAttrs}src=${quote}${newSrc}${quote}${postAttrs}>`;
      } catch {
        return full;
      }
    }
  );
}

/**
 * Back-compat alias for older imports.
 * Your API route imports `rewriteImagesToCloudinaryFetch` — keep that working.
 */
export function rewriteImagesToCloudinaryFetch(html: string): string {
  return rewriteImages(html);
}
