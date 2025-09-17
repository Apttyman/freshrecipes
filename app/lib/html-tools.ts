// app/lib/html-tools.ts

/** Strip fences / JSON wrappers the model sometimes returns */
export function toPureHtml(s: string): string {
  let out = (s ?? "").trim();
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {/* ignore */}
  }
  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();
  return out;
}

/** Ensure at least one <img> so the page never looks empty */
export function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;
  const hero =
    `<img src="https://picsum.photos/1200/630" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" />`;
  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  return `${hero}\n${html}`;
}

/** Add meta + per-image no-referrer attributes */
export function addNoReferrer(html: string): string {
  let out = html || "";
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag.replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
               .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });
  return out;
}

/** Pull every absolute http(s) src from <img> tags */
export function extractImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  html.replace(/<img\b[^>]*\ssrc\s*=\s*("(.*?)"|'(.*?)'|([^'">\s]+))/gi, (_m, _g, d1, d2, d3) => {
    const u = (d1 || d2 || d3 || "").trim();
    if (/^https?:\/\//i.test(u)) srcs.push(u);
    return _m;
  });
  return Array.from(new Set(srcs));
}

/** Build a Cloudinary “fetch” URL (no SDK needed) */
export function cloudinaryFetchUrl(original: string, cloud: string, folder = "freshrecipes"): string {
  const base = `https://res.cloudinary.com/${cloud}/image/fetch/f_auto,q_auto/${encodeURIComponent(original)}`;
  return folder ? `${base}` : base;
}

/** Rewrite all <img src> to Cloudinary fetch URLs (if cloud name present) */
export function rewriteImagesToCloudinary(html: string, cloud?: string): string {
  if (!cloud) return html;
  const urls = extractImageSrcs(html);
  let out = html;
  for (const u of urls) {
    const fetched = cloudinaryFetchUrl(u, cloud);
    const re = new RegExp(
      `(src\\s*=\\s*)(["'])${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\2`,
      "gi"
    );
    out = out.replace(re, (_m, p1, q) => `${p1}${q}${fetched}${q}`);
  }
  return out;
}
