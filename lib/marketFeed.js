// v26: the home "Mizanora Feed". ONE scrolling feed that mixes products, Islamic posts (ayat, hadees, dua), live TV channels,
// free tools and (v31) Muaaz Iqbal's photos, like a social feed with a market inside. Pure code (no React) so the tests can run it.
// The mix is the same all day and changes every day.
// Pattern (per 12 cards): P P I M P T P P I P W P P ... products are always the biggest part, so the feed still sells.
export function seededOrder(list, seed) {
  const a = [...list]; let s = (Number(seed) || 1) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const PATTERN = ['P', 'P', 'I', 'M', 'P', 'T', 'P', 'P', 'I', 'P', 'W', 'P'];
export function buildFeed({ products = [], islamic = [], channels = [], tools = [], images = [], day = 0, max = 36 }) {
  // products: deals and featured first, then the rest, mixed by the day so the feed is not the same every morning
  const hot = products.filter((p) => p.inStock !== false && ((p.comparePrice > p.price) || p.featured));
  const rest = products.filter((p) => p.inStock !== false && !hot.includes(p));
  const P = [...seededOrder(hot, day), ...seededOrder(rest, day + 7)];
  const I = seededOrder(islamic, day + 3);
  const T = seededOrder(channels, day + 5);
  const W = seededOrder(tools, day + 11);
  const M = seededOrder(images, day + 9).slice(0, 6); // v31: Muaaz Iqbal photo cards, at most 6 in the feed
  const q = { P, I, T, W, M }; const at = { P: 0, I: 0, T: 0, W: 0, M: 0 };
  const out = [];
  for (let n = 0; n < max * 2 && out.length < max; n++) {
    let k = PATTERN[n % PATTERN.length];
    if (at[k] >= q[k].length) k = at.P < P.length ? 'P' : (['I', 'T', 'W', 'M'].find((x) => at[x] < q[x].length) || null);
    if (!k) break;
    const item = q[k][at[k]++];
    out.push({ kind: { P: 'product', I: 'islamic', T: 'tv', W: 'tool', M: 'muaaz' }[k], item });
  }
  return out;
}
