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

/**
 * Convert very simple Markdown image syntax to <img>.
 * We AVOID regex literals so build systems / sanitizers can't corrupt them.
 * Pattern handled:  ![alt](https://url)
 */
function mdImageToHtml(input: string): string {
  if (!input || input.indexOf("![") === -1) return input;

  let i = 0;
  let out = "";
  const s = input;

  while (i < s.length) {
    const bang = s.indexOf("![", i);
    if (bang === -1) {
      out += s.slice(i);
      break;
    }
    // copy text before match
    out += s.slice(i, bang);

    const altEnd = s.indexOf("]", bang + 2);
    if (altEnd === -1) {
      // not a real match; bail forward
      out += s.slice(bang, bang + 2);
      i = bang + 2;
      continue;
    }

    const openParen = s.indexOf("(", altEnd + 1);
    if (openParen !== altEnd + 1) {
      // no immediate "(" -> not our pattern
      out += s.slice(bang, altEnd + 1);
      i = altEnd + 1;
      continue;
    }

    const closeParen = s.indexOf(")", openParen + 1);
    if (closeParen === -1) {
      // unterminated
      out += s.slice(bang, altEnd + 1);
      i = altEnd + 1;
      continue;
    }

    const alt = s.slice(bang + 2, altEnd);
    const url = s.slice(openParen + 1, closeParen).trim();

    // Accept only http(s) URLs
    if (!/^https?:\/\//i.test(url)) {
      out += s.slice(bang, closeParen + 1);
      i = closeParen + 1;
      continue;
    }

    const safeAlt = String(alt).replace(/"/g, "&quot;");
    out += `<img src="${url}" alt="${safeAlt}" />`;
    i = closeParen + 1;
  }

  return out;
}

export function normalizeModelHtml(raw: string): string {
  let html = raw ?? "";
  html = stripFences(html);
  html = mdImageToHtml(html);
  return html;
}

/**
 * Client-side image cleanup:
 * - removes non-http(s) src (e.g., data:)
 * - adds a default class for layout
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
