// app/lib/html-tools.ts
// Display-only helpers: clean LLM output and make it presentable HTML
// No business logic, no prompt changes.

function stripCodeFences(s: string): string {
  // Remove ```lang ... ``` fences and lone backticks
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "")) // keep inner text, drop fences
    .replace(/`{1,3}/g, ""); // drop stray ticks that leak through
}

function decodeEscapedNewlines(s: string): string {
  // Turn "\r\n" or "\n" escape sequences into real newlines
  return s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function markdownImagesToImgTags(s: string): string {
  // Convert simple markdown images  ![alt](url)  to <img ...>
  // Keep it simple; do not transform existing <img> tags.
  return s.replace(
    /!$begin:math:display$([^$end:math:display$]*?)\]$begin:math:text$(https?:\\/\\/[^\\s)]+)$end:math:text$/g,
    (_full, alt, url) => `<img src="${url}" alt="${String(alt).replace(/"/g, "&quot;")}" />`
  );
}

function escapeDangerousTags(s: string): string {
  // Very light safety: strip <script> blocks if they leak in.
  return s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function paragraphize(s: string): string {
  // Normalize newlines
  const normalized = s.replace(/\r\n/g, "\n");

  // Split by blank lines to paragraphs; inside a paragraph, single newlines become <br>
  const parts = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`);

  return parts.join("\n");
}

/**
 * formatForDisplay
 * Cleans raw LLM/plain text and returns HTML meant for `dangerouslySetInnerHTML`.
 * Purely visual: does not change semantics.
 */
export function formatForDisplay(raw: string): string {
  let s = String(raw ?? "");
  s = stripCodeFences(s);
  s = decodeEscapedNewlines(s);
  s = markdownImagesToImgTags(s);
  s = escapeDangerousTags(s);
  s = paragraphize(s);
  return s;
}
