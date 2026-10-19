'use client';
import { useEffect, useState } from 'react';
import { REF_DAYS, cleanWorkerCode, sellView } from './workers';

const K = 'mz_ref', KM = 'mz_ref_mk';

export function getRef() {
  try {
    const r = JSON.parse(localStorage.getItem(K) || 'null');
    if (!r || !r.code || Date.now() - r.at > REF_DAYS * 864e5) return '';
    return r.code;
  } catch { return ''; }
}
function read() { try { const m = JSON.parse(localStorage.getItem(KM) || 'null'); return m && m.code === getRef() ? m : null; } catch { return null; } }
export function getMarkups() { const m = read(); return m ? m.map || {} : {}; }
export function getMarkets() { const m = read(); return m ? m.mkt || {} : {}; }
export const getMarkup = (id) => Math.max(0, Number(getMarkups()[id]) || 0);
export const getMarket = (id) => Math.max(0, Number(getMarkets()[id]) || 0);

// What THIS visitor should see for a product: the worker's own price and market rate when they came through a worker link,
// else the shop's normal price and compare price.  -> { price, compare, off, worker }
export function getPricing(id, price, comparePrice = 0) {
  const mk = getMarkup(id), mkt = getMarket(id);
  if (!mk && !mkt) {
    const off = comparePrice > price ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
    return { price, compare: off ? comparePrice : 0, off, worker: false };
  }
  const v = sellView(price, mk, mkt);
  if (v.off) return { price: v.sell, compare: v.market, off: v.off, worker: true };
  const off = comparePrice > v.sell ? Math.round(((comparePrice - v.sell) / comparePrice) * 100) : 0;
  return { price: v.sell, compare: off ? comparePrice : 0, off, worker: true };
}

// Called once per page load: remembers ?ref=CODE and fetches that worker's own prices and market rates.
export async function captureRef() {
  try {
    const q = new URLSearchParams(window.location.search).get('ref');
    const code = cleanWorkerCode(q);
    if (code) {
      localStorage.setItem(K, JSON.stringify({ code, at: Date.now() }));
      if (!sessionStorage.getItem(`mz_c_${code}`)) { sessionStorage.setItem(`mz_c_${code}`, '1'); fetch('/api/worker/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }).catch(() => {}); }
    }
    const cur = getRef();
    if (!cur) return;
    const m = JSON.parse(localStorage.getItem(KM) || 'null');
    if (m && m.code === cur && Date.now() - m.at < 10 * 60 * 1000 && m.mkt) return;
    const r = await fetch(`/api/worker/public?code=${cur}`).then((x) => x.json()).catch(() => null);
    if (r && r.ok) { localStorage.setItem(KM, JSON.stringify({ code: cur, at: Date.now(), map: r.markups || {}, mkt: r.market || {} })); window.dispatchEvent(new Event('mz-ref-prices')); }
    else if (r && r.invalid) { localStorage.removeItem(K); localStorage.removeItem(KM); }
  } catch { /* storage blocked: the shop still works, just without the worker link */ }
}

// For one product page: re-renders with the worker's prices as soon as they are known.
export function useRefPricing(id, price, comparePrice = 0) {
  const [v, setV] = useState({ price, compare: comparePrice > price ? comparePrice : 0, off: comparePrice > price ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0, worker: false });
  useEffect(() => {
    const run = () => setV(getPricing(id, price, comparePrice));
    captureRef().finally(run);
    window.addEventListener('mz-ref-prices', run);
    return () => window.removeEventListener('mz-ref-prices', run);
  }, [id, price, comparePrice]);
  return v;
}

export function useRefMarkup(id) {
  const [v, setV] = useState(0);
  useEffect(() => { captureRef().finally(() => setV(getMarkup(id))); }, [id]);
  return v;
}
