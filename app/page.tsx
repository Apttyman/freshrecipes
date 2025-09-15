"use client";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [instruction, setInstruction] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Blob URL for preview / download
  const blobUrl = useMemo(() => {
    if (!html) return "";
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }, [html]);

  // Cmd/Ctrl + Enter to submit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        void handleGenerate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [instruction]);

  async function handleGenerate() {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setErr(null);
    setHtml("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      if (!text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("The model returned something other than a full HTML file.");
      }
      setHtml(text);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `recipes_${new Date().toISOString().replace(/[:.]/g, "-")}.html`;
    a.click();
  }

  return (
    <main className="page">
      <div className="halo" aria-hidden />
      <header className="head">
        <div className="brand">
          <span className="dot" aria-hidden />
          <h1>Fresh <span className="accent">Recipes</span></h1>
        </div>
        <p className="tag">Generate designer-grade recipe pages from a single instruction.</p>
      </header>

      <section className="card" role="region" aria-label="Recipe instruction">
        <label htmlFor="instr" className="label">Your instruction</label>
        <textarea
          id="instr"
          className="input"
          placeholder={`e.g., Fetch 5 of the top pasta recipes from famous chefs...
Include full descriptions, ingredients, numbered steps, real images linked to sources.
Output a Food52-style, responsive, accessible HTML document.`}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          spellCheck={false}
        />

        <div className="actions">
          <button
            className="btn primary"
            onClick={handleGenerate}
            disabled={!instruction.trim() || loading}
            aria-busy={loading}
          >
            {loading ? (
              <span className="spinner" aria-hidden />
            ) : (
              <span className="kbd" aria-hidden>⌘</span>
            )}
            <span>{loading ? "Generating…" : "Generate (⌘/Ctrl + Enter)"}</span>
          </button>

          <button className="btn" onClick={download} disabled={!blobUrl}>
            Download .html
          </button>

          <a
            className={`btn link ${!blobUrl ? "disabled" : ""}`}
            href={blobUrl || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!blobUrl}
          >
            Preview
          </a>
        </div>

        <div className="status" aria-live="polite">
          {err && <p className="error">❌ {err}</p>}
          {!err && html && <p className="ok">✅ Ready — open Preview or Download.</p>}
        </div>
      </section>

      {html && (
        <section className="preview" role="region" aria-label="Live preview">
          <h2>Live Preview</h2>
          <iframe title="Generated HTML Preview" src={blobUrl} />
        </section>
      )}

      <footer className="foot">
        <p>
          Tip: Keep instructions specific. You can request layout rules, color palettes, and sourcing requirements.
        </p>
      </footer>

      <style jsx>{`
        /* ====== Design Tokens ====== */
        :root{
          --bg:#0b0d10;
          --bg2:#12151a;
          --fg:#e9eef5;
          --sub:#aab5c3;
          --line:rgba(255,255,255,.08);
          --accent:#65d6a6;
          --accent-2:#7fb7ff;
          --danger:#ff7a7a;
          --shadow:0 10px 40px rgba(0,0,0,.45);
          --radius:14px;
        }
        @media (prefers-color-scheme: light){
          :root{
            --bg:#f6f7fb;
            --bg2:#ffffff;
            --fg:#0f1320;
            --sub:#4c566a;
            --line:rgba(5,10,20,.08);
            --accent:#1a9f6e;
            --accent-2:#246bff;
            --shadow:0 12px 40px rgba(22,28,45,.08);
          }
        }

        /* ====== Layout ====== */
        .page{
          min-height:100svh;
          background:
            radial-gradient(1200px 800px at 20% -10%, rgba(127,183,255,.20), transparent 60%),
            radial-gradient(900px 600px at 110% 10%, rgba(101,214,166,.18), transparent 55%),
            var(--bg);
          color:var(--fg);
          padding: clamp(16px, 3vw, 28px);
        }
        .halo{
          position:fixed; inset:0;
          background: radial-gradient(700px 300px at 50% -80px, rgba(255,255,255,.08), transparent 60%);
          pointer-events:none;
        }

        .head{max-width:960px; margin:0 auto 18px;}
        .brand{display:flex; align-items:center; gap:12px;}
        .brand h1{font-weight:800; letter-spacing:.3px; font-size:clamp(28px, 4.2vw, 44px); margin:0;}
        .accent{color:var(--accent);}
        .dot{width:14px; height:14px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent-2)); box-shadow:0 0 0 6px rgba(127,183,255,.12), 0 0 32px rgba(101,214,166,.45);}
        .tag{margin:.25rem 0 0; color:var(--sub); font-size:clamp(14px,1.6vw,16px)}

        .card{
          max-width:960px; margin:18px auto 12px; padding:18px;
          background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
          border:1px solid var(--line);
          backdrop-filter: blur(10px);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
        }

        .label{display:block; font-weight:600; margin:4px 0 8px; color:var(--sub)}
        .input{
          width:100%; min-height:150px; resize:vertical;
          padding:14px 16px; line-height:1.5;
          background:var(--bg2); color:var(--fg);
          border:1px solid var(--line); border-radius:12px;
          outline:none; transition: border .2s, box-shadow .2s;
        }
        .input:focus{ border-color: color-mix(in oklab, var(--accent) 50%, transparent); box-shadow:0 0 0 4px color-mix(in oklab, var(--accent) 20%, transparent); }

        .actions{display:flex; flex-wrap:wrap; gap:10px; margin-top:12px}
        .btn{
          appearance:none; border:1px solid var(--line); background:var(--bg2); color:var(--fg);
          padding:10px 14px; border-radius:12px; font-weight:600; cursor:pointer;
          transition: transform .06s ease, background .2s, border-color .2s, box-shadow .2s;
        }
        .btn:hover{ transform: translateY(-1px); }
        .btn:focus-visible{ outline:none; box-shadow:0 0 0 4px color-mix(in oklab, var(--accent) 25%, transparent); }
        .btn[disabled], .link.disabled{ opacity:.55; cursor:not-allowed; transform:none; }
        .btn.primary{
          background:linear-gradient(135deg, color-mix(in oklab, var(--accent) 88%, #fff 0%), color-mix(in oklab, var(--accent-2) 80%, #fff 0%));
          border-color:transparent; color:#041214;
        }
        .link{ text-decoration:none; display:inline-flex; align-items:center; }
        .kbd{font-size:12px; margin-right:6px; background:rgba(0,0,0,.15); padding:.25rem .45rem; border-radius:6px;}
        @media (prefers-color-scheme: light){ .kbd{ background:rgba(0,0,0,.06); } }

        .spinner{
          width:16px; height:16px; margin-right:8px; border-radius:50%;
          border:2px solid rgba(255,255,255,.8);
          border-top-color: rgba(255,255,255,.2);
          animation: spin .85s linear infinite;
        }
        @keyframes spin{to{transform: rotate(360deg)}}

        .status{min-height:24px; margin-top:10px}
        .error{color:var(--danger); font-weight:600}
        .ok{color:var(--accent);}

        .preview{max-width:960px; margin:18px auto 0;}
        .preview h2{font-size:18px; margin:0 0 10px; color:var(--sub); font-weight:700; letter-spacing:.2px;}
        iframe{
          width:100%; height:560px; background:#fff;
          border:1px solid var(--line); border-radius:12px; overflow:hidden;
          box-shadow: var(--shadow);
        }

        .foot{max-width:960px; margin:24px auto 0; color:var(--sub); font-size:14px}
      `}</style>
    </main>
  );
}
