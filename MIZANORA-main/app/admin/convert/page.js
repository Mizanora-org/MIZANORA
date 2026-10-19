'use client';
import { useMemo, useState } from 'react';
import { formatPKR } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { PROFIT_MAX, PROFIT_MIN, PROFIT_TIERS, buildProducts, clampProfit, detectFormat, parseCsv, productsToCsv, profitFor, safeAffRate, shopPrice, slugOf } from '@/lib/importProducts';

// Admin > Converter. Takes a product CSV from ANY platform (Markaz, Shopify, WooCommerce, Daraz export, HHC, a supplier's Excel saved as CSV ...),
// lets you point each of our fields at a column (guessed automatically), adds your profit, and downloads a CSV in Mizanora format
// that the Import page reads directly. Nothing is sent anywhere: the file is converted inside your browser.
const FIELDS = [
  ['name', 'Product name *', /^(title|name|product[\s_-]*name|product|item[\s_-]*name|item)$/i],
  ['cost', 'Price column *', /(wholesale|supplier|cost|variant[\s_-]*price|regular[\s_-]*price|^price|sale[\s_-]*price|rate|amount)/i],
  ['category', 'Category', /(categor|product[\s_-]*type|^type$|collection|department)/i],
  ['description', 'Description', /(descri|body|detail|about)/i],
  ['sku', 'SKU / code', /(sku|code|barcode|item[\s_-]*id|^id$)/i],
  ['stock', 'Stock quantity', /(stock|qty|quantity|inventory|available)/i],
  ['compare', 'Old / compare price', /(compare|mrp|old[\s_-]*price|original|list[\s_-]*price)/i],
  ['size', 'Sizes (comma separated)', /(^size|sizes)/i],
  ['color', 'Colours (comma separated)', /(colou?r)/i],
];
const URL_RE = /https?:\/\/[^\s,;|"'<>]+/g;
const num = (v) => { const n = Number(String(v || '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
const list = (v) => [...new Set(String(v || '').split(/\s*(?:,|;|\|\||\||\n)\s*/).map((x) => x.trim()).filter(Boolean))].slice(0, 20);
const clean = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export default function Converter() {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [map, setMap] = useState({});
  const [imgCols, setImgCols] = useState([]);
  const [isCost, setIsCost] = useState(true);
  const [tiers, setTiers] = useState(PROFIT_TIERS.map((t) => [...t]));
  const [minProfit, setMinProfit] = useState(PROFIT_MIN);
  const [deduct, setDeduct] = useState(0);
  const [msg, setMsg] = useState('');
  const headers = rows && rows[0] ? Object.keys(rows[0]) : [];
  const native = rows ? detectFormat(rows) : '';

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setMsg('');
    try {
      const parsed = parseCsv(await f.text());
      if (!parsed.length) { setMsg('No rows found in this file.'); return; }
      const keys = Object.keys(parsed[0]);
      const m = {};
      for (const [k, , re] of FIELDS) { const hit = keys.find((h) => re.test(h.trim())); if (hit) m[k] = hit; }
      // the price column: prefer a wholesale / cost column over a plain price
      const wc = keys.find((h) => /(wholesale|supplier|cost)/i.test(h)); if (wc) m.cost = wc;
      setMap(m); setImgCols(keys.filter((h) => /(image|photo|picture|img)/i.test(h)).slice(0, 8));
      setRows(parsed); setFileName(f.name);
    } catch (err) { setMsg((err && err.message) || 'Could not read the file.'); }
    e.target.value = '';
  }

  const built = useMemo(() => {
    if (!rows) return [];
    if (native === 'markaz') return buildProducts(rows, { tiers, minProfit, deduct, publish: true, affOn: true, featuredCount: 0 }).products;
    if (native === 'mizanora' && !map.name) return buildProducts(rows, {}).products;
    if (!map.name || !map.cost) return [];
    const used = new Set();
    const out = [];
    for (const r of rows) {
      const name = clean(r[map.name]);
      let cost = num(r[map.cost]) - (isCost ? deduct : 0);
      if (!name || cost <= 0) continue;
      let slug = slugOf(name) || 'product', n = 2;
      while (used.has(slug)) slug = `${slugOf(name)}-${n++}`;
      used.add(slug);
      const profit = isCost ? profitFor(cost, tiers, minProfit) : 0;
      const price = isCost ? shopPrice(cost, profit, minProfit) : Math.round(cost);
      const images = [...new Set(imgCols.flatMap((c) => String(r[c] || '').match(URL_RE) || []))].slice(0, 12);
      const options = [];
      if (map.size && r[map.size]) options.push({ name: 'Size', values: list(r[map.size]) });
      if (map.color && r[map.color]) options.push({ name: 'Color', values: list(r[map.color]) });
      const stockCell = map.stock ? String(r[map.stock] || '').trim() : '';
      const compare = map.compare ? num(r[map.compare]) : 0;
      out.push({
        slug, warn: images.length ? [] : ['no photo'],
        doc: { name, price, comparePrice: compare > price ? compare : 0, category: clean(r[map.category] || '').split(/[,>/]/)[0].trim(), categories: map.category ? list(clean(r[map.category])).slice(0, 3) : [], description: clean(r[map.description] || '').slice(0, 4000), images, videos: [], options, specs: [], inStock: stockCell === '' ? true : !/^(0|no|false|out)/i.test(stockCell), featured: false, active: true, affOn: isCost, affRate: isCost ? safeAffRate(price, profit) : 0 },
        cost: isCost ? { cost, profit: price - cost, supplierSku: map.sku ? String(r[map.sku] || '') : '', sourceUrl: '' } : null,
      });
    }
    return out;
  }, [rows, map, imgCols, isCost, tiers, minProfit, deduct, native]);

  const ok = built.length > 0;
  const noPhoto = built.filter((p) => !p.doc.images.length).length;
  const sel = (k) => (
    <select className="input !py-1.5" value={map[k] || ''} onChange={(e) => setMap((m) => ({ ...m, [k]: e.target.value }))}>
      <option value="">(none)</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
    </select>
  );

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">CSV converter</h1>
        <p className="mt-1 text-sm text-dim">Any platform&apos;s product CSV in, a Mizanora CSV out (with your profit added). Then open <b>Import CSV</b> and upload the new file. It all happens in your browser.</p>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}
      <div className="card space-y-2">
        <label className="label" htmlFor="cf">Product CSV from any platform</label>
        <input id="cf" type="file" accept=".csv,text/csv" onChange={onFile} className="input" />
        {rows && <p className="text-xs text-dim">{fileName}: {rows.length.toLocaleString()} rows, {headers.length} columns{native === 'markaz' ? '. This is a Markaz / Shopify file: it is read by the built-in rules (variants, options, photos).' : native === 'mizanora' && !map.name ? '. This already is a Mizanora file.' : '.'}</p>}
      </div>

      {rows && native !== 'markaz' && (
        <div className="card space-y-3">
          <h2 className="text-lg font-extrabold">Match the columns</h2>
          <div className="grid gap-2 sm:grid-cols-2">{FIELDS.map(([k, l]) => <label key={k} className="text-sm"><span className="label">{l}</span>{sel(k)}</label>)}</div>
          <div>
            <span className="label">Photo columns (links are found automatically, any separator)</span>
            <div className="mt-1 flex flex-wrap gap-2">{headers.map((h) => <label key={h} className={`cursor-pointer rounded-full px-3 py-1 text-xs ${imgCols.includes(h) ? 'bg-gold text-white' : 'bg-raised text-dim'}`}><input type="checkbox" className="sr-only" checked={imgCols.includes(h)} onChange={(e) => setImgCols((c) => (e.target.checked ? [...c, h] : c.filter((x) => x !== h)))} />{h}</label>)}</div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={isCost} onChange={(e) => setIsCost(e.target.checked)} /> The price column is my <b>supplier cost</b> (add my profit). Untick if it is already the final shop price.</label>
        </div>
      )}

      {rows && (native === 'markaz' || isCost) && (
        <div className="card">
          <h2 className="text-lg font-extrabold">Profit table</h2>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1">Subtract delivery included in supplier price: Rs <input type="number" min="0" className="input !w-20 !py-1.5" value={deduct} onChange={(e) => setDeduct(Math.max(0, Number(e.target.value) || 0))} /></label>
            <label className="flex items-center gap-1">Lowest profit Rs <input type="number" min="0" max={PROFIT_MAX} className="input !w-20 !py-1.5" value={minProfit} onChange={(e) => setMinProfit(Math.max(0, Math.min(PROFIT_MAX, Number(e.target.value) || 0)))} /></label>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {tiers.map(([upTo, pr], n) => (
              <label key={n} className="rounded-xl bg-raised p-2 text-xs"><span className="block text-dim">{upTo === Infinity ? 'Above' : 'Up to'} {upTo === Infinity ? formatPKR(tiers[n - 1][0]) : formatPKR(upTo)}</span>
                <span className="mt-1 flex items-center gap-1">Profit Rs <input type="number" min={minProfit} max={PROFIT_MAX} className="input !w-16 !py-1.5" value={pr} onChange={(e) => setTiers((t) => t.map((r, i) => (i === n ? [r[0], clampProfit(e.target.value, minProfit)] : r)))} /></span></label>
            ))}
          </div>
        </div>
      )}

      {rows && (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-gold" disabled={!ok} onClick={() => { downloadCsv('mizanora-converted.csv', productsToCsv(built)); setMsg(`Downloaded ${built.length.toLocaleString()} products. Next: Admin > Import CSV > choose this file.`); }}>Download Mizanora CSV ({built.length.toLocaleString()} products)</button>
            {!ok && <span className="text-sm text-dim">Choose the <b>Product name</b> and <b>Price</b> columns first.</span>}
            {noPhoto > 0 && <span className="text-xs text-amber-700">{noPhoto} products have no photo (they will be hidden on import).</span>}
          </div>
          {ok && (
            <ul className="max-h-96 divide-y divide-line overflow-auto text-sm">
              {built.slice(0, 40).map((p) => (
                <li key={p.slug} className="flex items-center gap-3 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.doc.images[0] ? <img src={p.doc.images[0]} alt="" className="h-10 w-10 rounded bg-raised object-cover" loading="lazy" /> : <span className="h-10 w-10 rounded bg-raised" />}
                  <span className="min-w-0 flex-1 truncate">{p.doc.name}<span className="block truncate text-xs text-dim">{p.doc.categories.join(', ') || 'no category'} · {p.doc.images.length} photos{p.doc.options.length ? ` · ${p.doc.options.map((o) => o.name).join('/')}` : ''}</span></span>
                  <span className="text-right"><b className="text-gold">{formatPKR(p.doc.price)}</b>{p.cost && <span className="block text-xs text-dim">cost {formatPKR(p.cost.cost)}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
