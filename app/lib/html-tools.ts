// app/lib/html-tools.ts

/** Remove triple-backtick fences and normalize newlines. */
export function normalizeBlocks(raw: string): string {
  let s = raw;

  // Strip ```...``` fences but keep inner content
  s = s.replace(/```[a-zA-Z0-9-]*\s*([\s\S]*?)\s*```/g, (_m, inner) => String(inner));

  // Normalize line breaks and collapse excessive blank lines
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');

  return s;
}

/** Convert simple Markdown images  ![alt](url)  to <img ...>. */
export function coerceMarkdownImages(s: string): string {
  return s.replace(
    /!\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (_full, alt, url) => `<img src="${url}" alt="${String(alt).replace(/"/g, '&quot;')}" />`
  );
}

/** Prepare LLM HTML/markdown-ish output for display. */
export function formatForDisplay(raw: string): string {
  let html = normalizeBlocks(raw);

  // Allow simple images
  html = coerceMarkdownImages(html);

  // Remove stray ```html fences that might still be present
  html = html.replace(/^`{3,}\s*html?\s*/i, '').replace(/`{3,}\s*$/i, '');

  // Convert lone newlines inside paragraphs to <br>, but keep paragraph breaks
  html = html
    .split(/\n{2,}/)
    .map((chunk) =>
      /<\/?[a-z][\s\S]*>/i.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br/>')}</p>`
    )
    .join('\n');

  return html.trim();
}
