/**
 * html-tools
 * ----------
 * Pure presentation helpers used both on client and server.
 * - normalizeModelHtml: strip ``` fences, convert basic Markdown images to <img>.
 * - rewriteImages: client-side, cleans <img> tags and adds styling classes.
 * - rewriteImagesToCloudinaryFetch: server-side, optional fetch wrapper (no-op if unavailable).
 */

function stripFences(s: string): string {
  // Remove leading/trailing ``` or ```html style fences
  const fence = /^\s*```(?:html)?\s*([\s\S]*?)\s*```\s*$/i;
  const m = s.match(fence);
  return m ? m[1] : s;
}

function mdImageToHtml(s: string): string {
  // Convert simple Markdown images ![alt](url) to <img ...>
  // Avoid touching images already in <img ...> form.
  return s.replace(
    /!$begin:math:display$([^$end:math:display$]*?)\]$begin:math:text$(https?:\\/\\/[^\\s)]+)$end:math:text$/g,
    (_full, alt, url) =>
      `<img src="${url}" alt="${alt?.toString().replace(/"/g, "&quot;")}" />`
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
 * - removes data: URIs (Next/Image disallows, and they often break)
 * - ensures http/https only
 * - adds a pleasant default class for layout
 */
export function rewriteImages(html: string): string {
  const normalized = normalizeModelHtml(html);
  try {
    const doc = new DOMParser().parseFromString(normalized, "text/html");
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      // Drop invalid/data images
      if (!/^https?:\/\//i.test(src)) {
        img.removeAttribute("src");
      }
      // Add presentational class so our CSS styles them nicely
      img.classList.add("recipe-cover");
      // Provide safe alt if missing
      if (!img.hasAttribute("alt")) img.setAttribute("alt", "Recipe image");
      // Remove width/height attributes that could distort aspect ratio
      img.removeAttribute("width");
      img.removeAttribute("height");
    });
    return doc.body.innerHTML;
  } catch {
    return normalized;
  }
}

/**
 * Server-side optional wrapper: if you want all <img src> to go through a fetch proxy/CDN,
 * map them here. For now we keep a conservative no-op that only strips data:.
 * If you later add a real proxy, just swap `wrap` implementation.
 */
export function rewriteImagesToCloudinaryFetch(html: string): string {
  const normalized = normalizeModelHtml(html);
  const wrap = (u: string) => u; // no-op CDN wrapper by default
  return normalized.replace(
    /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/gi,
    (full, pre, src, post) => {
      if (!/^https?:\/\//i.test(src)) {
        // drop invalid/data srcs
        return `<img${pre} ${post}>`;
      }
      return `<img${pre} src="${wrap(src)}"${post}>`;
    }
  );
}
