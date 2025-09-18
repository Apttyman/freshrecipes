// app/lib/html-tools.ts

/** Add meta + per-img attributes so the browser never forwards a referrer. */
export function addNoReferrer(html: string): string {
  let out = html || "";

  // <meta name="referrer" content="no-referrer">
  const meta = `<meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    if (!/name=["']referrer["']/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${meta}`);
    }
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${meta}\n</head>`);
  } else {
    out = `<head>\n${meta}\n</head>\n` + out;
  }

  // Per <img> attributes
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

    // Always enforce https and add attributes
    t = t.replace(/src\s*=\s*(['"])(http:)?\/\//i, (_m, q) => `src=${q}https://`);
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });

  return out;
}

/** If there are *no* <img>, inject a neutral hero so the page never looks empty. */
export function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;

  const hero =
    `<img src="https://picsum.photos/1200/630" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" />`;

  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  return `${hero}\n${html}`;
}

/**
 * Rewrite every <img src> to Cloudinary "fetch" delivery so hostile hosts can't block us.
 * If the Cloudinary cloud name is missing, we keep the original src (but mark it for debugging).
 */
export function rewriteImagesWithCloudinary(html: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
  const base = cloud
    ? `https://res.cloudinary.com/${cloud}/image/fetch/f_auto,q_auto`
    : "";

  return html.replace(/<img\b[^>]*\bsrc\s*=\s*(['"])(.+?)\1[^>]*>/gi, (tag, q, src) => {
    // Ignore data: and blob: and empty src
    if (!src || /^data:|^blob:/i.test(src)) return tag;

    // Force https for mixed content
    let abs = src.replace(/^http:\/\//i, "https://");

    // Only rewrite http(s)
    if (!/^https?:\/\//i.test(abs)) return tag;

    if (!base) {
      // Cloudinary not configured -> annotate so we can see it in-page
      return tag.replace(/\/?>$/, (m: string) => ` data-cld="missing-cloud-name"${m}`);
    }

    const fetched = `${base}/${encodeURIComponent(abs)}`;
    // Swap the src while keeping other attributes
    return tag.replace(new RegExp(`\\bsrc\\s*=\\s*${q}[^${q}]*${q}`), `src=${q}${fetched}${q}`);
  });
}
