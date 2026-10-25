// Site-wide search (v25): one function over everything that is not a product: tools, Live TV channels, Quran surahs, Hadith books, blog guides and pages.
// Products have their own search (/products?q=). Pure code, used by /search and the tests.
import { searchTools } from './tools.js';
import { channelSlugs } from './liveTv.js';

export const PAGES = [
  ['/deals', 'Deals: biggest discounts', 'deals sale discount offer sasta'], ['/products', 'All products', 'shop products buy online'], ['/quran', 'Quran: read and listen', 'quran tilawat surah ayat translation urdu'],
  ['/hadith', 'Hadith: Bukhari, Muslim and more', 'hadith hadees bukhari muslim tirmidhi'], ['/live', 'Live TV', 'live tv channels news islamic'], ['/tools', 'Free online tools', 'tools calculator zakat linux'],
  ['/islamic', 'Islamic reminders and timings', 'islamic namaz dua ayat timing reminder'], ['/reels', 'Reels: watch and shop', 'reels video shop'], ['/blog', 'Blog and guides', 'blog guides tips'],
  ['/reviews', 'Customer reviews', 'reviews rating customers'], ['/track', 'Track your order', 'track order parcel tcs'], ['/how-to-order', 'How to order', 'order cash on delivery cod'],
  ['/workers', 'Earn with Mizanora (workers)', 'earn worker reseller income'], ['/contact', 'Support and contact', 'contact support whatsapp help'], ['/about', 'About Mizanora', 'about mizanora kasur'], ['/muaaz-iqbal', 'Muaaz Iqbal, founder', 'muaaz iqbal founder developer'],
];
const words = (q) => String(q || '').toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((w) => w.length >= 2).slice(0, 8);
const score = (hay, title, w) => { let s = 0; for (const x of w) { if (title.includes(x)) s += 3; else if (hay.includes(x)) s += 1; else return 0; } return s; };

export function siteSearch(q, { channels = [], posts = [], surahs = [], books = [] } = {}) {
  const w = words(q);
  if (!w.length) return { tools: [], channels: [], posts: [], quran: [], hadith: [], pages: [] };
  const slugs = channelSlugs(channels);
  const pick = (arr, f, n) => arr.map((x, i) => ({ x, s: f(x, i) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((r) => r.x);
  // Hadith books are objects ({ key, name, ar }) in lib/hadith.js, but the older call sites and the
  // renderer use tuples ([key, name, arabic]). Keep one normalised tuple shape for every caller.
  const bookTuple = (b) => Array.isArray(b) ? [String(b[0] || ''), String(b[1] || ''), String(b[2] || '')] : [String(b.key || ''), String(b.name || ''), String(b.ar || '')];
  return {
    tools: searchTools(q, 12),
    channels: channels.map((c, i) => ({ ...c, slug: slugs[i] })).filter((c) => !c.off).map((c) => ({ c, s: score(`${c.name} ${c.group}`.toLowerCase(), c.name.toLowerCase(), w) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 24).map((r) => r.c),
    posts: pick(posts, (p) => score(`${p.title} ${p.description || ''} ${p.slug}`.toLowerCase(), String(p.title).toLowerCase(), w), 12),
    quran: pick(surahs, (s) => score(`${s.name} surah ${s.n} quran`.toLowerCase(), s.name.toLowerCase(), w), 8),
    hadith: pick(books.map(bookTuple), (b) => score(`${b[1]} ${b[0]} hadith hadees`.toLowerCase(), b[1].toLowerCase(), w), 9),
    pages: pick(PAGES, (p) => score(`${p[1]} ${p[2]}`.toLowerCase(), p[1].toLowerCase(), w), 8),
  };
}
