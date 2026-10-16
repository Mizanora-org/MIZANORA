'use client';
import { useCallback, useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { authClient, dbClient } from '@/lib/firebase-client';
import { formatDate, formatPKR } from '@/lib/format';
import { revalidateSite } from '@/lib/admin-cache';

// Admin > Archive. Old products leave Firebase and live as JSON files in your repository (data/catalog): no reads, no writes, no quota.
// New products stay in Firebase. When Firebase gets full, move the oldest ones here, wait for the deployment, then clear them from Firebase.
const download = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export default function ArchiveAdmin() {
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [count, setCount] = useState(500);
  const [last, setLast] = useState(null); // { n, count, commit?, manual? }
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);

  const api = useCallback(async (body) => {
    const r = await fetch('/api/admin/archive', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(j.error || `Error ${r.status}`); e.data = j; throw e; }
    return j;
  }, []);
  const load = useCallback(() => api({ action: 'status' }).then(setSt).catch((e) => setMsg(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => { setBusy(key); setMsg(''); try { await fn(); } catch (e) { setMsg(e.message); } setBusy(''); };

  const archive = () => run('archive', async () => {
    const j = await api({ action: 'archive', count });
    setLast({ n: j.n, count: j.count, commit: j.commit });
    setMsg(`Part ${j.n} (${j.count} products) was saved to your repository. Vercel now deploys it (1 to 3 minutes). Then press "Clear from Firebase".`);
    await load();
  });
  const exportFiles = () => run('export', async () => {
    const j = await api({ action: 'export', count: Math.min(count, 400) });
    Object.entries(j.files).forEach(([name, text], i) => setTimeout(() => download(name, text), i * 400));
    setLast({ n: j.n, count: j.count, manual: true });
    setMsg(`Downloaded 3 files for part ${j.n}. Put all 3 into the folder data/catalog of your GitHub repository (Add file > Upload files), replace manifest.json, and commit. After Vercel deployed, press "Clear from Firebase".`);
  });
  const clear = (n) => run(`clear${n}`, async () => {
    if (!window.confirm(`Delete the ${n === last?.n ? last.count : ''} products of part ${n} from Firebase? They stay in the archive file. Products you edited after archiving are kept.`)) return;
    try {
      const j = await api({ action: 'clear', n });
      await revalidateSite();
      try { sessionStorage.removeItem('mz_admin_products'); } catch (_) { /* ignore */ }
      setMsg(`Cleared: ${j.deleted} products removed from Firebase${j.kept ? `, ${j.kept} kept because they were edited after archiving` : ''}. They are served from the archive now.`);
      setLast(null); await load();
    } catch (e) { setMsg(e.message); }
  });
  const search = () => run('search', async () => {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setFound((d.items || []).filter((p) => p.part).slice(0, 30));
  });
  const edit = (p) => run(`edit${p.id}`, async () => {
    const j = await api({ action: 'get', slug: p.id });
    await setDoc(doc(dbClient(), 'products', j.id), { ...j.data, updatedAt: Date.now() });
    await revalidateSite(j.id);
    setMsg(`"${p.name}" was copied to Firebase. Open Admin > Products to edit it. The live copy now replaces the archived one.`);
  });

  const github = st && st.github;
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Product archive</h1>
        <p className="mt-1 text-sm text-dim">Keep Firebase small and fast. Old products are saved as JSON files in your repository and loaded only when needed. New products stay in Firebase. The free Firebase plan allows 50,000 reads and 20,000 writes a day, so a big catalogue should live in the archive.</p>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      {!st ? <p className="text-dim">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[['In Firebase (live)', st.live == null ? '?' : st.live.toLocaleString('en-PK')], ['In archive files', st.archived.toLocaleString('en-PK')], ['Archive parts', st.parts.length], ['GitHub', github && github.ready ? 'connected' : 'not connected']].map(([a, b]) => <div key={a} className="card !p-3"><p className="text-lg font-extrabold">{b}</p><p className="text-xs text-dim">{a}</p></div>)}
          </div>

          {!(github && github.ready) && (
            <div className="rounded-xl border border-saffron/50 bg-saffron/10 p-3 text-sm text-cream">
              <p className="font-semibold">One-click saving needs GitHub (optional)</p>
              <p className="mt-1 text-dim">In Vercel &gt; Environment Variables add <b>GITHUB_TOKEN</b> (GitHub &gt; Settings &gt; Developer settings &gt; Fine-grained tokens &gt; only this repository &gt; Contents: Read and write), <b>GITHUB_REPO</b> (for example <code>yourname/mizanora</code>) and optionally <b>GITHUB_BRANCH</b> (default main). Redeploy. Without it you can still download the files and upload them to GitHub by hand.</p>
            </div>
          )}
          {github && github.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">GitHub problem: {github.error}</p>}

          <section className="card space-y-3">
            <h2 className="text-lg font-extrabold">1. Move the oldest products to the archive</h2>
            <p className="text-xs text-dim">The oldest live products (hidden ones are skipped) become part {st.nextN}. Supplier cost and profit are never written to the files, so the repository can stay public. A file holds up to 1000 products; more files can be added any time, and each file is loaded only when needed.</p>
            <label className="flex items-center gap-2 text-sm">How many products <input type="number" min="50" max="1000" step="50" className="input !w-28 !py-1.5" value={count} onChange={(e) => setCount(Math.max(50, Math.min(1000, Number(e.target.value) || 500)))} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-gold" disabled={busy || !(github && github.ready)} onClick={archive}>{busy === 'archive' ? 'Saving to GitHub...' : 'Save to my repository (GitHub)'}</button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={exportFiles}>{busy === 'export' ? 'Preparing...' : 'Download the files instead (max 400)'}</button>
            </div>
          </section>

          {last && (
            <section className="card space-y-2 border-gold">
              <h2 className="text-lg font-extrabold">2. Clear part {last.n} from Firebase</h2>
              <p className="text-xs text-dim">Only after the website has been deployed with this part. The button checks that itself and refuses while it is not live, so nothing can be lost. It removes exactly the products of this part, and keeps any product you edited after archiving.</p>
              <button type="button" className="btn-gold" disabled={busy === `clear${last.n}`} onClick={() => clear(last.n)}>{busy === `clear${last.n}` ? 'Checking...' : `Clear part ${last.n} from Firebase`}</button>
            </section>
          )}

          <section className="card">
            <h2 className="text-lg font-extrabold">Archive parts</h2>
            {st.parts.length === 0 ? <p className="mt-1 text-sm text-dim">No part yet.</p> : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {st.parts.map((p) => (
                  <li key={p.n} className="flex flex-wrap items-center gap-2 py-2">
                    <b>Part {p.n}</b><span className="text-dim">{p.count} products · {p.at ? formatDate(p.at) : ''} · {p.file}</span>
                    <button type="button" className="btn-ghost ml-auto !px-3 !py-1 text-xs" disabled={busy === `clear${p.n}`} onClick={() => clear(p.n)}>Clear leftovers from Firebase</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-2">
            <h2 className="text-lg font-extrabold">Edit an archived product</h2>
            <p className="text-xs text-dim">Search it, then copy it back to Firebase. From then on the live copy is used (price, stock, photos) and the archive copy is ignored.</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) search(); }}>
              <input className="input" placeholder="Search archived products" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn-ghost" disabled={busy === 'search'}>Search</button>
            </form>
            {found && (found.length === 0 ? <p className="text-sm text-dim">No archived product found.</p> : (
              <ul className="space-y-1">{found.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="text-dim">{formatPKR(p.price)}</span><button type="button" className="btn-ghost !px-3 !py-1 text-xs" disabled={busy === `edit${p.id}`} onClick={() => edit(p)}>Copy to Firebase</button></li>
              ))}</ul>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
