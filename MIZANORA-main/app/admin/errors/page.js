'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { authClient, dbClient } from '@/lib/firebase-client';
import { formatPKR } from '@/lib/format';
import { revalidateSite } from '@/lib/admin-cache';

// Admin > Photo errors. Products whose photos do not load are taken off the shop automatically and land here.
// Fix the photo link (or re-check later) to bring a product back, or delete it. "Scan" checks every product's photo in small batches.
export default function PhotoErrors() {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [fix, setFix] = useState({});
  const [scan, setScan] = useState(null);
  const [deep, setDeep] = useState(false);
  const stop = useRef(false);

  const token = () => authClient().currentUser.getIdToken();
  const load = useCallback(async () => {
    const s = await getDocs(query(collection(dbClient(), 'imageErrors'), orderBy('lastAt', 'desc'), limit(500)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);
  useEffect(() => { load().catch((e) => setMsg(e.code === 'permission-denied' ? 'Permission denied. Publish the new firestore.rules (it has the imageErrors rule) with your admin UID/email.' : e.message)); }, [load]);

  async function api(body) {
    const r = await fetch('/api/admin/image-check', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }

  async function runScan() {
    stop.current = false; setMsg('');
    const tot = { scanned: 0, hidden: 0, trimmed: 0, unknown: 0 };
    setScan({ ...tot, running: true });
    let cursor = '';
    try {
      for (let i = 0; i < 5000 && !stop.current; i++) {
        const j = await api({ action: 'scan', cursor, limit: 40, all: deep });
        ['scanned', 'hidden', 'trimmed', 'unknown'].forEach((k) => { tot[k] += j[k] || 0; });
        setScan({ ...tot, running: true });
        cursor = j.next;
        if (!cursor) break;
      }
    } catch (e) { setMsg(e.message); }
    setScan({ ...tot, running: false, stopped: stop.current });
    await revalidateSite();
    load().catch(() => {});
  }

  const recheck = async (r) => {
    setBusy(r.id); setMsg('');
    try {
      const j = await api({ action: 'recheck', slug: r.id });
      setMsg(j.state === 'restored' ? `${r.name}: photos work again, the product is back on the shop.` : j.state === 'gone' ? 'That product no longer exists.' : j.state === 'ok' ? `${r.name}: photos work.` : `${r.name}: still broken (${j.why || 'photo does not load'}).`);
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  const saveFix = async (r) => {
    const urls = String(fix[r.id] || '').split(/[\s,]+/).filter((u) => /^https?:\/\//i.test(u));
    if (!urls.length) { setMsg('Paste one or more photo links (https://...).'); return; }
    setBusy(r.id); setMsg('');
    try {
      const res = await api({ action: 'urls', urls });
      const good = res.results.filter((x) => x.state !== 'bad').map((x) => x.url);
      if (!good.length) { setMsg(`These links do not open as photos: ${res.results.map((x) => x.why).join(', ')}`); setBusy(''); return; }
      await setDoc(doc(dbClient(), 'products', r.id), { images: good, active: true, hiddenReason: null, updatedAt: Date.now() }, { merge: true });
      await deleteDoc(doc(dbClient(), 'imageErrors', r.id));
      await revalidateSite(r.id);
      setMsg(`${r.name}: new photo saved, the product is live again.`);
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  const restore = async (r) => {
    if (!window.confirm('Show this product on the shop again even though its photo does not load?')) return;
    setBusy(r.id);
    try { await setDoc(doc(dbClient(), 'products', r.id), { active: true, hiddenReason: null, updatedAt: Date.now() }, { merge: true }); await deleteDoc(doc(dbClient(), 'imageErrors', r.id)); await revalidateSite(r.id); await load(); } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  const dismiss = async (r) => { setBusy(r.id); try { await deleteDoc(doc(dbClient(), 'imageErrors', r.id)); await load(); } catch (e) { setMsg(e.message); } setBusy(''); };
  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}" permanently?`)) return;
    setBusy(r.id);
    try { await deleteDoc(doc(dbClient(), 'products', r.id)); await deleteDoc(doc(dbClient(), 'imageErrors', r.id)); await revalidateSite(r.id); try { sessionStorage.removeItem('mz_admin_products'); } catch (_) { /* ignore */ } await load(); } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  const removeAllHidden = async () => {
    const list = (rows || []).filter((r) => r.hidden);
    if (!list.length || !window.confirm(`Delete all ${list.length} hidden products with broken photos permanently?`)) return;
    setBusy('all');
    try { for (const r of list) { await deleteDoc(doc(dbClient(), 'products', r.id)); await deleteDoc(doc(dbClient(), 'imageErrors', r.id)); } await revalidateSite(); try { sessionStorage.removeItem('mz_admin_products'); } catch (_) { /* ignore */ } await load(); setMsg(`${list.length} products deleted.`); } catch (e) { setMsg(e.message); }
    setBusy('');
  };

  const hidden = (rows || []).filter((r) => r.hidden);
  const trimmed = (rows || []).filter((r) => !r.hidden);
  const Row = ({ r }) => (
    <li className="card !p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-raised text-xs text-faint">
          {r.badImages && r.badImages[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.badImages[0]} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : 'no photo'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{r.name || r.id}</p>
          <p className="truncate text-xs text-dim">{r.id} · {formatPKR(r.price)} · {r.category || 'no category'} · {r.reason || 'photo does not load'} · seen {r.count || 1}x</p>
          {(r.badImages || []).slice(0, 2).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate text-[0.7rem] text-gold underline">{u}</a>)}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.hidden ? 'bg-red-100 text-red-700' : 'bg-saffron/20 text-gold'}`}>{r.hidden ? 'hidden' : 'photo removed'}</span>
      </div>
      {r.hidden && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="input !py-1.5 text-xs sm:flex-1" placeholder="Paste new photo link(s) https://..." value={fix[r.id] || ''} onChange={(e) => setFix((f) => ({ ...f, [r.id]: e.target.value }))} />
          <button type="button" className="btn-gold !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => saveFix(r)}>Save photo + show</button>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => recheck(r)}>Check again</button>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => restore(r)}>Show anyway</button>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs text-red-600" disabled={busy === r.id} onClick={() => remove(r)}>Delete product</button>
        </div>
      )}
      {!r.hidden && <div className="mt-2 flex gap-2"><button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy === r.id} onClick={() => dismiss(r)}>OK, clear this note</button></div>}
    </li>
  );

  return (
    <div className="min-w-0">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Photo errors</h1>
      <p className="mt-1 text-sm text-dim">When a product photo does not load, the shop checks it itself. A broken photo is removed; a product with NO working photo is taken off the shop automatically and listed here, so customers never see empty products.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className="card mt-4 space-y-2">
        <h2 className="text-lg font-extrabold">Scan all products</h2>
        <p className="text-xs text-dim">Checks product photos in small batches (about 40 products per step) and moves the broken ones here. Safe to stop and run again. For lakhs of products let it run in the background tab.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={deep} onChange={(e) => setDeep(e.target.checked)} disabled={scan && scan.running} /> Check every photo of every product (slower; default checks the main photo)</label>
        <div className="flex flex-wrap items-center gap-2">
          {scan && scan.running ? <button type="button" className="btn-ghost" onClick={() => { stop.current = true; }}>Stop</button> : <button type="button" className="btn-gold" onClick={runScan}>Start scan</button>}
          {scan && <span className="text-sm text-dim">{scan.running ? 'Scanning... ' : scan.stopped ? 'Stopped. ' : 'Finished. '}{scan.scanned} checked · {scan.hidden} hidden · {scan.trimmed} photos removed · {scan.unknown} could not be checked (left as they are)</span>}
        </div>
      </div>

      {!rows ? <p className="mt-6 text-dim">Loading...</p> : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Hidden from the shop ({hidden.length})</h2>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => load().catch((e) => setMsg(e.message))}>Refresh</button>
              {hidden.length > 1 && <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs text-red-600" disabled={busy === 'all'} onClick={removeAllHidden}>Delete all {hidden.length}</button>}
            </span>
          </div>
          {hidden.length === 0 ? <p className="mt-2 text-sm text-dim">No product is hidden because of photos.</p> : <ul className="mt-2 space-y-2">{hidden.map((r) => <Row key={r.id} r={r} />)}</ul>}
          {trimmed.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-extrabold">Broken photos removed, product still live ({trimmed.length})</h2>
              <ul className="mt-2 space-y-2">{trimmed.map((r) => <Row key={r.id} r={r} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
