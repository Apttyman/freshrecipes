// app/lib/html-tools.ts
// Clean helpers: no referrerpolicy/crossorigin injection anywhere.

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

/** Re-host all absolute <img src> via Cloudinary fetch. No referrer/cors attrs added. */
export function rewriteImagesWithCloudinary(html: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
  if (!cloud) return html;

  return (html || "").replace(
    /<img\b([^>]*?)\bsrc=['"]([^'"]+)['"]([^>]*)>/gi,
    (_tag, preAttrs: string, src: string, postAttrs: string) => {
      if (!/^https?:\/\//i.test(src)) {
        // leave data:, blob:, relative src untouched
        return `<img${preAttrs}src="${src}"${postAttrs}>`;
      }
      const encoded = encodeURIComponent(src);
      const fetchUrl =
        `https://res.cloudinary.com/${cloud}/image/fetch/` +
        `f_auto,q_auto,w_1600/${encoded}`;

      // Keep all original attributes, just swap src
      return `<img${preAttrs}src="${fetchUrl}"${postAttrs}>`;
    }
  );
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
