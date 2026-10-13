'use client';
import { useEffect, useState } from 'react';
import { REF_DAYS, cleanWorkerCode } from './workers';

const K = 'mz_ref', KM = 'mz_ref_mk';

export function getRef() {
  try {
    const r = JSON.parse(localStorage.getItem(K) || 'null');
    if (!r || !r.code || Date.now() - r.at > REF_DAYS * 864e5) return '';
    return r.code;
  } catch { return ''; }
}
export function getMarkups() {
  try { const m = JSON.parse(localStorage.getItem(KM) || 'null'); return m && m.code === getRef() ? m.map || {} : {}; } catch { return {}; }
}
export const getMarkup = (id) => Math.max(0, Number(getMarkups()[id]) || 0);

// Called once per page load: remembers ?ref=CODE and fetches that worker's own prices (Elite workers only).
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
    if (m && m.code === cur && Date.now() - m.at < 10 * 60 * 1000) return;
    const r = await fetch(`/api/worker/public?code=${cur}`).then((x) => x.json()).catch(() => null);
    if (r && r.ok) localStorage.setItem(KM, JSON.stringify({ code: cur, at: Date.now(), map: r.markups || {} }));
    else if (r && r.invalid) { localStorage.removeItem(K); localStorage.removeItem(KM); }
  } catch { /* storage blocked: the shop still works, just without the worker link */ }
}

export function useRefMarkup(id) {
  const [v, setV] = useState(0);
  useEffect(() => { captureRef().finally(() => setV(getMarkup(id))); }, [id]);
  return v;
}
