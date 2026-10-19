// Optional: asks /api/ai-search to understand a sentence. Returns null when AI is not set up or is resting (the normal search still works).
// RATE-LIMIT SAVERS in the browser: answers are remembered for 7 days (localStorage), identical questions in flight share one request,
// and after a "slow down" answer the browser stops asking for a while.
const KEY = 'mz_ai_q_v2';
const MAX = 150;
const WEEK = 7 * 24 * 3600e3;
const mem = new Map();
const inflight = new Map();
let offUntil = 0;

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
function load() {
  if (mem.size) return;
  try { const j = JSON.parse(localStorage.getItem(KEY) || '[]'); const t = Date.now(); j.forEach(([k, v, at]) => { if (t - at < WEEK) mem.set(k, { v, at }); }); } catch (_) { /* no storage */ }
}
function save() {
  try {
    const rows = [...mem.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX).map(([k, x]) => [k, x.v, x.at]);
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch (_) { /* full or blocked */ }
}

export const aiAvailable = () => Date.now() >= offUntil;

export async function aiIntent(q) {
  const k = norm(q);
  if (k.length < 3) return null;
  load();
  const hit = mem.get(k);
  if (hit) return hit.v;
  if (!aiAvailable()) return null;
  if (inflight.has(k)) return inflight.get(k);
  const job = (async () => {
    try {
      const r = await fetch('/api/ai-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: k }) });
      if (r.status === 429) { const d = await r.json().catch(() => ({})); offUntil = Date.now() + Math.max(20, Number(d.wait) || 45) * 1000; return null; }
      if (r.status === 501) { offUntil = Date.now() + 30 * 60e3; return null; } // AI not set up: do not ask again soon
      if (!r.ok) { offUntil = Date.now() + 15e3; return null; }
      const d = await r.json();
      if (d.ok && d.intent) { mem.set(k, { v: d.intent, at: Date.now() }); save(); return d.intent; }
    } catch (_) { /* no AI available */ }
    return null;
  })().finally(() => inflight.delete(k));
  inflight.set(k, job);
  return job;
}
