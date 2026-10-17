'use client';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, CornerDownLeft, Search, Tag, X } from 'lucide-react';
import { describeIntent, didYouMean, smartSearch } from '@/lib/search';
import { aiIntent } from '@/lib/aiSearch';
import { getSearchIndex, peekSearchIndex } from '@/lib/searchIndex';
import { formatPKR } from '@/lib/format';
import VoiceButton from './VoiceButton';

// ---------------------------------------------------------------------------------------------
// The search box of the shop.
//
// v18 made it much better to use:
//   * the arrow keys move through the suggestions and Enter opens the highlighted one
//   * the words you typed are highlighted in the product names
//   * a matching category is offered as its own row (so "suit" can open the right shelf)
//   * the number of results is shown, so you know what you will get
//   * the panel scrolls on small screens (before, the results were cut off and could not be reached)
//   * a small (X) clears the box in one tap
//
// The matching itself runs in the browser (lib/search.js): it understands English, Roman Urdu and
// Urdu words, colours, price limits, "cheap / premium" and forgives spelling mistakes.
// ---------------------------------------------------------------------------------------------

/** Wraps the words of the query inside a product name so the shopper sees WHY it matched. */
function Highlight({ text, words }) {
  const name = String(text || '');
  const list = (words || []).filter((w) => w && w.length >= 2);
  if (!list.length) return <>{name}</>;
  // Build one regular expression that catches any of the typed words (case-insensitive).
  const esc = list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(${esc})`, 'gi');
  // Splitting with a capture group puts the matched words at the odd positions.
  const parts = name.split(re);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-saffron/25 px-0.5 text-cream">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

/** The words of the query that are worth highlighting (the stop words are left out). */
function queryWords(q) {
  return String(q || '').toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((w) => w.length >= 3);
}

export default function SearchBox({ id, className = '', categories = [] }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(() => peekSearchIndex());
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);   // which suggestion is highlighted (-1 = none)
  const box = useRef(null);
  const input = useRef(null);
  const router = useRouter();
  const [recent, setRecent] = useState([]);

  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem('mz_recent_q') || '[]').slice(0, 6)); } catch (_) {} }, []);
  const remember = (t) => {
    const term = String(t || '').trim();
    if (term.length < 2) return;
    setRecent((cur) => {
      const next = [term, ...cur.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 6);
      try { localStorage.setItem('mz_recent_q', JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };
  const forget = () => { setRecent([]); try { localStorage.removeItem('mz_recent_q'); } catch (_) {} };

  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setActive(-1); } };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

  const load = () => { if (!list) getSearchIndex().then(setList); };
  const [ai, setAi] = useState(null);
  const dq = useDeferredValue(q); // typing stays instant even on slow phones; matching runs right after
  const local = useMemo(() => (list ? smartSearch(list, dq, { limit: 6 }) : { results: [], intent: {} }), [list, dq]);
  // Nothing found? Ask the optional AI helper to rephrase the sentence (does nothing if no key is set).
  useEffect(() => {
    setAi(null);
    if (!list || q.trim().length < 5 || local.results.length) return undefined;
    let live = true;
    const t = setTimeout(async () => { const i = await aiIntent(q); if (live && i) setAi(smartSearch(list, q, { limit: 6, intent: i })); }, 900);
    return () => { live = false; clearTimeout(t); };
  }, [list, q, local.results.length]);
  const view = ai && ai.results.length ? ai : local;
  const hits = view.results;
  const chips = describeIntent(view.intent || {});

  // A category whose name matches the query: offered as its own row above the products.
  const catHit = useMemo(() => {
    const text = dq.toLowerCase();
    if (text.length < 2) return null;
    const words = queryWords(text);
    if (!words.length) return null;
    const found = categories.find((c) => {
      const n = String(c.name || '').toLowerCase();
      return words.some((w) => n.includes(w) || n.split(/\s+/).some((part) => part.startsWith(w) && w.length >= 3));
    });
    return found || null;
  }, [dq, categories]);

  // The rows the arrow keys walk through: the category (if any), then the products.
  const rows = useMemo(() => {
    const r = [];
    if (catHit) r.push({ kind: 'cat', cat: catHit });
    hits.forEach((p) => r.push({ kind: 'product', p }));
    return r;
  }, [catHit, hits]);

  useEffect(() => { setActive(-1); }, [dq]);

  const openProduct = (p) => { setOpen(false); setActive(-1); router.push(`/product/${p.slug}`); };
  const openCat = (c) => { setOpen(false); setActive(-1); router.push(`/category/${c.slug}`); };
  const go = (e) => {
    if (e) e.preventDefault();
    const text = q.trim();
    // Enter with a highlighted suggestion opens that suggestion; otherwise it runs the search.
    const row = rows[active];
    if (row) {
      if (row.kind === 'cat') openCat(row.cat); else openProduct(row.p);
      return;
    }
    setOpen(false); setActive(-1); remember(text);
    router.push(text ? `/products?q=${encodeURIComponent(text)}` : '/products');
  };

  // ---- the keyboard: up / down / enter / esc
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); load(); return; } setActive((i) => (rows.length ? (i + 1) % rows.length : -1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : -1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
    else if (e.key === 'Enter') { if (open && active >= 0) { e.preventDefault(); go(e); } }
  };

  const clearAll = () => { setQ(''); setActive(-1); setAi(null); if (input.current) input.current.focus(); };

  return (
    <div ref={box} className={`relative ${className}`}>
      <form onSubmit={go} role="search" className="flex">
        <label htmlFor={id} className="sr-only">Search products</label>
        <input
          id={id} ref={input} value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { load(); setOpen(true); }}
          onKeyDown={onKeyDown}
          type="search" autoComplete="off" placeholder="Search for products, brands and more"
          role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={active >= 0 && rows[active] ? `${id}-opt-${active}` : undefined}
          className="min-w-0 flex-1 rounded-l-full border-0 bg-white px-4 py-2.5 text-sm text-cream placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-saffron" />
        {q && <button type="button" onClick={clearAll} aria-label="Clear the search" className="grid w-9 shrink-0 place-items-center bg-white text-faint hover:text-gold"><X size={16} /></button>}
        <VoiceButton className="bg-white pr-1" onText={(t) => { setQ(t); load(); setOpen(true); }} />
        <button type="submit" aria-label="Search" className="rounded-r-full bg-saffron px-4 text-[#2B1B00] hover:brightness-95"><Search size={19} /></button>
      </form>
      {open && (
        <div id={`${id}-list`} role="listbox" aria-label="Search suggestions" className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white text-cream shadow-2xl">
          {q.trim().length < 2 ? (
            <div className="p-3">
              {recent.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-faint"><span className="inline-flex items-center gap-1"><Clock size={13} /> Recent searches</span><button type="button" onClick={forget} className="inline-flex items-center gap-0.5 normal-case text-faint hover:text-red-600"><X size={12} /> Clear</button></p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((t) => <button key={t} type="button" onClick={() => { setQ(t); setOpen(false); remember(t); router.push(`/products?q=${encodeURIComponent(t)}`); }} className="rounded-full border border-line px-3 py-1.5 text-sm text-dim hover:border-gold hover:text-gold">{t}</button>)}
                  </div>
                </div>
              )}
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Popular categories</p>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 8).map((c) => <Link key={c.slug} href={`/category/${c.slug}`} onClick={() => setOpen(false)} className="rounded-full bg-raised px-3 py-1.5 text-sm font-semibold text-dim hover:bg-gold hover:text-white">{c.name}</Link>)}
                <Link href="/products" onClick={() => setOpen(false)} className="rounded-full bg-gold px-3 py-1.5 text-sm font-semibold text-white">All products</Link>
              </div>
            </div>
          ) : !list ? <p className="p-3 text-sm text-dim">Searching...</p> : hits.length === 0 ? (
            <div className="p-3 text-sm text-dim">
              <p>No match for &quot;{q}&quot;.</p>
              {(() => { const m = list ? didYouMean(list, q) : ''; return m ? <p className="mt-1">Did you mean <button type="button" className="font-bold text-gold underline" onClick={() => setQ(m)}>{m}</button>?</p> : null; })()}
              <p className="mt-2">Try another word, <button type="button" className="font-bold text-gold underline" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('mz-assistant', { detail: { q } })); }}>ask our assistant</button>, or <Link href="/products" className="font-bold text-gold" onClick={() => setOpen(false)}>browse all products</Link>.</p>
            </div>
          ) : (
            <ul>
              {chips.length > 0 && <li className="flex flex-wrap items-center gap-1.5 border-b border-line bg-gold/5 px-3 py-2 text-xs"><span className="font-bold text-gold">Understood:</span>{chips.map((c) => <span key={c} className="rounded-full bg-white px-2 py-0.5 font-semibold text-dim">{c}</span>)}</li>}
              {rows.map((row, i) => (
                <li key={row.kind === 'cat' ? `c-${row.cat.slug}` : `p-${row.p.id}`} id={`${id}-opt-${i}`} role="option" aria-selected={active === i}>
                  {row.kind === 'cat' ? (
                    <Link href={`/category/${row.cat.slug}`} onClick={() => setOpen(false)} onMouseEnter={() => setActive(i)} className={`flex items-center gap-3 px-3 py-2.5 ${active === i ? 'bg-raised' : 'hover:bg-raised'}`}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold"><Tag size={16} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{row.cat.name} <span className="font-normal text-faint">category</span></span></span>
                      <span className="text-xs font-bold text-gold">Open shelf</span>
                    </Link>
                  ) : (
                    <Link href={`/product/${row.p.slug}`} onClick={() => setOpen(false)} onMouseEnter={() => setActive(i)} className={`flex items-center gap-3 px-3 py-2 ${active === i ? 'bg-raised' : 'hover:bg-raised'}`}>
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-raised">{row.p.image && <Image src={row.p.image} alt="" fill sizes="44px" className="object-cover" />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold"><Highlight text={row.p.name} words={queryWords(dq)} /></span><span className="text-xs text-faint">{row.p.category}</span></span>
                      <span className="text-sm font-bold text-gold">{formatPKR(row.p.price)}</span>
                    </Link>
                  )}
                </li>
              ))}
              <li>
                <button type="button" onClick={go} className="flex w-full items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-left text-sm font-bold text-gold hover:bg-raised">
                  <span>See all results for &quot;{q}&quot;</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-faint"><CornerDownLeft size={13} /> Enter</span>
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
