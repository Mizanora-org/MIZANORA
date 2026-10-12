'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from './ProductCard';
import { search as trackSearch } from '@/lib/metaPixel';
import { describeIntent, smartSearch } from '@/lib/search';
import { aiIntent } from '@/lib/aiSearch';
import { discountPct, slugify } from '@/lib/format';

// Search, category chips, filters and sorting all run in the browser, so /products stays a fast, fully static (SEO-friendly) page
// and no filter click ever costs a database read.
export default function ProductGrid({ products }) {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp]);
  const [sort, setSort] = useState('new');
  const [cat, setCat] = useState(sp.get('cat') || '');
  const [inStock, setInStock] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState('');
  useEffect(() => { const t = q.trim(); if (t.length < 3) return undefined; const h = setTimeout(() => trackSearch(t), 1200); return () => clearTimeout(h); }, [q]);

  const [ai, setAi] = useState(null);
  const found = useMemo(() => (q.trim() ? smartSearch(products, q, { limit: 500 }) : { results: products, intent: {} }), [products, q]);
  useEffect(() => {
    setAi(null);
    if (q.trim().length < 4 || found.results.length) return undefined;
    let live = true;
    const t = setTimeout(async () => { const i = await aiIntent(q); if (live && i) setAi(smartSearch(products, q, { limit: 500, intent: i })); }, 700);
    return () => { live = false; clearTimeout(t); };
  }, [products, q, found.results.length]);
  const view = ai && ai.results.length ? ai : found;
  const chips = describeIntent(view.intent || {});

  // Category chips are built from the products themselves (a product can appear under several categories).
  const cats = useMemo(() => {
    const m = new Map();
    for (const p of products) for (const name of (p.categories && p.categories.length ? p.categories : [p.category]).filter(Boolean)) {
      const slug = slugify(name);
      const c = m.get(slug) || { slug, name, count: 0 };
      c.count += 1; m.set(slug, c);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [products]);

  const min = Number(minP) || 0;
  const max = Number(maxP) || 0;
  const filtersOn = Boolean(cat || inStock || onSale || min || max);
  const list = useMemo(() => {
    let r = view.results.filter((p) => {
      if (cat && !(p.categories || [p.category]).some((c) => slugify(c) === cat)) return false;
      if (inStock && !p.inStock) return false;
      if (onSale && !(discountPct(p.price, p.comparePrice) > 0)) return false;
      if (min && p.price < min) return false;
      if (max && p.price > max) return false;
      return true;
    });
    if (sort === 'low') r = [...r].sort((a, b) => a.price - b.price);
    if (sort === 'high') r = [...r].sort((a, b) => b.price - a.price);
    if (sort === 'discount') r = [...r].sort((a, b) => discountPct(b.price, b.comparePrice) - discountPct(a.price, a.comparePrice));
    if (sort === 'az') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [view, sort, cat, inStock, onSale, min, max]);
  const clear = () => { setCat(''); setInStock(false); setOnSale(false); setMinP(''); setMaxP(''); };

  const pill = (on) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-gold bg-gold text-white' : 'border-line bg-surface text-dim hover:border-gold hover:text-gold'}`;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search products</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: red suit under 2000, black joota, sasta watch" className="input !pl-10" type="search" />
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input sm:w-52">
            <option value="new">Newest first</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="discount">Biggest discount</option>
            <option value="az">Name: A to Z</option>
          </select>
        </label>
      </div>

      {cats.length > 1 && (
        <div className="no-sb -mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter by category">
          <button type="button" className={pill(!cat)} onClick={() => setCat('')} aria-pressed={!cat}>All</button>
          {cats.map((c) => <button key={c.slug} type="button" className={pill(cat === c.slug)} onClick={() => setCat(cat === c.slug ? '' : c.slug)} aria-pressed={cat === c.slug}>{c.name} <span className="opacity-70">({c.count})</span></button>)}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-dim"><SlidersHorizontal size={15} /> Filters</span>
        <button type="button" className={pill(inStock)} onClick={() => setInStock((v) => !v)} aria-pressed={inStock}>In stock</button>
        <button type="button" className={pill(onSale)} onClick={() => setOnSale((v) => !v)} aria-pressed={onSale}>On sale</button>
        <input type="number" inputMode="numeric" min="0" value={minP} onChange={(e) => setMinP(e.target.value)} placeholder="Min Rs." aria-label="Minimum price" className="input !w-24 !rounded-full !py-1.5 text-sm" />
        <input type="number" inputMode="numeric" min="0" value={maxP} onChange={(e) => setMaxP(e.target.value)} placeholder="Max Rs." aria-label="Maximum price" className="input !w-24 !rounded-full !py-1.5 text-sm" />
        {filtersOn && <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 font-semibold text-red-700"><X size={14} /> Clear</button>}
        <span className="ml-auto text-xs text-faint" aria-live="polite">{list.length} product{list.length === 1 ? '' : 's'}</span>
      </div>

      {chips.length > 0 && <p className="mb-3 flex flex-wrap items-center gap-1.5 text-xs"><span className="font-bold text-gold">Understood:</span>{chips.map((c) => <span key={c} className="rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold">{c}</span>)}</p>}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-dim">
          <p>No products found.</p>
          {filtersOn && <button type="button" onClick={clear} className="btn-ghost mt-3 !py-2 text-sm">Clear filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {list.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
        </div>
      )}
    </div>
  );
}
