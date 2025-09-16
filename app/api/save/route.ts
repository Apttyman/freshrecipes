// app/api/save/route.ts
import { NextRequest } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

function reqBad(msg: string, code = 400) {
  return new Response(msg, { status: code });
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "recipe";
}

type Step = { text: string; image?: string; source?: string };
type ImageItem = { url: string; alt: string; source: string };
type Recipe = {
  id: string;
  name: string;
  chef: string;
  description: string[];
  ingredients: string[];
  steps: Step[];
  sourceUrl: string;
  images: ImageItem[];
};

function renderHtml({ title, instruction, recipes }: { title: string; instruction?: string; recipes: Recipe[] }) {
  // Minimal, mobile-first, Food52-inspired HTML snapshot.
  // NOTE: we assume images already proxied to /api/img?u=... by /api/generate verification layer.
  const head = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  :root{
    --bg:#faf8f5; --ink:#1a1a1a; --muted:#6b7280; --card:#ffffff;
    --accent:#c76d4e; --accent-2:#5c7c6d; --divider:#e5e7eb;
  }
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,"Helvetica Neue",Arial}
  .wrap{max-width:1100px;margin:0 auto;padding:24px}
  header{display:flex;gap:16px;justify-content:space-between;align-items:center;margin-bottom:24px}
  h1{font-size:28px;line-height:1.1;margin:0;font-family:ui-serif,Georgia,"Times New Roman",serif}
  .hint{color:var(--muted);font-size:13px}
  .cards{display:grid;grid-template-columns:1fr;gap:20px}
  @media(min-width:900px){.cards{grid-template-columns:1fr 1fr}}
  .card{background:var(--card);border:1px solid var(--divider);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.06);overflow:hidden}
  .inner{padding:20px}
  .title{font-family:ui-serif,Georgia,"Times New Roman",serif;font-size:22px;margin:0 0 6px}
  .chef{color:var(--muted);font-style:italic;margin:0 0 12px}
  .hero{width:100%;height:280px;object-fit:cover;display:block;background:#eee}
  .desc p{margin:0 0 10px}
  .section{margin-top:16px;padding-top:16px;border-top:1px solid var(--divider)}
  .section h3{margin:0 0 10px;font-size:15px;letter-spacing:.2px}
  ul,ol{margin:0;padding-left:18px}
  li{margin:6px 0}
  .step-img{width:100%;height:200px;object-fit:cover;border-radius:10px;margin-top:8px;display:block;background:#eee}
  .source{margin-top:8px;font-size:13px}
  .source a{color:var(--accent-2);text-decoration:none}
  .meta{display:flex;gap:8px;align-items:center}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:12px}
  footer{margin-top:36px;padding-top:16px;border-top:1px solid var(--divider);color:var(--muted);font-size:13px}
  a.title-link{color:inherit;text-decoration:none}
  .img-link{display:block}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div>
    <h1>${title}</h1>
    ${instruction ? `<div class="hint">Requested: ${instruction}</div>` : ""}
  </div>
  <div class="meta">
    <span class="badge">Saved snapshot</span>
  </div>
</header>
<section class="cards">
`;

  const cardHtml = recipes
    .map((r) => {
      const hero = r.images?.[0];
      const heroBlock = hero
        ? `<a class="img-link" href="${hero.source}" target="_blank" rel="noopener">
             <img class="hero" src="${hero.url}" alt="${hero.alt || r.name}"/>
           </a>`
        : "";

      const desc = (r.description || []).map((p) => `<p>${p}</p>`).join("");

      const ings = (r.ingredients || []).map((i) => `<li>${i}</li>`).join("");

      const steps = (r.steps || [])
        .map((s, idx) => {
          const img = s.image
            ? `<a href="${s.source || r.sourceUrl}" target="_blank" rel="noopener">
                 <img class="step-img" src="${s.image}" alt="Step ${idx + 1} image"/>
               </a>`
            : "";
          return `<li><p>${s.text}</p>${img}</li>`;
        })
        .join("");

      return `
<article class="card">
  ${heroBlock}
  <div class="inner">
    <h2 class="title"><a class="title-link" href="${r.sourceUrl}" target="_blank" rel="noopener">${r.name}</a></h2>
    <p class="chef">By ${r.chef}</p>
    <div class="desc">${desc}</div>

    <div class="section">
      <h3>Ingredients</h3>
      <ul>${ings}</ul>
    </div>

    <div class="section">
      <h3>Steps</h3>
      <ol>${steps}</ol>
    </div>

    <div class="source">Source: <a href="${r.sourceUrl}" target="_blank" rel="noopener">${r.sourceUrl}</a></div>
  </div>
</article>
`;
    })
    .join("\n");

  const foot = `
</section>
<footer>© FreshRecipes snapshot — images hot-linked from their original sources.</footer>
</div>
</body>
</html>`;

  return head + cardHtml + foot;
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return reqBad("BLOB_READ_WRITE_TOKEN missing in env", 500);

    const data = await req.json();
    const { title: rawTitle, html: htmlInput, recipes, instruction } = data || {};

    if (!htmlInput && !Array.isArray(recipes)) {
      return reqBad("Provide either 'html' (string) or 'recipes' (array).");
    }

    const title =
      rawTitle ||
      (Array.isArray(recipes) && recipes[0]?.name) ||
      "FreshRecipes";

    const html: string =
      typeof htmlInput === "string" && htmlInput.trim().length > 0
        ? htmlInput
        : renderHtml({ title, instruction, recipes: recipes as Recipe[] });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const base =
      (Array.isArray(recipes) && recipes[0]?.name) ||
      (typeof rawTitle === "string" && rawTitle) ||
      "recipe";
    const key = `recipes/${ts}-${slugify(base)}.html`;

    const { url } = await put(key, html, {
      access: "public",
      token,
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365, // 1y
    });

    return new Response(JSON.stringify({ ok: true, key, url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const msg = err?.message || "Save error";
    console.error("SAVE_ROUTE_ERROR:", msg);
    return new Response(msg, { status: err?.status || 500 });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "/api/save" }), {
    headers: { "Content-Type": "application/json" },
  });
}
