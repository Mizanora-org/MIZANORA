import { adminRtdb } from './firebase-admin';
import { rtdbOn } from './rtdb';
import { slugify } from './format';

// WHAT THIS SHOPPER LIKES (assistant memory). Kept in the Realtime Database (its own free quota, no read/write counters)
// under aiPrefs/<device id>, so the assistant can say "aap ko pehle silky kurtiyan pasand aayi thi" and show those first -
// even when the shopper asks nothing specific. The device id is made up by the browser (localStorage) and carries no name,
// no phone, no account: it only groups one phone's chats. Everything is also mirrored into the browser's localStorage by
// the assistant panel, and the home page "Aap ke liye" shelf reads that copy (server never needs it for that).
export const prefKeyOf = (did) => String(did || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
const MAX_CATS = 10;

export async function readPrefs(did) {
  const k = prefKeyOf(did);
  if (!k || !rtdbOn()) return null;
  try { return (await adminRtdb().ref(`aiPrefs/${k}`).get()).val(); } catch { return null; }
}

export async function writePrefs(did, prefs) {
  const k = prefKeyOf(did);
  if (!k || !rtdbOn()) return;
  try { await adminRtdb().ref(`aiPrefs/${k}`).set({ ...prefs, at: Date.now() }); } catch { /* never break a chat over this */ }
}

// Counts a category every time the shopper's words look like it ("kurti", "joota", "watch"...).
// cats = [{ name, slug }] of the WHOLE shop (live + archived), so even a 50,000-product shop matches.
export function learnFrom(old, texts, cats) {
  const p = old && typeof old === 'object' ? { cats: { ...(old.cats || {}) }, asks: Number(old.asks) || 0 } : { cats: {}, asks: 0 };
  p.asks += texts.length;
  const blob = ` ${texts.join(' ').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')} `;
  for (const c of cats || []) {
    const slug = c.slug || slugify(c.name);
    if (!slug || !c.name) continue;
    const bare = String(c.name).toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((w) => w.length >= 4);
    if (bare.some((w) => blob.includes(` ${w}`) || blob.includes(`${w} `))) p.cats[slug] = Math.min(99, (p.cats[slug] || 0) + 1);
  }
  // newest first, keep it small
  p.cats = Object.fromEntries(Object.entries(p.cats).sort((a, b) => b[1] - a[1]).slice(0, MAX_CATS));
  return p;
}

// The shopper's favourite categories (with their real names + a product count for the prompt).
export function topCats(prefs, cats, n = 4) {
  if (!prefs || !prefs.cats) return [];
  const bySlug = new Map((cats || []).map((c) => [c.slug, c]));
  return Object.keys(prefs.cats)
    .map((slug) => bySlug.get(slug))
    .filter(Boolean)
    .filter((c) => c.count > 0)
    .slice(0, n);
}
