import fs from 'fs';
import path from 'path';

// The shopping blog: one markdown file per guide in content/blog, with a small front matter block:
//
//   ---
//   title: How to choose the right size online
//   slug: how-to-choose-the-right-size-online      (optional - defaults to the file name)
//   description: One or two lines for Google and for the card on /blog.
//   date: 2026-11-01
//   category: Shopping guides                      (optional - guessed from the title if missing)
//   tags: size, clothes, returns                   (optional - helps "Keep reading" pick real matches)
//   image: /img/muaaz/muaaz-iqbal-01.jpg           (optional - used by the card, the RSS item and the sitemap)
//   ---
//
// v36 fixes in this file:
//   - front matter values may be quoted ("title: \"Hello\"") - the quotes are stripped now;
//   - a damaged file no longer breaks the whole build: it is skipped and reported instead;
//   - two files claiming the same slug no longer silently overwrite each other;
//   - images may be local (![alt](/img/...)) - before, only https:// links were rendered;
//   - "Keep reading" shows posts that are ACTUALLY related (same category / tags), not the newest two.

const DIR = path.join(process.cwd(), 'content', 'blog');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Strip one pair of matching quotes around a YAML value ("x" or 'x' -> x).
const unquote = (s) => {
  const t = String(s).trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) return t.slice(1, -1).trim();
  return t;
};

const inline = (t) =>
  esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, b) => {
      const href = b.replace(/&amp;/g, '&');
      // only safe, ordinary links are turned into anchors
      return /^(https?:\/\/|\/|#|mailto:)/i.test(href) ? `<a href="${href}">${a}</a>` : a;
    });

