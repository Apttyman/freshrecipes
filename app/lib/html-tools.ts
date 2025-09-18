// app/lib/html-tools.ts

/** Add a meta referrer and per-IMG attributes to suppress referrer leakage. */
export function addNoReferrer(html: string): string {
  let out = html || "";

  // head meta
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

  // per-image attributes
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag
      .replace(/\sreferrerpolicy\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return t.replace(/\/?>$/, (m) => ` referrerpolicy="no-referrer" crossorigin="anonymous"${m}`);
  });

  return out;
}

/** Ensure at least one image exists to keep the layout from looking empty. */
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

/** Escape for inclusion in an HTML attribute value. */
function escAttr(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Re-host every http(s) <img src="..."> through Cloudinary "fetch".
 * - Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME to be set.
 * - Adds onerror fallback so you see *something* even if fetch is blocked.
 * - Appends an HTML comment with a count so you can confirm it worked on mobile.
 */
export function rewriteImagesWithCloudinary(html: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloud) {
    return html + `\n<!-- cloudinary-rehosted: 0 (missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) -->\n`;
  }

  const base = `https://res.cloudinary.com/${cloud}/image/fetch/f_auto,q_auto`;
  const fallback = `${base}/${encodeURIComponent("https://picsum.photos/1200/630")}`;

  let count = 0;

  const out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    // find src (double, single, or unquoted)
    const m = tag.match(/\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    let src = (m?.[1] || m?.[2] || m?.[3] || "").trim();
    if (!/^https?:\/\//i.test(src)) return tag; // skip data:, relative, etc.

    // decode &amp; to real &
    src = src.replace(/&amp;/g, "&");

    // cloudinary fetch url
    const proxied = `${base}/${encodeURIComponent(src)}`;
    count++;

    // rebuild tag with new src + attrs
    let t = tag
      .replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "") // strip old src
      .replace(/\sreferrerpolicy\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\scrossorigin\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

    t = t.replace(/\/?>$/, (m) =>
      ` src="${proxied}" data-origin="${escAttr(src)}" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.onerror=null;this.src='${fallback}'"${m}`
    );

    return t;
  });

  // leave an obvious audit trail (visible in page source / preview text area)
  let annotated = out;
  annotated = annotated.replace(/<head[^>]*>/i, (m) => `${m}\n<meta name="x-cloudinary-cloud" content="${escAttr(cloud)}">`);
  annotated += `\n<!-- cloudinary-rehosted: ${count} via ${base} -->\n`;

  return annotated;
}
