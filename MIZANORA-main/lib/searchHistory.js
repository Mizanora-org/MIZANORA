const KEY = 'mz_recent_q';
export const getRecentQueries = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export function addRecentQuery(q) {
  const t = String(q || '').trim().slice(0, 60);
  if (t.length < 2) return;
  try { localStorage.setItem(KEY, JSON.stringify([t, ...getRecentQueries().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6))); } catch (_) {}
}
export const clearRecentQueries = () => { try { localStorage.removeItem(KEY); } catch (_) {} };

// Tells the shop owner what people searched for (and could not find). Anonymous: only the words, no personal data.
const sent = new Set();
export function logSearch(q, results) {
  const t = String(q || '').trim().toLowerCase().slice(0, 60);
  if (t.length < 3 || sent.has(`${t}|${results ? 1 : 0}`)) return;
  sent.add(`${t}|${results ? 1 : 0}`);
  try {
    const body = JSON.stringify({ q: t, found: results > 0 });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/search-log', new Blob([body], { type: 'application/json' }));
    else fetch('/api/search-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch (_) {}
}
