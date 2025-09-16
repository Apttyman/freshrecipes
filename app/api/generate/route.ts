// app/api/generate/route.ts  (only the relevant parts shown)
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { fetchRealImagesFromSource, serpImageFallback, headIsImage } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function replaceImgSrcWithProxy(html: string): string {
  // wrap any <img src="..."> with proxy, preserve alt
  return html.replace(
    /<img([^>]+?)src=["']([^"']+)["']([^>]*)>/gi,
    (_m, pre, src, post) => {
      // already proxied?
      if (src.startsWith("/api/img?url=")) return _m;
      const proxied = `/api/img?url=${encodeURIComponent(src)}`;
      return `<img${pre}src="${proxied}"${post}>`;
    }
  );
}

function ensureAnchoredImages(html: string): string {
  // if an <img> is not inside an <a>, wrap it with a link to its own src (proxy keeps original off-page)
  return html.replace(
    /(<img[^>]+src=["']([^"']+)["'][^>]*>)/gi,
    (m, tag, src) => `<a href="${src}" target="_blank" rel="noopener noreferrer">${tag}</a>`
  );
}

async function hardenImages(html: string, sourceUrlHints: string[]): Promise<string> {
  let out = html;

  // 1) If the model included known placeholders (e.g., /placeholder.jpg), strip them
  out = out.replace(/https?:\/\/[^"']*(placeholder|dummy)[^"']*/gi, "");

  // 2) If HTML has <img> tags, validate each one; drop broken ones
  out = await (async () => {
    const imgs = Array.from(out.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi));
    const tasks = imgs.map(async (m) => {
      const full = m[0];
      const src = m[1];
      const ok = await headIsImage(src);
      return { full, ok };
    });
    const results = await Promise.all(tasks);
    let tmp = out;
    for (const r of results) {
      if (!r.ok) {
        // remove broken <img> entirely
        tmp = tmp.replace(r.full, "");
      }
    }
    return tmp;
  })();

  // 3) If we have *no* images left, try to fetch from the recipe pages the model referenced
  let remaining = (out.match(/<img[^>]+src=["'][^"']+["'][^>]*>/gi) || []).length;
  if (remaining === 0) {
    for (const hint of sourceUrlHints) {
      const imgs = await fetchRealImagesFromSource(hint, 8);
      if (imgs.length) {
        // Inject a hero image at top of body
        const hero = imgs[0].url;
        const tag = `<figure class="hero"><img src="${hero}" alt="Recipe image"></figure>`;
        out = out.replace(/<body[^>]*>/i, (m) => `${m}\n${tag}\n`);
        remaining++;
        break;
      }
    }
  }

  // 4) Optional final fallback via SerpAPI if still nothing
  if (remaining === 0) {
    const fallback = await serpImageFallback("site:food52.com recipe OR site:bonappetit.com recipe");
    if (fallback.length) {
      const tag = `<figure class="hero"><img src="${fallback[0].url}" alt="Recipe image (fallback)"></figure>`;
      out = out.replace(/<body[^>]*>/i, (m) => `${m}\n${tag}\n`);
    }
  }

  // 5) Proxy all images, and anchor them for credits
  out = replaceImgSrcWithProxy(out);
  out = ensureAnchoredImages(out);

  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();
    if (!instruction || typeof instruction !== "string") {
      return new Response("Missing 'instruction'", { status: 400 });
    }

    const rsp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      max_tokens: 7000,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `
You produce one complete HTML5 document. You MUST include real recipe/source links and prefer images that are present on the referenced pages. Do not fabricate URLs. If you aren't sure an image exists, omit it and rely on the server to add verified images from the source page. Title and images must link to sources.`,
        },
        { role: "user", content: instruction },
      ],
    });

    let html = rsp.choices?.[0]?.message?.content || "";
    if (!/^<!DOCTYPE html>/i.test(html.trim())) {
      return new Response("Model did not return full HTML.", { status: 502 });
    }

    // gather hint URLs (links the model included for each recipe title/image)
    const linkHints = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi))
      .map((m) => m[1])
      .filter((u) => /^https?:\/\//i.test(u));

    // sanitize & guarantee real images
    html = await hardenImages(html, linkHints);

    // save to blob (public)
    const slug = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `recipes/${slug}.html`;
    const { url: blobUrl } = await put(filename, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
    });

    const json = {
      ok: true,
      previewHtml: html,
      blobUrl,
      pageUrl: blobUrl,
      filename,
    };

    return new Response(JSON.stringify(json), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
