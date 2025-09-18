// app/lib/img-cdn.ts
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";

// Turn a remote URL into a Cloudinary “fetch” URL.
// No auth needed; Cloudinary pulls the image server-side and serves it from their CDN.
export function cldFetchUrl(remote: string) {
  if (!CLOUD) return remote; // fallback if env missing
  // Basic hygiene: only rewrite absolute http(s) images
  if (!/^https?:\/\//i.test(remote)) return remote;

  const base = `https://res.cloudinary.com/${CLOUD}/image/fetch/f_auto,q_auto`;
  // Preserve https by double-encoding dangerous chars
  return `${base}/${encodeURIComponent(remote)}`;
}

// Rewrite every <img src="..."> in a block of HTML to go through Cloudinary fetch.
export function rewriteImagesWithCloudinary(html: string) {
  if (!html) return html;
  return html.replace(/<img\b[^>]*\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/gi, (tag, _m, d1, d2, d3) => {
    const src = (d1 || d2 || d3 || "").trim();
    if (!src) return tag;
    const newSrc = cldFetchUrl(src);

    // replace only the src value inside this tag
    return tag.replace(src, newSrc);
  });
}
