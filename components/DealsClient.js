'use client';
import { memo, useCallback, useRef, useState } from 'react';
import ProductCard from './ProductCard';
import { MIN_PCT_CHOICES, SORTS } from '@/lib/deals';

const Card = memo(ProductCard);
const Cards = memo(function Cards({ items }) { return items.map((p, i) => <Card key={p.id} p={p} priority={i < 4} />); });
const Skel = () => (
  <div className="overflow-hidden rounded-xl border border-line bg-surface">
    <div className="mz-skel aspect-square w-full !rounded-none" />
    <div className="space-y-2 p-3"><div className="mz-skel h-3.5 w-4/5 rounded" /><div className="mz-skel h-3.5 w-1/2 rounded" /><div className="mz-skel h-8 w-full rounded-full" /></div>
  </div>
);

// The list of the deals page. The first page comes from the server (so it is in the HTML for Google); filters and "load more" ask /api/deals.
export default function DealsClient({ initial, baseMin = 5 }) {
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [total, setTotal] = useState(initial.total);
  const [chips] = useState(initial.chips || []);
  const [min, setMin] = useState(baseMin);
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('pct');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const seq = useRef(0);

  const fetchPage = useCallback(async (f, cursor) => {
    const q = new URLSearchParams({ min: String(f.min), cat: f.cat, sort: f.sort, cursor });
    const r = await fetch(`/api/deals?${q}`);
    const j = await r.json();
    if (!j || j.ok === false) throw new Error('deals');
    return j;
  }, []);

  const apply = useCallback(async (patch) => {
    const f = { min, cat, sort, ...patch };
    setMin(f.min); setCat(f.cat); setSort(f.sort);
    const my = ++seq.current;
    setBusy(true); setErr(false);
    try { const j = await fetchPage(f, ''); if (my !== seq.current) return; setItems(j.items); setNext(j.next); setTotal(j.total); }
    catch { if (my === seq.current) setErr(true); }
    if (my === seq.current) setBusy(false);
  }, [min, cat, sort, fetchPage]);

  const more = async () => {
    if (!next || busy) return;
    const my = ++seq.current;
    setBusy(true); setErr(false);
    try { const j = await fetchPage({ min, cat, sort }, next); if (my !== seq.current) return; setItems((c) => { const seen = new Set(c.map((x) => x.id)); return [...c, ...j.items.filter((x) => !seen.has(x.id))]; }); setNext(j.next); }
    catch { if (my === seq.current) setErr(true); }
    if (my === seq.current) setBusy(false);
  };

  const chip = (on) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${on ? 'border-gold bg-gold text-white' : 'border-line bg-surface text-dim hover:border-gold'}`;
  return (
    <div>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
        <ul className="no-sb flex gap-2 overflow-x-auto" aria-label="Minimum discount">
          <li className="shrink-0 self-center text-xs font-bold text-faint">Discount:</li>
          {[baseMin, ...MIN_PCT_CHOICES.filter((n) => n > baseMin)].map((n) => <li key={n}><button type="button" className={chip(min === n)} onClick={() => apply({ min: n })}>{n === baseMin ? 'All deals' : `${n}%+ off`}</button></li>)}
          <li className="ml-auto shrink-0">
            <select aria-label="Sort deals" className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold" value={sort} onChange={(e) => apply({ sort: e.target.value })}>
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </li>
        </ul>
        {chips.length > 1 && (
          <ul className="no-sb mt-2 flex gap-2 overflow-x-auto" aria-label="Deals by category">
            <li><button type="button" className={chip(cat === '')} onClick={() => apply({ cat: '' })}>All categories</button></li>
            {chips.map((c) => <li key={c.slug}><button type="button" className={chip(cat === c.slug)} onClick={() => apply({ cat: c.slug })}>{c.name} <span className="opacity-70">{c.count}</span></button></li>)}
          </ul>
        )}
      </div>

      <p className="mb-3 mt-4 text-sm text-dim" aria-live="polite">{busy && !items.length ? 'Loading deals...' : `${total} ${total === 1 ? 'deal' : 'deals'} found`}</p>
      <div className={`grid grid-cols-2 gap-2.5 transition-opacity sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${busy && items.length ? 'opacity-60' : ''}`}>
        <Cards items={items} />
        {busy && !items.length && Array.from({ length: 8 }, (_, n) => <Skel key={n} />)}
      </div>
      {!busy && !items.length && !err && <p className="rounded-2xl bg-raised p-6 text-center text-dim">Is filter par abhi koi deal nahi. Doosra discount ya category chun kar dekhein.</p>}
      {err && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-center text-sm text-red-700">Deals load nahi ho sakin. <button type="button" className="font-bold underline" onClick={() => apply({})}>Dobara koshish</button></p>}
      {next && <div className="mt-6 text-center"><button type="button" onClick={more} disabled={busy} className="btn-gold">{busy ? 'Loading...' : 'Show more deals'}</button></div>}
    </div>
  );
}