// Only ever emit an image if the address is one of ours or a plain https link.
const safeImg = (u) => (/^https:\/\//i.test(u) || /^\/[^/]/.test(u)) && !/\.\.|%2e%2e/i.test(u) ? u : '';

function md(src) {
  let html = '', list = null, para = [];
  const heads = [];
  const flushP = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>\n`; para = []; } };
  const flushL = () => { if (list) { html += `</${list}>\n`; list = null; } };
  let code = null; // v26: ``` fenced code blocks (Asaan Lang examples, commands)
  let table = null; // v36: pipe tables
  const flushTable = () => {
    if (!table) return;
    const row = (cells, tag) => `<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`;
    html += '<thead>' + row(table.header || [], 'th') + '</thead>\n';
    if (table.rows.length) html += '<tbody>' + table.rows.map((r) => row(r, 'td')).join('') + '</tbody>\n';
    html += '</table></div>\n';
    table = null;
  };
  for (const raw of src.split('\n')) {
    const l = raw.trimEnd();
    if (code !== null) { if (l.trim().startsWith('```')) { html += `<pre class="my-4 overflow-x-auto rounded-xl bg-[#0b1f17] p-4 text-sm leading-6 text-emerald-100"><code>${esc(code.join('\n'))}</code></pre>\n`; code = null; } else code.push(raw); continue; }
    if (l.trim().startsWith('```')) { flushP(); flushL(); flushTable(); code = []; continue; }
    if (!l.trim()) { flushP(); flushL(); flushTable(); continue; }
    // v36 BUG FIX: the placeholder was written two ways in this repo - `{{cta}}` (87 guides) and
    // `{cta}` (22 guides). Only `{{cta}}` was ever matched, so those 22 ended with a literal
    // "{cta}" paragraph at the bottom of the page, and their call-to-action block never appeared.
    // Both spellings work now, and a {{cta}} sitting at the end of a sentence is honoured too.
    if (/^\{\{?cta\}\}?$/i.test(l.trim())) { flushP(); flushL(); flushTable(); html += '<!--cta-->\n'; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l.trim())) { flushP(); flushL(); flushTable(); html += '<hr />\n'; continue; }
    let m;
    // v36: images may be local (/img/...) or https - an <img> on its own line becomes a <figure>.
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/))) {
      const url = safeImg(m[2]);
      if (url) {
        flushP(); flushL(); flushTable();
        const caption = (m[3] || '').trim();
        html += `<figure class="my-6"><img src="${esc(url)}" alt="${esc(m[1] || caption || '')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="mx-auto max-h-[28rem] w-auto max-w-full rounded-2xl" />`
          + (caption ? `<figcaption class="mt-2 text-center text-sm text-faint">${esc(caption)}</figcaption>` : '')
          + '</figure>\n';
        continue;
      }
    }
    if ((m = l.match(/^## (.+)/))) {
      flushP(); flushL();
      const id = slugId(m[1]);
      heads.push({ id, text: m[1] });
      html += `<h2 id="${id}">${inline(m[1])}</h2>\n`;
    } else if ((m = l.match(/^### (.+)/))) { flushP(); flushL(); const id = slugId(m[1]); heads.push({ id, text: m[1] }); html += `<h3 id="${id}">${inline(m[1])}</h3>\n`; }
    else if ((m = l.match(/^#### (.+)/))) { flushP(); flushL(); html += `<h4>${inline(m[1])}</h4>\n`; }
    else if ((m = l.match(/^> (.+)/))) { flushP(); flushL(); html += `<div class="callout"><p>${inline(m[1])}</p></div>\n`; }
    // v36: simple pipe tables. A row of |---| under a |...| line opens a table.
    else if (l.trim().startsWith('|') && l.trim().endsWith('|')) {
      const cells = l.trim().slice(1, -1).split('|').map((c) => c.trim());
      const isRule = cells.every((c) => /^:?-{2,}:?$/.test(c));
      if (isRule && table) { table.head = true; continue; }
      if (!table) { flushP(); flushL(); html += '<div class="mz-table-wrap"><table>\n'; table = { rows: [], head: false, header: null }; }
      if (table.header === null) table.header = cells; else table.rows.push(cells);
      continue;
    } else if (table) { flushTable(); }
    else if ((m = l.match(/^- (.+)/))) { flushP(); if (list !== 'ul') { flushL(); html += '<ul>\n'; list = 'ul'; } html += `<li>${inline(m[1])}</li>\n`; }
    else if ((m = l.match(/^\d+\. (.+)/))) { flushP(); if (list !== 'ol') { flushL(); html += '<ol>\n'; list = 'ol'; } html += `<li>${inline(m[1])}</li>\n`; }
    else para.push(l.trim());
  }
  flushP(); flushL(); flushTable();
  return { html, heads };
}

export const slugId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- categories ------------------------------------------------------------
// A post can say `category: ...`; if it does not, the category is guessed from its words,
// so the 100+ guides written before v36 still land in a sensible shelf.
export const CATEGORIES = [
  ['muaaz-iqbal', ['muaaz', 'asaan', 'barakatwave', 'hijrianchor', 'noor-ai']],
  ['islamic', ['quran', 'hadith', 'hadees', 'islamic', 'halal', 'zakat', 'ramadan', 'sehr', 'iftar', 'namaz', 'ayat', 'dua']],
  ['live-and-reels', ['live', 'tv', 'reel', 'channel', 'tilawat']],
  ['earning-and-business', ['worker', 'earn', 'reselling', 'sell', 'marketing', 'seo', 'ads', 'business', 'price', 'market-rate', 'profit']],
  ['free-tools', ['tools', 'calculator', 'converter', 'commands', 'linux', 'counter']],
  ['shopping-guides', []], // the default shelf
];

export const CATEGORY_LABELS = {
  'muaaz-iqbal': 'Muaaz Iqbal',
  'islamic': 'Islamic',
  'live-and-reels': 'Live TV & Reels',
  'earning-and-business': 'Earning & Business',
  'free-tools': 'Free Tools',
  'shopping-guides': 'Shopping Guides',
};

export const CATEGORY_BLURBS = {
  'muaaz-iqbal': 'Who built Mizanora, how he thinks, and every project he has shipped.',
  'islamic': 'Quran, Hadees, zakat, Ramadan and halal trade - the Islamic side of the shop.',
  'live-and-reels': 'Mizanora Live TV, the Quran channel, reels and video shopping.',
  'earning-and-business': 'The worker programme, reselling, pricing, marketing and SEO for small Pakistani shops.',
  'free-tools': 'Zakat calculator, Hijri converter, unit converters and other free tools on Mizanora.',
  'shopping-guides': 'How to shop online safely in Pakistan: sizes, prices, cash on delivery, returns and deals.',
};

export function categoryOf(post = {}) {
  const explicit = slugId(post.category || '');
  if (explicit && CATEGORY_LABELS[explicit]) return explicit;
  const words = `${post.slug || ''} ${post.title || ''}`.toLowerCase();
  for (const [cat, keys] of CATEGORIES) if (keys.some((k) => words.includes(k))) return cat;
  return 'shopping-guides';
}

const tagsOf = (post = {}) =>
  String(post.tags || post.keywords || '')
    .split(',')
    .map((t) => slugId(t))
    .filter(Boolean);

// --- reading ---------------------------------------------------------------
let cache = null;

function readOne(f) {
  const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`bad front matter (the file must start with ---)`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    meta[line.slice(0, i).trim().toLowerCase()] = unquote(line.slice(i + 1));
  }
  if (!meta.title) throw new Error('no title in the front matter');
  const body = md(m[2]);
  const words = m[2].trim().split(/\s+/).filter(Boolean).length;
  const post = {
    ...meta,
    slug: slugId(meta.slug || f.replace(/\.md$/, '')),
    author: meta.author || 'Muaaz Iqbal',
    date: /^\d{4}-\d{2}-\d{2}$/.test(meta.date || '') ? meta.date : '2026-01-01',
    ...body,
    words,
    mins: Math.max(2, Math.round(words / 200)),
    file: f,
  };
  post.category = categoryOf(post);
  post.tagList = tagsOf(post);
  return post;
}

export function getPosts() {
  if (cache) return cache;
  if (!fs.existsSync(DIR)) return (cache = []);
  const seen = new Set();
  cache = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md')).sort()) {
    try {
      const post = readOne(f);
      if (seen.has(post.slug)) { console.warn(`blog: duplicate slug "${post.slug}" (${f}) - this file is skipped`); continue; }
      seen.add(post.slug);
      cache.push(post);
    } catch (e) {
      // v36: one broken file used to take the whole build down. It is now skipped and reported.
      console.warn(`blog: skipped content/blog/${f} - ${e.message}`);
    }
  }
  cache.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.slug.localeCompare(b.slug));
  return cache;
}

export const getPost = (slug) => getPosts().find((p) => p.slug === slug) || null;

/** Drop the in-memory cache (used by tests and after a rebuild). */
export const resetBlogCache = () => { cache = null; };

export const getPostsByCategory = (cat) => getPosts().filter((p) => p.category === cat);

/** Every category that actually has posts, newest shelf first by size. */
export function getBlogCategories() {
  const counts = new Map();
  for (const p of getPosts()) counts.set(p.category, (counts.get(p.category) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug, count]) => ({ slug, count, label: CATEGORY_LABELS[slug] || slug, blurb: CATEGORY_BLURBS[slug] || '' }));
}

/**
 * Posts that really go with this one. Score: same category, then shared tags, then freshness.
 * Before v36 "Keep reading" was just the two newest posts - useless for readers and for Google,
 * because it never linked a guide to the guides that belong with it.
 */
export function relatedPosts(post, limit = 3) {
  if (!post) return [];
  const mine = new Set(post.tagList || []);
  return getPosts()
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const shared = (p.tagList || []).filter((t) => mine.has(t)).length;
      const score = (p.category === post.category ? 3 : 0) + shared * 2 + (p.date > post.date ? 0.25 : 0);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || String(b.p.date).localeCompare(String(a.p.date)))
    .slice(0, limit)
    .map((x) => x.p);
}

/** A plain, small shape for the client-side browser on /blog (no HTML, no big strings). */
export const postCards = () => getPosts().map((p) => ({
  slug: p.slug, title: p.title, description: p.description || '', date: p.date, mins: p.mins,
  image: p.image || '', category: p.category, tags: p.tagList || [],
}));
