'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Check, Eye, EyeOff, Loader2, Pencil, RefreshCw, RotateCcw, Search, ShieldAlert, Sparkles, Star, X } from 'lucide-react';
import { authClient, dbClient } from '@/lib/firebase-client';
import { doc, setDoc } from 'firebase/firestore';
import { formatPKR } from '@/lib/format';
import { revalidateSite } from '@/lib/admin-cache';
import { useAdminSearch } from '@/components/AdminSearch';
import { adminHit } from '@/lib/adminSearch';

// Admin > Catalogue (files) - THE ZERO-FIREBASE CATALOGUE.
// Everything here lives in the JSON files of data/catalog (what the CSV import writes). You can search it, edit prices,
// hide products and mark them sold out WITHOUT writing a single document to Firestore: every change becomes a small new
// part file in your repository, and the archive reader always takes the NEWEST part - so your edit wins.
// ("Restore to Firebase" is the one action that does write to Firebase; use it only when you want to edit a product in the old panel.)
export default function AdminCatalogue() {
  const { q, setQ } = useAdminSearch();
  const [parts, setParts] = useState(null);
  const [total, setTotal] = useState(0);
  const [partN, setPartN] = useState(0);
  const [rows, setRows] = useState(null);
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null); // { id, form }
  const [scan, setScan] = useState(null); // { running, checked, total, bad: [{id,name,why}] }
  const [scanMsg, setScanMsg] = useState('');
  const [show, setShow] = useState(0);    // rows drawn

  const token = useCallback(async () => authClient().currentUser.getIdToken(), []);
  const api = useCallback(async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }, [token]);

  const loadParts = useCallback(async () => {
    try {
      const j = await api('/api/admin/archive-edit', { action: 'parts' });
      const list = [...(j.parts || [])].sort((a, b) => Number(b.n) - Number(a.n));
      setParts(list); setTotal(Number(j.total) || 0);
      if (list.length) setPartN(list[0].n);
      return list;
    } catch (e) { setParts([]); setMsg(e.message); return []; }
  }, [api]);

  const loadPart = useCallback(async (n) => {
    if (!n) return;
    setBusy('list'); setMsg('');
    try {
      const j = await api('/api/admin/archive-edit', { action: 'list', n });
      setRows(j.rows); setShow(100);
    } catch (e) { setRows([]); setMsg(e.message); } finally { setBusy(''); }
  }, [api]);

  useEffect(() => { loadParts().then((l) => { if (l && l.length) loadPart(l[0].n); }); }, [loadParts, loadPart]);

  // Search: with text it walks the parts newest-first (server side); empty text shows the selected part.
  const runSearch = useCallback(async (text) => {
    const term = String(text || '').trim();
    if (!term) { setHits(null); return; }
    setBusy('search'); setMsg('');
    try {
      const j = await api('/api/admin/product-search', { q: term, limit: 40 });
      setHits(j.hits || []);
      if (j.empty) setMsg('There is no archive yet: import a CSV in archive mode first.');
    } catch (e) { setHits([]); setMsg(e.message); } finally { setBusy(''); }
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => { if (q.trim().length >= 2) runSearch(q); else setHits(null); }, 450);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  // PHOTO CHECK: looks at the main photo of every product shown here (30 links per request) and lists the broken ones.
  // Then "Hide all broken" writes ONE small part file - the products disappear from the shop, the files stay for you to fix.
  const checkPhotoList = async () => {
    const rowsNow = (list || []).filter((r) => r && r.id);
    if (!rowsNow.length) { setScanMsg('Load a part or search first.'); return; }
    const noPhoto = rowsNow.filter((r) => !r.image).map((r) => ({ id: r.id, name: r.name, why: 'no photo' }));
    const withPhoto = rowsNow.filter((r) => r.image);
    const bad = [...noPhoto];
    let checked = 0;
    setScan({ running: true, checked: 0, total: withPhoto.length, bad });
    try {
      for (let i = 0; i < withPhoto.length; i += 30) {
        const group = withPhoto.slice(i, i + 30);
        try {
          const j = await api('/api/admin/image-check', { action: 'urls', urls: group.map((r) => r.image) });
          (j.results || []).forEach((res, k) => { if (res.state === 'bad') bad.push({ id: group[k].id, name: group[k].name, why: res.why || 'photo does not load' }); });
        } catch { /* this group could not be checked */ }
        checked += group.length;
        setScan({ running: true, checked, total: withPhoto.length, bad: [...bad] });
      }
      setScan({ running: false, checked, total: withPhoto.length, bad });
      setScanMsg(bad.length ? `${bad.length} of ${rowsNow.length} product(s) have a photo problem. Hide them in one click - the files stay in the archive so you can fix the photo later.` : `All ${rowsNow.length} photos load correctly.`);
    } catch (e) { setScan({ running: false, checked, total: withPhoto.length, bad }); setScanMsg(e.message); }
  };

  const hideBroken = async () => {
    if (!scan || !scan.bad.length) return;
    setBusy('hideMany'); setScanMsg('');
    try {
      const j = await api('/api/admin/archive-edit', { action: 'hideMany', ids: scan.bad.map((b) => b.id).slice(0, 400), hidden: true });
      setScanMsg(`${j.count} product(s) hidden in one commit (part ${j.n}, ${String(j.commit || '').slice(0, 7)}). They are gone from the shop after the deploy (1 to 3 minutes). Nothing was written to Firebase.`);
      setScan({ ...scan, bad: [] });
      setRows((rs) => (rs ? rs.map((r) => (scan.bad.some((b) => b.id === r.id) ? { ...r, active: false } : r)) : rs));
    } catch (e) { setScanMsg(e.message); } finally { setBusy(''); }
  };

  const patch = async (id, changes, label) => {
    setBusy(id); setMsg('');
    try {
      const j = await api('/api/admin/archive-edit', { action: 'patch', id, patch: changes });
      setMsg(`${label} — saved as part ${j.n} in your repository (commit ${String(j.commit || '').slice(0, 7)}). Vercel deploys it in 1 to 3 minutes, then the shop shows it. Nothing was written to Firebase.`);
      if (rows) setRows(rows.map((r) => (r.id === id ? { ...r, ...changes } : r)));
      if (hits) setHits(hits.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const openEditor = async (r) => {
    setBusy(r.id); setMsg('');
    try {
      // The full product (description, all photos) - deployed archive first, then the repository.
      const j = await api('/api/admin/archive', { action: 'get', slug: r.id });
      const d = j.data || {};
      setEdit({
        id: r.id,
        form: {
          name: d.name || r.name || '', price: d.price ?? r.price ?? '', comparePrice: d.comparePrice ?? r.comparePrice ?? '',
          categories: (d.categories || r.categories || []).join(', '), description: d.description || '',
          images: (d.images || (r.image ? [r.image] : [])).join('\n'), inStock: d.inStock !== false, featured: Boolean(d.featured ?? r.featured), active: d.active !== false,
        },
      });
    } catch (e) { setMsg(`${e.message} (open it from a search hit to edit the fields you can see, or copy it to Firebase from Admin > Archive.)`); } finally { setBusy(''); }
  };

  const saveEditor = async () => {
    if (!edit) return;
    const f = edit.form;
    setBusy(edit.id); setMsg('');
    try {
      const j = await api('/api/admin/archive-edit', {
        action: 'save', id: edit.id,
        data: {
          name: f.name, price: Number(f.price), comparePrice: Number(f.comparePrice) || 0,
          categories: String(f.categories || '').split(',').map((s) => s.trim()).filter(Boolean),
          description: f.description, images: String(f.images || '').split('\n').map((s) => s.trim()).filter(Boolean),
          inStock: f.inStock, featured: f.featured, active: f.active, createdAt: Date.now(),
        },
      });
      setMsg(`Saved "${f.name}" as part ${j.n} (commit ${String(j.commit || '').slice(0, 7)}). Live on the shop after the deploy (1 to 3 minutes). Zero Firebase writes.`);
      setEdit(null); setRows(null); setHits(null); loadParts().then((l) => { if (l.length) loadPart(l[0].n); });
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  // The only action that touches Firestore: copy one archived product back so the old Products page can edit it.
  const toFirebase = async (r) => {
    if (!window.confirm(`Copy "${r.name}" into Firebase? This uses 1 write and the product then lives in BOTH places (the Firebase copy wins on the shop).`)) return;
    setBusy(r.id); setMsg('');
    try {
      const j = await api('/api/admin/archive', { action: 'get', slug: r.id });
      await setDoc(doc(dbClient(), 'products', r.id), { ...j.data, updatedAt: Date.now() });
      await revalidateSite(r.id);
      setMsg(`"${r.name}" is now in Firebase too (Admin > Products can edit it).`);
    } catch (e) { setMsg(e.message); } finally { setBusy(''); }
  };

  const list = useMemo(() => {
    if (hits) return hits.map((h) => ({ ...h, image: h.image, active: true, featured: false, isHit: true }));
    return (rows || []).filter((r) => adminHit(q, `${r.id} ${r.name} ${(r.categories || []).join(' ')} ${r.price}`));
  }, [rows, hits, q]);

  const pill = (on, onText, offText) => <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${on ? 'bg-emerald-500/15 text-emerald-800' : 'bg-raised text-dim'}`}>{on ? onText : offText}</span>;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Catalogue (files)</h1>
          <p className="mt-1 text-sm text-dim">
            {(total || 0).toLocaleString('en-PK')} products live in <b>data/catalog</b> of your repository • {(parts || []).length} part file(s) • <b>zero Firestore writes</b> for anything you do here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !px-3.5 !py-2 text-xs" onClick={() => { loadParts().then((l) => { if (l.length) loadPart(l[0].n); }); }}><RefreshCw size={14} /> Refresh</button>
          <Link href="/admin/import" className="btn-gold !px-4 !py-2 text-xs">Import a CSV</Link>
        </div>
      </div>

      <div className="card !p-3">
        <label htmlFor="cq" className="label">Search the whole catalogue (all parts)</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input id="cq" type="search" className="input !pl-9" placeholder="Name, slug, category or price…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {busy === 'search' ? <span className="flex items-center gap-1 text-dim"><Loader2 size={13} className="animate-spin" /> Searching the parts…</span> : null}
          {hits && <span className="text-dim">{hits.length} hit(s) in the archive</span>}
          {!q.trim() && parts && parts.length > 0 && (
            <>
              <label className="flex items-center gap-1.5 text-dim">Part
                <select className="input !w-auto !py-1.5" value={partN} onChange={(e) => { setPartN(Number(e.target.value)); loadPart(Number(e.target.value)); }}>
                  {parts.map((p) => <option key={p.n} value={p.n}>#{p.n} · {(Number(p.count) || 0).toLocaleString()} products</option>)}
                </select>
              </label>
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => loadPart(partN)}>Load part</button>
            </>
          )}
          {q.trim() && <button type="button" className="text-faint underline" onClick={() => { setQ(''); setHits(null); }}>clear</button>}
        </div>
      </div>

      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className="card !p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold">Photo check (no empty cards on the shop)</p>
            <p className="text-xs text-dim">A product whose photo does not load is hidden from the shop. Check the list you are viewing and hide every broken one in a single commit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost !px-3.5 !py-2 text-xs" disabled={scan?.running || busy === 'hideMany'} onClick={checkPhotoList}>
              {scan?.running ? <><Loader2 size={14} className="animate-spin" /> Checking {scan.checked}/{scan.total}...</> : <><Sparkles size={14} /> Check photos in this list</>}
            </button>
            {scan && scan.bad.length > 0 && (
              <button type="button" className="btn-gold !px-3.5 !py-2 text-xs" disabled={busy === 'hideMany'} onClick={hideBroken}>
                {busy === 'hideMany' ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />} Hide {scan.bad.length} broken product(s)
              </button>
            )}
          </div>
        </div>
        {scanMsg && <p role="status" className="mt-2 rounded-xl bg-raised p-3 text-sm text-cream">{scanMsg}</p>}
        {scan && scan.bad.length > 0 && (
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
            {scan.bad.slice(0, 40).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-raised px-3 py-1.5">
                <span className="min-w-0 truncate"><b>{b.name}</b> <span className="text-faint">({b.id})</span></span>
                <span className="shrink-0 font-semibold text-red-700">{b.why}</span>
              </li>
            ))}
            {scan.bad.length > 40 && <li className="px-3 py-1 text-faint">...and {scan.bad.length - 40} more</li>}
          </ul>
        )}
      </div>

      {parts && parts.length === 0 && (
        <div className="card">
          <p className="text-dim">No archive yet. Import a supplier CSV with <b>“Save to my repository”</b> (Admin &gt; Import CSV) — with GitHub connected the products go straight into <code>data/catalog</code> and the shop serves them from there, with no Firestore writes at all.</p>
        </div>
      )}

      {edit && (
        <div className="card space-y-3 border-2 border-gold/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Edit “{edit.id}”</h2>
            <button type="button" className="rounded-full p-2 text-dim" onClick={() => setEdit(null)} aria-label="Close"><X size={16} /></button>
          </div>
          <p className="text-xs text-dim">Saving writes a small new part file into your repository (one commit). The newest part wins, so the shop shows your change after the deploy. Nothing goes to Firebase.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="en">Name</label><input id="en" className="input" value={edit.form.name} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, name: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="ep">Price (PKR)</label><input id="ep" type="number" min="1" className="input" value={edit.form.price} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, price: e.target.value } })} /></div>
              <div><label className="label" htmlFor="ec">Old price</label><input id="ec" type="number" min="0" className="input" value={edit.form.comparePrice} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, comparePrice: e.target.value } })} /></div>
            </div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ek">Categories (comma separated, first = main)</label><input id="ek" className="input" value={edit.form.categories} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, categories: e.target.value } })} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ed">Description</label><textarea id="ed" rows="4" className="input" value={edit.form.description} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, description: e.target.value } })} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ei">Photo links (one per line, first = main)</label><textarea id="ei" rows="3" className="input" value={edit.form.images} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, images: e.target.value } })} /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {[['inStock', 'In stock'], ['featured', 'Featured on home'], ['active', 'Visible on the shop']].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(edit.form[k])} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, [k]: e.target.checked } })} className="h-4 w-4 accent-[#0B6B45]" /> {l}</label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-gold" disabled={busy === edit.id} onClick={saveEditor}>{busy === edit.id ? 'Saving…' : 'Save to the repository'}</button>
            <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      )}

      {list.length > 0 && (
        <ul className="space-y-2">
          {list.slice(0, show).map((r) => (
            <li key={r.id} className="card !p-3">
              <div className="flex items-center gap-3">
                {r.image
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="h-12 w-12 rounded-lg bg-raised object-cover" loading="lazy" />
                  : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-raised text-faint"><Archive size={16} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-sm text-dim">
                    {formatPKR(r.price)}{r.comparePrice > r.price ? ` · was ${formatPKR(r.comparePrice)}` : ''} · {(r.categories || []).join(', ') || 'no category'}{r.part ? ` · part ${r.part}` : ''}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">{pill(r.inStock !== false, 'In stock', 'Sold out')}{r.active !== false ? null : pill(false, '', 'Hidden')}{r.featured ? pill(true, 'Featured', '') : null}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-xs">
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => openEditor(r)}><Pencil size={13} /> Edit</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => patch(r.id, { inStock: r.inStock === false }, r.inStock === false ? 'Marked in stock' : 'Marked sold out')}>{r.inStock === false ? <Check size={13} /> : <X size={13} />}{r.inStock === false ? 'In stock' : 'Sold out'}</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => patch(r.id, { active: r.active === false }, r.active === false ? 'Now visible on the shop' : 'Hidden from the shop')}>{r.active === false ? <Eye size={13} /> : <EyeOff size={13} />}{r.active === false ? 'Show' : 'Hide'}</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => patch(r.id, { featured: !r.featured }, r.featured ? 'Removed from home picks' : 'Added to home picks')}><Star size={13} /> {r.featured ? 'Unfeature' : 'Feature'}</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => toFirebase(r)}><RotateCcw size={13} /> To Firebase</button>
                  {busy === r.id && <Loader2 size={14} className="animate-spin text-dim" />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.length > show && (
        <button type="button" className="btn-ghost w-full text-sm" onClick={() => setShow((s) => s + 200)}>Show {Math.min(200, list.length - show)} more of {list.length}</button>
      )}

      <p className="text-[0.7rem] leading-5 text-faint">
        Every edit becomes one commit in your repository and one Vercel deploy (1 to 3 minutes), and it costs no Firebase quota at all.
        Use <b>To Firebase</b> only when you want the old Admin &gt; Products form (or a promo code) for a specific product.
      </p>
    </div>
  );
}
