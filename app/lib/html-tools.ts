/**
 * html-tools
 * ----------
 * Pure presentation helpers used both on client and server.
 * - normalizeModelHtml: strip ``` fences, convert basic Markdown images to <img>.
 * - rewriteImages: client-side enhancements for <img>.
 * - rewriteImagesToCloudinaryFetch: server-side pass-through (no-op CDN wrapper by default).
 */

function stripFences(s: string): string {
  // Remove leading/trailing ``` or ```html style fences
  const m = s.match(/^\s*```(?:html)?\s*([\s\S]*?)\s*```\s*$/i);
  return m ? m[1] : s;
}

function mdImageToHtml(s: string): string {
  // Convert simple Markdown images  ![alt](url)  to <img ...>
  // Keep it simple; do not transform existing <img> tags.
  return s.replace(
    /!$begin:math:display$([^$end:math:display$]*?)\]$begin:math:text$(https?:\\/\\/[^\\s)]+)$end:math:text$/g,
    (_full, alt, url) =>
      `<img src="${url}" alt="${String(alt).replace(/"/g, "&quot;")}" />`
  );
}

export function normalizeModelHtml(raw: string): string {
  let html = raw ?? "";
  html = stripFences(html);
  html = mdImageToHtml(html);
  return html;
}

/**
 * Client-side image cleanup. Keeps it simple:
 * - removes non-http(s) src (e.g., data:)
 * - adds a pleasant default class for layout
 * - ensures an alt attribute exists
 */
export function rewriteImages(html: string): string {
  const normalized = normalizeModelHtml(html);
  try {
    const doc = new DOMParser().parseFromString(normalized, "text/html");
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!/^https?:\/\//i.test(src)) {
        // Drop invalid/data images to avoid broken renders
        img.removeAttribute("src");
      }
      img.classList.add("recipe-cover");
      if (!img.hasAttribute("alt")) img.setAttribute("alt", "Recipe image");
      img.removeAttribute("width");
      img.removeAttribute("height");
      img.removeAttribute("style");
    });
    return doc.body.innerHTML;
  } catch {
    return normalized;
  }
}

/**
 * Server-side optional wrapper: if you want all <img src> to go through a fetch proxy/CDN,
 * map them here. For now we keep a conservative no-op that only strips non-http(s) sources.
 */
export function rewriteImagesToCloudinaryFetch(html: string): string {
  const normalized = normalizeModelHtml(html);
  const wrap = (u: string) => u; // no-op CDN wrapper by default
  return normalized.replace(
    /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi,
    (_full, pre, quote, src, post) => {
      if (!/^https?:\/\//i.test(src)) {
        // remove src if it isn't http(s)
        return `<img${pre}${post}>`;
      }
      return `<img${pre} src=${quote}${wrap(src)}${quote}${post}>`;
    }
  );
}
