'use client';
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from './ProductCard';

const Card = memo(ProductCard);
// The list of cards only re-renders when the visible products really change (not on every key press or filter tap).
const Cards = memo(function Cards({ items }) {
  return items.map((p, i) => <Card key={p.id} p={p} priority={i < 4} />);
});

// A placeholder card, shown while the next page of a big catalogue is loading (v18: a real skeleton
// instead of a line of text, so the page does not jump when the products arrive).
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="mz-skel aspect-square w-full !rounded-none" />
      <div className="space-y-2 p-3">
        <div className="mz-skel h-3.5 w-4/5 rounded" />
        <div className="mz-skel h-3.5 w-1/2 rounded" />
        <div className="mz-skel h-4 w-1/3 rounded" />
        <div className="mz-skel h-8 w-full rounded-full" />
      </div>
    </div>
  );
}
import VoiceButton from './VoiceButton';
import { search as trackSearch } from '@/lib/metaPixel';
import { trackEvent } from '@/lib/track';
import { describeIntent, didYouMean, smartSearch } from '@/lib/search';
import { aiAvailable, aiIntent } from '@/lib/aiSearch';
import { discountPct, slugify } from '@/lib/format';

// Search, category chips, filters and sorting all run in the browser, so /products stays a fast, fully static (SEO-friendly) page
// and no filter click ever costs a database read.
// REMOTE MODE (remote=true) is for shops with lakhs of products: the browser holds only the first page, and search, categories,
// sorting and the budget filters ask the server (/api/search, /api/browse), which reads Firestore page by page and caches the answers.
const PAGE_REMOTE = 48;
export default function ProductGrid({ products, remote = false, total = 0, initialNext = '', baseCat = '', chips = null }) {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp]);
  const [sortPick, setSort] = useState(''); // '' = automatic: cheapest first while browsing, best match first while searching
  const [cat, setCat] = useState(sp.get('cat') || baseCat || '');
  const [inStock, setInStock] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState(sp.get('max') || '');
  useEffect(() => { const t = q.trim(); if (t.length < 3) return undefined; const h = setTimeout(() => { trackSearch(t); }, 1200); return () => clearTimeout(h); }, [q]);

  const [ai, setAi] = useState(null);
  // The box always stays instant; matching runs right after typing (useDeferredValue) and never blocks the keyboard.
  const dq = useDeferredValue(q);
  const found = useMemo(() => (dq.trim() ? smartSearch(products, dq, { limit: 500 }) : { results: products, intent: {}, exact: true }), [products, dq]);
  // AI help only when the free search is weak (nothing found, or a long sentence where no product matches every word).
  const weak = dq.trim().length >= 5 && (found.results.length === 0 || (!found.exact && ((found.intent && found.intent.words) || []).length >= 2));
  useEffect(() => {
    setAi(null);
    if (remote || !weak || !aiAvailable()) return undefined;
    let live = true;
    const t = setTimeout(async () => { const i = await aiIntent(dq); if (live && i) setAi(smartSearch(products, dq, { limit: 500, intent: i })); }, 700);
    return () => { live = false; clearTimeout(t); };
  }, [products, dq, weak, remote]);
  const view = ai && ai.results.length ? ai : found;

  // Category chips are built from the products themselves (a product can appear under several categories).
  const cats = useMemo(() => {
    if (chips) return chips;
    const m = new Map();
    for (const p of products) for (const name of (p.categories && p.categories.length ? p.categories : [p.category]).filter(Boolean)) {
      const slug = slugify(name);
      const c = m.get(slug) || { slug, name, count: 0 };
      c.count += 1; m.set(slug, c);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [products, chips]);

  const min = Number(minP) || 0;
  const max = Number(maxP) || 0;
  const filtersOn = Boolean(cat || inStock || onSale || min || max);
  // Buttons and inputs react instantly; the (heavier) list is recomputed right after, from the deferred copy of the filters.
  const sort = sortPick || (q.trim() ? 'new' : 'low');
  const fv = useMemo(() => ({ cat, inStock, onSale, min, max, sort }), [cat, inStock, onSale, min, max, sort]);
  const df = useDeferredValue(fv);
  const suggest = useMemo(() => (!remote && dq.trim().length >= 4 && found.results.length === 0 ? didYouMean(products, dq) : ''), [remote, products, dq, found.results.length]);

  // ---- remote mode: the server returns the products ----
  const [rItems, setRItems] = useState(products);
  const [rNext, setRNext] = useState(initialNext);
  const [rBusy, setRBusy] = useState(false);
  const [rAi, setRAi] = useState([]);
  const apiSort = df.sort === 'high' ? 'high' : df.sort === 'new' ? (dq.trim() ? '' : 'new') : 'low';
  const qs = (o) => Object.entries(o).filter(([, v]) => v !== '' && v !== 0 && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const sig = `${dq.trim()}|${df.cat}|${df.min}|${df.max}|${apiSort}`;
  const firstSig = useRef(true);
  useEffect(() => {
    if (!remote) return undefined;
    if (firstSig.current) { firstSig.current = false; if (!dq.trim() && df.cat === (baseCat || '') && !df.min && !df.max && apiSort === 'low') return undefined; } // the server already sent this first page
    const ctl = new AbortController();
    const run = async () => {
      setRBusy(true); setRAi([]);
      try {
        const text = dq.trim();
        if (text.length >= 2) {
          const r = await fetch(`/api/search?${qs({ q: text, cat: df.cat, sort: apiSort === 'new' ? '' : apiSort, min: df.min, max: df.max })}`, { signal: ctl.signal });
          let d = r.ok ? await r.json() : { items: [] };
          if (!(d.items || []).length && text.length >= 5 && aiAvailable()) {
            const i = await aiIntent(text);
            if (i && !ctl.signal.aborted) {
              const r2 = await fetch(`/api/search?${qs({ q: text, w: (i.words || []).join(','), c: (i.colors || []).join(','), cat: df.cat, sort: i.sort === 'new' ? '' : (apiSort === 'new' ? i.sort : apiSort), min: df.min || i.min, max: df.max || i.max })}`, { signal: ctl.signal });
              if (r2.ok) { d = await r2.json(); setRAi(describeIntent(i)); }
            }
          }
          if (!ctl.signal.aborted) { setRItems(d.items || []); setRNext(''); }
        } else {
          const r = await fetch(`/api/browse?${qs({ cat: df.cat, sort: apiSort || 'low', min: df.min, max: df.max })}`, { signal: ctl.signal });
          const d = r.ok ? await r.json() : { items: [], next: '' };
          if (!ctl.signal.aborted) { setRItems(d.items || []); setRNext(d.next || ''); }
        }
      } catch (_) { /* aborted or offline: keep what is shown */ }
      if (!ctl.signal.aborted) setRBusy(false);
    };
    const t = setTimeout(run, dq.trim() ? 350 : 0);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [remote, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = async () => {
    if (!remote || !rNext || rBusy) return;
    setRBusy(true);
    try {
      const r = await fetch(`/api/browse?${qs({ cat: df.cat, sort: apiSort || 'low', min: df.min, max: df.max, cursor: rNext })}`);
      const d = r.ok ? await r.json() : { items: [], next: '' };
      setRItems((cur) => { const have = new Set(cur.map((p) => p.id)); return [...cur, ...(d.items || []).filter((p) => !have.has(p.id))]; });
      setRNext(d.next || '');
    } catch (_) { /* try again on the next scroll */ }
    setRBusy(false);
  };

  const understood = remote ? rAi : describeIntent(view.intent || {});
  const list = useMemo(() => {
    let r = (remote ? rItems : view.results).filter((p) => {
      if (df.cat && !(p.categories || [p.category]).some((c) => slugify(c) === df.cat)) return false;
      if (df.inStock && !p.inStock) return false;
      if (df.onSale && !(discountPct(p.price, p.comparePrice) > 0)) return false;
      if (df.min && p.price < df.min) return false;
      if (df.max && p.price > df.max) return false;
      return true;
    });
    if (df.sort === 'low') r = [...r].sort((a, b) => a.price - b.price);
    if (df.sort === 'high') r = [...r].sort((a, b) => b.price - a.price);
    if (df.sort === 'discount') r = [...r].sort((a, b) => discountPct(b.price, b.comparePrice) - discountPct(a.price, a.comparePrice));
    if (df.sort === 'az') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [view, df, remote, rItems]);

  // Search statistics for Admin > Dashboard (what people look for, and what they look for without finding anything).
  const lastSearch = useRef('');
  useEffect(() => {
    const t = dq.trim().toLowerCase();
    if (t.length < 3 || (remote && rBusy)) return undefined;
    const h = setTimeout(() => { if (lastSearch.current !== t) { lastSearch.current = t; trackEvent(list.length ? 'q' : 'q0', t); } }, 1800);
    return () => clearTimeout(h);
  }, [dq, list.length, remote, rBusy]);
  // Draw 24 cards first and more as the shopper scrolls: a big catalogue no longer freezes weak phones.
  const PAGE = 24;
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef(null);
  useEffect(() => { setShown(PAGE); }, [list]);
  const moreHere = remote ? Boolean(rNext) : shown < list.length;
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !moreHere || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { if (remote) loadMoreRef.current(); else setShown((n) => n + PAGE); } }, { rootMargin: '700px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, list.length, moreHere, remote, rNext]);
  const visible = useMemo(() => (remote ? list : list.slice(0, shown)), [list, shown, remote]);
  const clear = () => { setCat(baseCat || ''); setInStock(false); setOnSale(false); setMinP(''); setMaxP(''); };
  // One line that tells the shopper exactly what they are looking at (v18: the search word is in it).
  const countText = remote
    ? (rBusy && !list.length ? 'Loading...' : !dq.trim() && !filtersOn && total ? `${total.toLocaleString('en-PK')} products` : `${list.length}${rNext ? '+' : ''} product${list.length === 1 ? '' : 's'}`)
    : `${list.length} product${list.length === 1 ? '' : 's'}`;

  const pill = (on) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-gold bg-gold text-white' : 'border-line bg-surface text-dim hover:border-gold hover:text-gold'}`;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label>
            <span className="sr-only">Search products</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: red suit under 2000, black joota, sasta watch" className="input !pl-10 !pr-24" type="search" />
          </label>
          <VoiceButton className="absolute right-1.5 top-1/2 -translate-y-1/2" onText={setQ} />
        </div>
        <label>
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input sm:w-52">
            <option value="new">{q.trim() ? 'Best match first' : 'Newest first'}</option>
            <option value="low">Price: low to high (cheapest first)</option>
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
        {[500, 1000, 2000, 5000].map((n) => <button key={n} type="button" className={pill(maxP === String(n))} onClick={() => setMaxP(maxP === String(n) ? '' : String(n))} aria-pressed={maxP === String(n)}>Under {n}</button>)}
        {filtersOn && <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 font-semibold text-red-700"><X size={14} /> Clear</button>}
        <span className="ml-auto flex items-center gap-2 text-xs text-faint" aria-live="polite">
          {/* v18: the search word is shown with the number, so the shopper never wonders what is on screen */}
          {dq.trim() && <span className="max-w-[14rem] truncate rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold">for &quot;{dq.trim()}&quot;</span>}
          {countText}
          {dq.trim() && <button type="button" onClick={() => setQ('')} className="rounded-full p-1 text-faint hover:text-gold" aria-label="Clear the search"><X size={13} /></button>}
        </span>
      </div>

      {understood.length > 0 && <p className="mb-3 flex flex-wrap items-center gap-1.5 text-xs"><span className="font-bold text-gold">Understood:</span>{understood.map((c) => <span key={c} className="rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold">{c}</span>)}</p>}
      {list.length === 0 && remote && rBusy ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5" aria-label="Loading products" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-dim">
          <p className="font-display text-lg font-bold text-cream">
            {dq.trim() ? <>No product matches &quot;{dq.trim()}&quot;</> : 'No products found.'}
          </p>
          {dq.trim() && (suggest ? <p className="mt-2 text-sm">Did you mean <button type="button" className="font-bold text-gold underline" onClick={() => setQ(suggest)}>{suggest}</button>?</p> : null)}
          {dq.trim() && <p className="mt-2 text-sm">Try a shorter word, or a colour and a price (for example &quot;black shoes under 3000&quot;).</p>}
          {dq.trim() && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('mz-assistant', { detail: { q: dq } }))} className="btn-ghost mt-3 !py-2 text-sm">Ask our assistant to find it</button>}
          {filtersOn && <button type="button" onClick={clear} className="btn-ghost mt-3 !py-2 text-sm">Clear filters</button>}
          {/* v18: offer the shelves instead of a dead end */}
          {cats.length > 1 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Browse a shelf instead</p>
              <div className="flex flex-wrap justify-center gap-2">
                {cats.slice(0, 10).map((c) => (
                  <button key={c.slug} type="button" onClick={() => setCat(c.slug)} className="rounded-full border border-line bg-raised px-3 py-1.5 text-sm font-semibold text-dim hover:border-gold hover:text-gold">
                    {c.name} <span className="opacity-70">({c.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          <Cards items={visible} />
        </div>
      )}
      {moreHere && (
        <div ref={sentinel} className="mt-6 text-center">
          <button type="button" onClick={() => (remote ? loadMore() : setShown((n) => n + PAGE))} className="btn-ghost !py-2.5 text-sm">{remote ? (rBusy ? 'Loading...' : 'Show more products') : `Show more (${list.length - shown} left)`}</button>
        </div>
      )}
    </div>
  );
}
