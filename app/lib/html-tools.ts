// app/lib/html-tools.ts

/** Strip code fences and normalize text */
export function normalizeBlocks(raw: string): string {
  let s = String(raw);

  // 1) Remove ```lang ... ``` fences but keep inner content
  s = s.replace(/```[a-z0-9-]*\s*([\s\S]*?)\s*```/gi, (_m, inner) => String(inner));

  // 2) Turn escaped newlines into real newlines
  s = s.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // 3) Collapse big gaps
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

/** Convert simple Markdown images ![alt](url) → <img> */
export function coerceMarkdownImages(s: string): string {
  return s.replace(
    /!\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (_full, alt, url) => `<img src="${url}" alt="${String(alt).replace(/"/g, '&quot;')}" />`
  );
}

/** Format LLM output into safe-ish HTML for display */
export function formatForDisplay(raw: string): string {
  let html = normalizeBlocks(raw);
  html = coerceMarkdownImages(html);

  // Paragraphize: split on blank lines; within a paragraph, single \n → <br>
  html = html
    .split(/\n{2,}/)
    .map(chunk => /<\/?[a-z][\s\S]*>/i.test(chunk)
      ? chunk
      : `<p>${chunk.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  return html;
}
