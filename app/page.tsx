'use client';

import { useState } from 'react';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);

  async function onGenerate() {
    setError(null);
    setBusy(true);
    setCanSave(false);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ query }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setError(data?.error || `Request failed (${res.status}). Try again.`);
        return;
      }

      const html = (data?.html ?? '').toString();

      if (!html || !html.includes('<!DOCTYPE html') || !html.includes('</html>')) {
        setError('Model did not return a complete HTML document. Check your model/keys.');
        return;
      }

      setCanSave(true);
    } catch {
      setError('Request failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="title-row">
          <div className="title">
            <span className="dot" aria-hidden />
            <span>FreshRecipes</span>
          </div>
          <div style={{ width: 112, height: 40 }} />
        </div>

        <div className="stack">
          <label className="textarea-wrap" htmlFor="query">
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what to fetch (e.g., ‘3 Michelin chef pasta recipes with step photos’)"
            />
          </label>

          <button className="btn btn-primary" onClick={onGenerate} disabled={busy}>
            {busy ? 'Working…' : 'Generate'}
          </button>

          {/* Greyed Save button (disabled until valid HTML) */}
          <button className="btn btn-ghost" disabled={!canSave}>
            Save
          </button>

          {/* Open Archive button inside card */}
          <a className="btn-link" href="/archive">Open Archive</a>
        </div>
      </div>

      {error && (
        <div className="error">
          <b>Error:</b> {error}
        </div>
      )}
    </>
  );
}
