// app/lib/html-tools.ts

/** Remove triple-backtick fences and normalize newlines -> <br> where appropriate. */
export function normalizeBlocks(raw: string): string {
  let s = raw;

  // Remove ```language fences but keep inner content
  s = s.replace(/```[a-zA-Z0-9-]*\s*([\s\S]*?)\s*```/g, (_m, inner) => String(inner));

  // Collapse excessive \n but keep paragraph breaks
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');

  return s;
}

/** Convert simple Markdown images  ![alt](url)  to <img ...>. */
export function coerceMarkdownImages(s: string): string {
  // NOTE: This is the ONLY regex you need. Keep it standard JS regex; no odd $begin:... tokens.
  return s.replace(
    /!$begin:math:display$([^$end:math:display$]*?)\]$begin:math:text$(https?:\\/\\/[^\\s)]+)$end:math:text$/g,
    (_full, alt, url) => `<img src="${url}" alt="${String(alt).replace(/"/g, '&quot;')}" />`
  );
}

/** Light wrapper to prepare LLM HTML/markdown-ish output for display. */
export function formatForDisplay(raw: string): string {
  let html = normalizeBlocks(raw);

  // If the model returned markdown-ish text, allow simple images:
  html = coerceMarkdownImages(html);

  // Strip leading/trailing code fences that sometimes sneak through
  html = html.replace(/^`{3,}\s*html?\s*/i, '').replace(/`{3,}\s*$/i, '');

  // Replace lone newlines inside paragraphs with <br> (but preserve double-newline as <p>)
  html = html
    .split(/\n{2,}/)
    .map((chunk) =>
      /<\/?[a-z][\s\S]*>/i.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br/>')}</p>`
    )
    .join('\n');

  return html.trim();
}
