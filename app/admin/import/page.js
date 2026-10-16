'use client';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { collection, doc, documentId, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { authClient, dbClient } from '@/lib/firebase-client';
import { formatPKR } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { revalidateSite } from '@/lib/admin-cache';
import { SITE } from '@/lib/config';
import { DELIVERY_FEE, PROFIT_MAX, PROFIT_MIN, PROFIT_TIERS, altImage, buildProducts, clampProfit, parseCsv, productsToCsv, safeAffRate, shopPrice } from '@/lib/importProducts';

// Admin > Import. Upload a Markaz / Shopify product CSV (supplier price) or a Mizanora CSV (final price).
// Built for big files (50,000+ products): only the first rows are drawn, everything is written in small batches, and a big file can go
// straight into the product ARCHIVE (JSON files in your repository) so the free Firebase quota is never touched.
const SHOW = 200;           // rows drawn in the preview
const PART = 500;           // products per archive file
const FB_BATCH = 240;       // products per Firestore batch (2 writes each, 500 allowed)
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export default function AdminImport() {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [tiers, setTiers] = useState(PROFIT_TIERS.map(([u, p]) => [u, p]));
  const [profits, setProfits] = useState({});
  const [off, setOff] = useState({});
  const [publish, setPublish] = useState(true);
  const [affOn, setAffOn] = useState(true);
  const [overwrite, setOverwrite] = useState(true);
  const [featured, setFeatured] = useState(8);
  const [mode, setMode] = useState('firebase'); // firebase | archive
  const [checkPhotos, setCheckPhotos] = useState(true);
  const [priceLock, setPriceLock] = useState(true);   // never change the price of a product that already exists
  const [copyPhotos, setCopyPhotos] = useState(false);
  const [copyCount, setCopyCount] = useState(3);
  const [saveCosts, setSaveCosts] = useState(true);
  const [deduct, setDeduct] = useState(0);
  const [minProfit, setMinProfit] = useState(PROFIT_MIN);
  const [startAt, setStartAt] = useState(0);
  const [howMany, setHowMany] = useState(0); // 0 = all
  const [existing, setExisting] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState(null);
  const stop = useRef(false);

  const dTiers = useDeferredValue(tiers);
  const dProfits = useDeferredValue(profits);
  const built = useMemo(() => (rows ? buildProducts(rows, { tiers: dTiers, profits: dProfits, publish, affOn, featuredCount: featured, deduct, minProfit }) : null), [rows, dTiers, dProfits, publish, affOn, featured, deduct, minProfit]);
  const list = built ? built.products : [];
  const picked = useMemo(() => list.filter((p) => !off[p.handle]), [list, off]);
  const slice = useMemo(() => picked.slice(Math.max(0, startAt), howMany > 0 ? Math.max(0, startAt) + howMany : undefined), [picked, startAt, howMany]);
  const isMarkaz = built && built.format === 'markaz';
  const token = async () => authClient().currentUser.getIdToken();

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setMsg(''); setProfits({}); setOff({}); setStartAt(0); setHowMany(0); setExisting(null);
    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      const b = buildProducts(parsed, {});
      if (!b.products.length) { setRows(null); setMsg(b.format === 'unknown' ? 'This file is not recognised. Use a Markaz/Shopify export or the Mizanora CSV.' : 'No usable products found in this file.'); return; }
      setRows(parsed); setFileName(f.name);
      const big = b.products.length > 2000;
      setMode(big ? 'archive' : 'firebase'); setCheckPhotos(!big); setSaveCosts(!big);
      // GitHub connected? Then the default is the ARCHIVE: your whole catalogue can live in data/catalog with zero Firestore writes.
      api('/api/admin/archive', { action: 'status' }).then((st) => {
        if (st && st.github && st.github.ready) {
          setMode('archive');
          setMsg(`${b.products.length.toLocaleString()} products found. GitHub is connected, so "Save to my repository (no Firebase)" is selected: nothing is written to Firebase.`);
        }
      }).catch(() => { /* no GitHub: the Firebase mode stays */ });
      // Which of the FIRST rows already exist? (a few cheap reads, never the whole collection)
      const ids = b.products.slice(0, SHOW).map((p) => p.slug);
      Promise.all(chunk(ids, 30).map((c) => getDocs(query(collection(dbClient(), 'products'), where(documentId(), 'in', c))))).then((snaps) => setExisting(new Set(snaps.flatMap((s) => s.docs.map((d) => d.id))))).catch(() => setExisting(new Set()));
    } catch (err) { setMsg((err && err.message) || 'Could not read this file.'); }
    e.target.value = '';
  }

  const setTier = (n, v) => setTiers((t) => t.map((r, i) => (i === n ? [r[0], clampProfit(v, minProfit)] : r)));
  const setProfit = (handle, v) => setProfits((p) => ({ ...p, [handle]: v === '' ? undefined : Number(v) }));

  async function api(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }

  async function copyOne(url, tk) {
    if (!/markaz\.app/.test(url)) return { url, ok: true };
    try {
      const res = await fetch('/api/import-image', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ url }) });
      const j = await res.json().catch(() => null);
      return j && j.ok ? { url: j.url, ok: true } : { url, ok: false, error: j && j.error };
    } catch (e) { return { url, ok: false, error: e.message }; }
  }

  // Looks at the main photo of every product (30 links per request, 3 requests at a time). -> Map(slug -> reason) of the products whose photo is really broken.
  async function badPhotos(todo) {
    const bad = new Map();
    // A product whose media came as a VIDEO (Facebook / Instagram / TikTok / YouTube / .mp4 in the CSV) is complete:
    // it gets a video card on the shop and feeds the reels rail, so it is never skipped for "no photo".
    const jobs = chunk(todo.filter((p) => p.doc.images[0]).map((p) => [p.slug, p.doc.images[0]]), 30);
    const noPhoto = todo.filter((p) => !p.doc.images[0] && !(p.doc.videos || []).length);
    noPhoto.forEach((p) => bad.set(p.slug, 'no photo'));
    let next = 0, done = 0;
    const worker = async () => {
      while (next < jobs.length && !stop.current) {
        const j = jobs[next++];
        try {
          const res = await api('/api/admin/image-check', { action: 'urls', urls: j.map((x) => x[1]) });
          res.results.forEach((r, i) => { if (r.state === 'bad') bad.set(j[i][0], r.why || 'photo does not load'); });
        } catch (e) { /* could not check this group: those products are imported as they are */ }
        done += j.length; setMsg(`Checking photos: ${done} of ${todo.length - noPhoto.length}... (${bad.size} broken so far)`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return bad;
  }

  async function runFirebase(todo) {
    const db = dbClient();
    const writes = todo.length * (saveCosts ? 2 : 1);
    if (writes > 12000 && !window.confirm(`This needs about ${writes.toLocaleString()} Firebase writes. The free (Spark) plan allows 20,000 writes a DAY, and when it is used up orders also fail until it resets. For big files choose "Save to archive" instead. Continue anyway?`)) return;
    let work = todo.filter((p) => overwrite || !(existing && existing.has(p.slug)));
    // PRICE LOCK: read what already exists (30 ids per query) and keep those prices exactly as they are on the shop.
    let locked = 0;
    if (priceLock && work.length <= 4000) {
      try {
        const map = new Map();
        for (const c of chunk(work.map((p) => p.slug), 30)) {
          const snap = await getDocs(query(collection(dbClient(), 'products'), where(documentId(), 'in', c)));
          snap.docs.forEach((d) => { const x = d.data(); if (Number(x.price) > 0) map.set(d.id, { price: Number(x.price), comparePrice: Number(x.comparePrice) || 0 }); });
          if (stop.current) break;
        }
        if (map.size) {
          work = work.map((p) => {
            const o = map.get(p.slug);
            if (!o) return p;
            if (Number(p.doc.price) !== o.price) locked++;
            return { ...p, doc: { ...p.doc, price: o.price, ...(o.comparePrice ? { comparePrice: o.comparePrice } : {}) } };
          });
        }
      } catch (e) { setMsg(`Price lock could not read the existing prices (${e.message}); the CSV prices are used.`); }
    }
    const bad = checkPhotos ? await badPhotos(work) : new Map(work.filter((p) => !p.doc.images[0] && !(p.doc.videos || []).length).map((p) => [p.slug, 'no photo']));
    if (copyPhotos) {
      const tk = await token();
      const jobs = [];
      work.forEach((p, pi) => p.doc.images.slice(0, copyCount).forEach((u, ii) => { if (!bad.has(p.slug)) jobs.push({ pi, ii, u }); }));
      const out = new Map(); let n = 0, failed = 0, next = 0;
      const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; const r = await copyOne(j.u, tk); out.set(`${j.pi}:${j.ii}`, r.url); if (!r.ok) failed++; n++; setMsg(`Copying photos to ImgBB: ${n} of ${jobs.length}${failed ? ` (${failed} kept as original links)` : ''}...`); } };
      await Promise.all([worker(), worker(), worker(), worker()]);
      work = work.map((p, pi) => ({ ...p, doc: { ...p.doc, images: p.doc.images.map((u, ii) => out.get(`${pi}:${ii}`) || u) } }));
    }
    let done = 0;
    for (const c of chunk(work, FB_BATCH)) {
      if (stop.current) break;
      const batch = writeBatch(db);
      for (const p of c) {
        const isBad = bad.has(p.slug);
        batch.set(doc(db, 'products', p.slug), isBad ? { ...p.doc, active: false, hiddenReason: 'image' } : p.doc, { merge: false });
        if (p.cost && saveCosts) batch.set(doc(db, 'productCosts', p.slug), p.cost, { merge: true });
        if (isBad) batch.set(doc(db, 'imageErrors', p.slug), { slug: p.slug, name: p.doc.name, price: p.doc.price, category: p.doc.category, reason: bad.get(p.slug), badImages: p.doc.images.slice(0, 4), hidden: true, status: 'open', count: 1, lastAt: Date.now(), source: 'import' });
      }
      await batch.commit();
      done += c.length; setMsg(`Imported ${done} of ${work.length}...`);
    }
    await revalidateSite();
    try { sessionStorage.removeItem('mz_admin_products'); } catch (_) { /* ignore */ }
    setMsg(`Done: ${done - bad.size} products are live${bad.size ? `, ${bad.size} had no working photo and were put in Admin > Photo errors (hidden)` : ''}${locked ? `, ${locked} existing price(s) were kept exactly as they were (price lock)` : ''}${work.length < todo.length ? `, ${todo.length - work.length} existing ones skipped` : ''}.`);
  }

  async function runArchive(todo) {
    const st = await api('/api/admin/archive', { action: 'status' });
    const bad = checkPhotos ? await badPhotos(todo) : new Map(todo.filter((p) => !p.doc.images[0] && !(p.doc.videos || []).length).map((p) => [p.slug, 'no photo']));
    const good = todo.filter((p) => !bad.has(p.slug));
    const parts = chunk(good, PART);
    const github = st.github && st.github.ready;
    if (!github) { setMsg(`This needs GitHub: add GITHUB_TOKEN and GITHUB_REPO in Vercel (see Admin > Archive), redeploy, then try again. Until then use "Save to Firebase" in daily pieces (Start at / Import how many), and move old products to the archive later.`); return; }
    const metas = [], files = []; let locked = 0;
    for (let k = 0; k < parts.length && !stop.current; k++) {
      const products = parts[k].map((p) => ({ id: p.slug, data: p.doc }));
      const n = st.nextN + k;
      const j = await api('/api/admin/archive', { action: 'stage', n, products, priceLock });
      metas.push(j.meta); files.push(...j.files); locked += Number(j.locked) || 0;
      setMsg(`Preparing archive files: ${k + 1} of ${parts.length}${locked ? ` (${locked} prices kept as they are)` : ''}...`);
    }
    if (stop.current) { setMsg('Stopped. Nothing was saved.'); return; }
    const c = await api('/api/admin/archive', { action: 'commit', metas, files });
    setMsg(`Saved ${good.length.toLocaleString()} products as ${metas.length} archive file(s) in ONE commit${bad.size ? ` (${bad.size} skipped: no working photo)` : ''}${locked ? ` - ${locked} product(s) already existed, so their price was NOT changed (price lock)` : ''}. Vercel is deploying now (1 to 3 minutes); then they are live on the shop. Archive total: ${c.total.toLocaleString()}.`);
  }

  async function run() {
    if (!slice.length) { setMsg('Nothing selected.'); return; }
    setBusy(true); setMsg(''); stop.current = false;
    try { if (mode === 'archive') await runArchive(slice); else await runFirebase(slice); }
    catch (e) { setMsg(e && e.code === 'permission-denied' ? 'Permission denied. Publish the updated firestore.rules and make sure your admin UID/email is in it.' : (e && e.message) || 'Import failed.'); }
    setBusy(false);
  }

  async function reprice(dry) {
    setBusy(true); stop.current = false; setRep({ scanned: 0, changed: 0, running: true, dry });
    const tot = { scanned: 0, changed: 0 }; let cursor = '', sample = [];
    try {
      for (let i = 0; i < 2000 && !stop.current; i++) {
        const j = await api('/api/admin/reprice', { cursor, limit: 200, tiers: tiers.map(([u, p]) => [u === Infinity ? null : u, p]), minProfit, dryRun: dry });
        tot.scanned += j.scanned; tot.changed += j.changed; sample = [...sample, ...j.sample].slice(0, 5);
        setRep({ ...tot, running: true, dry, sample });
        cursor = j.next; if (!cursor) break;
      }
      if (!dry) await revalidateSite();
    } catch (e) { setMsg(e.message); }
    setRep({ ...tot, running: false, dry, sample });
    setBusy(false);
  }

  const totalProfit = picked.reduce((s, p) => s + (p.cost ? p.cost.profit : 0), 0);
  const writes = slice.length * (saveCosts ? 2 : 1);

  return (
    <div className="min-w-0">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Import products (CSV)</h1>
      <p className="mt-1 text-sm text-dim">Upload a Markaz / Shopify CSV (supplier price) or a Mizanora CSV (final price). Delivery of {formatPKR(SITE.shippingFee || DELIVERY_FEE)} is added at checkout. Profit: up to Rs 100 cost = Rs 2 to 30, up to Rs 500 = Rs 100, bigger items Rs 200 to {PROFIT_MAX}. Edit the table below if you want other amounts.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className="card mt-4 space-y-3">
        <label className="label" htmlFor="csvf">CSV file</label>
        <input id="csvf" type="file" accept=".csv,text/csv" onChange={onFile} className="input" />
        {fileName && <p className="text-xs text-dim">{fileName}: {list.length.toLocaleString()} products found ({isMarkaz ? 'supplier export' : 'Mizanora format'}). The first {Math.min(SHOW, list.length)} are listed below; the settings apply to all of them.</p>}
      </div>

      {rows && isMarkaz && (
        <div className="card mt-4">
          <h2 className="text-lg font-extrabold">Profit by supplier price</h2>
          <p className="text-xs text-dim">Shop price = supplier price + profit. Change a row here, or one product's profit in the list below.</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1">Supplier price includes delivery: subtract Rs <input type="number" min="0" max="1000" className="input !w-20 !py-1.5" value={deduct} onChange={(e) => setDeduct(Math.max(0, Number(e.target.value) || 0))} /></label>
            <label className="flex items-center gap-1">Lowest allowed profit Rs <input type="number" min="0" max={PROFIT_MAX} className="input !w-20 !py-1.5" value={minProfit} onChange={(e) => { const v = Math.max(0, Math.min(PROFIT_MAX, Number(e.target.value) || 0)); setMinProfit(v); setTiers((t) => t.map(([u, p]) => [u, Math.max(p, v)])); }} /></label>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {tiers.map(([upTo, pr], n) => (
              <label key={n} className="rounded-xl bg-raised p-2 text-xs">
                <span className="block text-dim">{upTo === Infinity ? 'Above' : 'Up to'} {upTo === Infinity ? formatPKR(tiers[n - 1][0]) : formatPKR(upTo)}</span>
                <span className="mt-1 flex items-center gap-1">Profit Rs <input type="number" min={minProfit} max={PROFIT_MAX} className="input !w-16 !py-1.5" value={pr} onChange={(e) => setTier(n, e.target.value)} /></span>
              </label>
            ))}
          </div>
        </div>
      )}

      {rows && (
        <div className="card mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {[['archive', 'Save to my repository (no Firebase) — recommended', 'Your whole shop runs from JSON files in data/catalog: ZERO Firestore reads and writes, 50,000+ products fine. Search and edit them later in Admin > Catalogue (files), still without Firebase. Needs GitHub connected (GITHUB_TOKEN + GITHUB_REPO).'], ['firebase', 'Save to Firebase', 'Live at once, editable in Admin > Products. Costs 2 writes per product (the free plan allows 20,000 writes a day) - use it only for a handful of products you want to edit in the old form or attach promo codes to.']].map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => setMode(v)} className={`rounded-xl border-2 p-3 text-left text-sm ${mode === v ? 'border-gold bg-gold/5' : 'border-line'}`}><b className="block">{t}</b><span className="text-xs text-dim">{d}</span></button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={checkPhotos} onChange={(e) => setCheckPhotos(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Check the main photo of each product first (broken ones are not shown on the shop)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={priceLock} onChange={(e) => setPriceLock(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> <b>Price lock:</b> keep the price of products that already exist (only new products take the CSV price)</label>
            {mode === 'firebase' && <label className="flex items-center gap-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Show on shop immediately</label>}
            {mode === 'firebase' && <label className="flex items-center gap-2"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Update products that already exist</label>}
            {isMarkaz && <label className="flex items-center gap-2"><input type="checkbox" checked={affOn} onChange={(e) => setAffOn(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Workers can earn commission (capped to protect profit)</label>}
            {mode === 'firebase' && isMarkaz && <label className="flex items-center gap-2"><input type="checkbox" checked={saveCosts} onChange={(e) => setSaveCosts(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Save supplier cost (1 extra write per product; lets the assistant keep a safe profit)</label>}
            {mode === 'firebase' && <label className="flex items-center gap-2"><input type="checkbox" checked={copyPhotos} onChange={(e) => setCopyPhotos(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Copy photos to my ImgBB (slow, small files only)</label>}
            {mode === 'firebase' && copyPhotos && <label className="flex items-center gap-2">Photos per product <input type="number" min="1" max="8" className="input !w-16 !py-1.5" value={copyCount} onChange={(e) => setCopyCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} /></label>}
            {isMarkaz && <label className="flex items-center gap-2">Featured on home <input type="number" min="0" max="30" className="input !w-16 !py-1.5" value={featured} onChange={(e) => setFeatured(Math.max(0, Number(e.target.value) || 0))} /></label>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">Start at product # <input type="number" min="0" className="input !w-24 !py-1.5" value={startAt} onChange={(e) => setStartAt(Math.max(0, Number(e.target.value) || 0))} /></label>
            <label className="flex items-center gap-1">Import how many (0 = all) <input type="number" min="0" className="input !w-24 !py-1.5" value={howMany} onChange={(e) => setHowMany(Math.max(0, Number(e.target.value) || 0))} /></label>
            <span className="text-xs text-dim">Use these to import a big file in daily pieces on the free plan.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-gold" disabled={busy || !slice.length} onClick={run}>{busy ? 'Working...' : `${mode === 'archive' ? 'Save' : 'Import'} ${slice.length.toLocaleString()} products`}</button>
            {busy && <button type="button" className="btn-ghost" onClick={() => { stop.current = true; }}>Stop</button>}
            {picked.length <= 3000 && <button type="button" className="btn-ghost" onClick={() => downloadCsv('mizanora-products.csv', productsToCsv(picked))}>Download as Mizanora CSV</button>}
            {mode === 'firebase' && <span className="text-xs text-dim">about {writes.toLocaleString()} Firebase writes</span>}
            {totalProfit > 0 && <span className="text-xs text-dim">Profit if all sell: {formatPKR(totalProfit)} (delivery excluded)</span>}
          </div>
        </div>
      )}

      {rows && (
        <ul className="mt-4 space-y-2">
          {list.slice(0, SHOW).map((p) => {
            const d = p.doc, c = p.cost;
            const isOld = existing && existing.has(p.slug);
            return (
              <li key={p.handle} className={`card !p-3 ${off[p.handle] ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" aria-label={`Import ${d.name}`} checked={!off[p.handle]} onChange={(e) => setOff((o) => ({ ...o, [p.handle]: !e.target.checked }))} className="mt-1 h-4 w-4 accent-[#0B6B45]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.images[0] ? <img src={d.images[0]} alt="" className="h-14 w-14 rounded-lg bg-raised object-cover" loading="lazy" onError={(e) => { const alt = altImage(d.images[0]); if (alt && e.currentTarget.src !== alt) e.currentTarget.src = alt; }} /> : <div className="h-14 w-14 rounded-lg bg-raised" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.name}</p>
                    <p className="truncate text-xs text-dim">{d.categories.join(', ') || 'No category'} · {d.options.map((o) => `${o.name}: ${o.values.join('/')}`).join(' · ') || 'No options'} · {d.images.length} photos{existing ? (isOld ? ' · EXISTS' : ' · new') : ''}{p.warn.length ? ` · ${p.warn.join(', ')}` : ''}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-extrabold text-gold">{formatPKR(d.price)}</p>
                    {c && <p className="text-xs text-dim">cost {formatPKR(c.cost)} + {formatPKR(d.price - c.cost)}</p>}
                  </div>
                </div>
                {isMarkaz && c && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">Profit Rs <input type="number" min={minProfit} max={PROFIT_MAX} className="input !w-20 !py-1.5" value={profits[p.handle] ?? c.profit} onChange={(e) => setProfit(p.handle, e.target.value)} onBlur={() => profits[p.handle] != null && setProfit(p.handle, clampProfit(profits[p.handle], minProfit))} /></label>
                    <span className="text-dim">price = {formatPKR(shopPrice(c.cost, c.profit, minProfit))} · worker commission cap {safeAffRate(d.price, c.profit)}%</span>
                  </div>
                )}
              </li>
            );
          })}
          {list.length > SHOW && <li className="text-center text-sm text-dim">... and {(list.length - SHOW).toLocaleString()} more products (not drawn, but imported with the same rules).</li>}
        </ul>
      )}

      <div className="card mt-8 space-y-2">
        <h2 className="text-lg font-extrabold">Re-price products already in Firebase</h2>
        <p className="text-xs text-dim">Applies the profit table above to live products whose supplier cost was saved at import: price = cost + profit. "Preview" changes nothing. Products in the archive keep their archived price (re-import the CSV in archive mode to replace them).</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => reprice(true)}>Preview</button>
          <button type="button" className="btn-gold" disabled={busy} onClick={() => { if (window.confirm('Change the price of all live products that have a saved supplier cost?')) reprice(false); }}>Apply new prices</button>
          {busy && rep && rep.running && <button type="button" className="btn-ghost" onClick={() => { stop.current = true; }}>Stop</button>}
          {rep && <span className="text-sm text-dim">{rep.running ? 'Working... ' : rep.dry ? 'Preview: ' : 'Done: '}{rep.scanned} checked · {rep.changed} {rep.dry ? 'would change' : 'changed'}{rep.sample && rep.sample.length ? ` (e.g. ${rep.sample.map((s) => `${s.from} → ${s.to}`).join(', ')})` : ''}</span>}
        </div>
      </div>
    </div>
  );
}
