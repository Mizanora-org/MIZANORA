'use client';
import { useMemo, useState } from 'react';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { dbClient } from '@/lib/firebase-client';
import { formatPKR } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { revalidateSite } from '@/lib/admin-cache';
import { SITE } from '@/lib/config';
import { DELIVERY_FEE, PROFIT_MAX, PROFIT_MIN, PROFIT_TIERS, altImage, buildProducts, clampProfit, parseCsv, productsToCsv, safeAffRate, shopPrice } from '@/lib/importProducts';

// Admin > Import. Upload a Markaz / Shopify product CSV (supplier price) or a Mizanora CSV (final price).
// Check the prices in the table, change the profit of any product, then press Import: everything is written to Firestore.
export default function AdminImport() {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [tiers, setTiers] = useState(PROFIT_TIERS.map(([u, p]) => [u, p]));
  const [profits, setProfits] = useState({}); // per product override { handle: profit }
  const [off, setOff] = useState({}); // handle -> true when unticked
  const [publish, setPublish] = useState(true);
  const [affOn, setAffOn] = useState(true);
  const [overwrite, setOverwrite] = useState(true);
  const [featured, setFeatured] = useState(8);
  const [deduct, setDeduct] = useState(0); // supplier price already includes delivery? subtract it first
  const [minProfit, setMinProfit] = useState(PROFIT_MIN);
  const [existing, setExisting] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const built = useMemo(() => (rows ? buildProducts(rows, { tiers, profits, publish, affOn, featuredCount: featured, deduct, minProfit }) : null), [rows, tiers, profits, publish, affOn, featured, deduct, minProfit]);
  const list = built ? built.products : [];
  const picked = list.filter((p) => !off[p.handle]);
  const isMarkaz = built && built.format === 'markaz';

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setMsg(''); setProfits({}); setOff({});
    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      const b = buildProducts(parsed, {});
      if (!b.products.length) { setRows(null); setMsg(b.format === 'unknown' ? 'This file is not recognised. Use a Markaz/Shopify export or the Mizanora CSV.' : 'No usable products found in this file.'); return; }
      setRows(parsed); setFileName(f.name);
      getDocs(collection(dbClient(), 'products')).then((s) => setExisting(new Set(s.docs.map((d) => d.id)))).catch(() => setExisting(new Set()));
    } catch (err) { setMsg((err && err.message) || 'Could not read this file.'); }
    e.target.value = '';
  }

  const setTier = (n, v) => setTiers((t) => t.map((r, i) => (i === n ? [r[0], clampProfit(v, minProfit)] : r)));
  const setProfit = (handle, v) => setProfits((p) => ({ ...p, [handle]: v === '' ? undefined : Number(v) }));

  async function run() {
    if (!picked.length) { setMsg('Nothing selected.'); return; }
    setBusy(true); setMsg('');
    try {
      const db = dbClient();
      const todo = picked.filter((p) => overwrite || !(existing && existing.has(p.slug)));
      let done = 0;
      for (let i = 0; i < todo.length; i += 200) { // 2 writes per product, Firestore allows 500 per batch
        const batch = writeBatch(db);
        for (const p of todo.slice(i, i + 200)) {
          const old = existing && existing.has(p.slug);
          batch.set(doc(db, 'products', p.slug), p.doc, { merge: false });
          if (p.cost) batch.set(doc(db, 'productCosts', p.slug), p.cost, { merge: true });
          if (old) { /* createdAt is refreshed too, so re-imported products reappear at the top */ }
        }
        await batch.commit();
        done += Math.min(200, todo.length - i);
        setMsg(`Imported ${done} of ${todo.length}...`);
      }
      await revalidateSite();
      try { sessionStorage.removeItem('mz_admin_products'); } catch (_) { /* ignore */ }
      setMsg(`Done: ${done} products are live on the shop${todo.length < picked.length ? ` (${picked.length - todo.length} existing ones skipped)` : ''}. Open Products to check them.`);
    } catch (e) {
      setMsg(e && e.code === 'permission-denied'
        ? 'Permission denied. Publish the updated firestore.rules (it now also contains the productCosts rule) and make sure your admin UID/email is in it.'
        : (e && e.message) || 'Import failed.');
    }
    setBusy(false);
  }

  const totalProfit = picked.reduce((s, p) => s + (p.cost ? p.cost.profit : 0), 0);

  return (
    <div className="min-w-0">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Import products (CSV)</h1>
      <p className="mt-1 text-sm text-dim">Upload a Markaz / Shopify CSV (supplier price) or a Mizanora CSV (final price). Delivery of {formatPKR(SITE.shippingFee || DELIVERY_FEE)} is added at checkout; each product earns Rs {PROFIT_MIN} to {PROFIT_MAX} profit.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className="card mt-4 space-y-3">
        <label className="label" htmlFor="csvf">CSV file</label>
        <input id="csvf" type="file" accept=".csv,text/csv" onChange={onFile} className="input" />
        {fileName && <p className="text-xs text-dim">{fileName}: {list.length} products found ({isMarkaz ? 'supplier export' : 'Mizanora format'}).</p>}
      </div>

      {rows && isMarkaz && (
        <div className="card mt-4">
          <h2 className="text-lg font-extrabold">Profit by supplier price</h2>
          <p className="text-xs text-dim">Shop price = supplier price + profit. Change a row here, or change one product's profit in the table below.</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1">Supplier price includes delivery: subtract Rs <input type="number" min="0" max="1000" className="input !w-20 !py-1.5" value={deduct} onChange={(e) => setDeduct(Math.max(0, Number(e.target.value) || 0))} /></label>
            <label className="flex items-center gap-1">Lowest allowed profit Rs <input type="number" min="0" max={PROFIT_MAX} className="input !w-20 !py-1.5" value={minProfit} onChange={(e) => { const v = Math.max(0, Math.min(PROFIT_MAX, Number(e.target.value) || 0)); setMinProfit(v); setTiers((t) => t.map(([u, p]) => [u, Math.max(p, v)])); }} /></label>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-5">
            {tiers.map(([upTo, pr], n) => (
              <label key={n} className="rounded-xl bg-raised p-2 text-xs">
                <span className="block text-dim">{upTo === Infinity ? 'Above' : 'Up to'} {upTo === Infinity ? formatPKR(tiers[n - 1][0]) : formatPKR(upTo)}</span>
                <span className="mt-1 flex items-center gap-1">Profit Rs <input type="number" min={minProfit} max={PROFIT_MAX} className="input !w-20 !py-1.5" value={pr} onChange={(e) => setTier(n, e.target.value)} /></span>
              </label>
            ))}
          </div>
        </div>
      )}

      {rows && (
        <div className="card mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Show on shop immediately</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Update products that already exist</label>
            {isMarkaz && <label className="flex items-center gap-2"><input type="checkbox" checked={affOn} onChange={(e) => setAffOn(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Workers can earn commission (capped to protect profit)</label>}
            {isMarkaz && <label className="flex items-center gap-2">Featured on home <input type="number" min="0" max="30" className="input !w-16 !py-1.5" value={featured} onChange={(e) => setFeatured(Math.max(0, Number(e.target.value) || 0))} /></label>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-gold" disabled={busy || !picked.length} onClick={run}>{busy ? 'Importing...' : `Import ${picked.length} products`}</button>
            <button type="button" className="btn-ghost" onClick={() => downloadCsv('mizanora-products.csv', productsToCsv(picked))}>Download as Mizanora CSV</button>
            {totalProfit > 0 && <span className="text-xs text-dim">Profit if all sell: {formatPKR(totalProfit)} (delivery excluded)</span>}
          </div>
        </div>
      )}

      {rows && (
        <ul className="mt-4 space-y-2">
          {list.map((p) => {
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
                    <p className="truncate text-xs text-dim">{d.categories.join(', ') || 'No category'} · {d.options.map((o) => `${o.name}: ${o.values.join('/')}`).join(' · ') || 'No options'} · {d.images.length} photos{isOld ? ' · EXISTS' : ' · new'}{p.warn.length ? ` · ${p.warn.join(', ')}` : ''}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-extrabold text-gold">{formatPKR(d.price)}</p>
                    {c && <p className="text-xs text-dim">cost {formatPKR(c.cost)}</p>}
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
        </ul>
      )}
    </div>
  );
}
