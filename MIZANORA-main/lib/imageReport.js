// Browser side of the "broken photo" safety net. A photo that does not load is reported ONCE per visit; the server then checks the
// photo itself (it never trusts the report) and, when it is really broken, removes it / hides the product and lists it in Admin > Photo errors.
const seen = new Set();

export async function reportBrokenImage(slug) {
  const s = String(slug || '');
  if (!s || seen.has(s)) return null;
  seen.add(s);
  try {
    const key = `mz_imgrep_${s}`;
    if (sessionStorage.getItem(key)) return null;
    sessionStorage.setItem(key, '1');
  } catch (_) { /* no storage: the in-memory set still stops repeats */ }
  try {
    const r = await fetch('/api/image-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: s }), keepalive: true });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

// Hides a product card that was removed because its photos do not work (also its slide wrapper on the home page shelves).
export function hideCard(card) {
  if (!card) return;
  const w = card.parentElement;
  const target = w && w.children.length === 1 && w.className && /shrink-0/.test(String(w.className)) ? w : card;
  target.style.display = 'none';
}
