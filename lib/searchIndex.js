// ONE shared loader for the small product list used by search suggestions and "Recently viewed".
// It is fetched at most once per visit (kept in memory + sessionStorage for 10 minutes), so opening the search box
// on several pages never calls the server again and never touches Firestore.
const KEY = 'mz_si_v1';
const TTL = 10 * 60 * 1000;
let mem = null;
let inflight = null;

export const peekSearchIndex = () => mem;

export function getSearchIndex() {
  if (mem) return Promise.resolve(mem);
  try {
    const j = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (j && Array.isArray(j.v) && Date.now() - j.t < TTL) { mem = j.v; return Promise.resolve(mem); }
  } catch (_) { /* no storage: just fetch */ }
  if (!inflight) {
    inflight = fetch('/api/search-index')
      .then((r) => { if (!r.ok) throw new Error('index'); return r.json(); })
      .then((v) => {
        mem = Array.isArray(v) ? v : [];
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v: mem })); } catch (_) { /* too big or blocked */ }
        return mem;
      })
      .catch(() => { inflight = null; return []; }); // a failure is not remembered, the next tap tries again
  }
  return inflight;
}
