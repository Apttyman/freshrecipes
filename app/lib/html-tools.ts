// app/lib/html-tools.ts

/** Keep the same slug logic everywhere (generate + save + viewer). */
export function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** If the HTML has no <img>, inject a neutral hero so layout isn’t broken. */
export function ensureAtLeastOneImage(html: string): string {
  if (/<img\b/i.test(html)) return html;
  const hero =
    `<img src="https://picsum.photos/1200/630" alt="" ` +
    `style="width:100%;height:auto;border-radius:12px;display:block;margin:16px 0" />`;

  if (/(<h1[^>]*>[\s\S]*?<\/h1>)/i.test(html)) {
    return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hero}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${hero}`);
  }
  return `${hero}\n${html}`;
}

/** Add page/meta no-referrer + apply per-img attributes. */
export function addNoReferrer(html: string): string {
  let out = html || "";

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

  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });

  return out;
}

/** Rewrite all absolute <img src> to Cloudinary fetch URLs (no secret needed). */
export function rewriteImagesWithCloudinary(html: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
  if (!cloud) return html;

  return (html || "").replace(/<img\b[^>]*\bsrc=['"]([^'"]+)['"][^>]*>/gi, (tag, src) => {
    if (!/^https?:\/\//i.test(src)) return tag; // skip relative/data src
    const encoded = encodeURIComponent(src);
    const fetchUrl =
      `https://res.cloudinary.com/${cloud}/image/fetch/` +
      `f_auto,q_auto,w_1600/${encoded}`;

    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    t = t.replace(/src=['"][^'"]+['"]/, `src="${fetchUrl}"`);
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });
}

/** Strip code fences / JSON wrappers the model sometimes returns. */
export function toPureHtml(s: string): string {
  let out = (s ?? "").trim();

  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out);
      if (j && typeof j.html === "string") out = j.html;
    } catch {}
  }

  const mHtml = out.match(/^```html\s*([\s\S]*?)\s*```$/i);
  if (mHtml) return mHtml[1].trim();
  const mAny = out.match(/^```\s*([\s\S]*?)\s*```$/);
  if (mAny) return mAny[1].trim();

  return out;
}
