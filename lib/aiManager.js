import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from './firebase-admin';
import { cleanGroup, cleanGroups } from './dealGroups';
import { applyGroup, previewGroup, undoGroup } from './dealGroupsServer';
import { getProducts } from './products';
import { parseVideo } from './video';
import { cleanFeedItem } from './islamic';
import { SEASON_MODES } from './season';
import { getThemeMode } from './themeServer';
import { getSiteStatus } from './siteGate';
import { ghBlob, ghCommit, ghReadFile, ghReady } from './github';
import { geminiCall, ladderFor, loadAssistant, textOf } from './gemini';
import { QURAN_DEFAULT, QURAN_DOC, cleanQuran, quranStatus } from './quran';
import { DEALS_DEFAULT, DEALS_DOC, cleanDeals } from './deals';
import { EFFECT_IDS, cleanItem } from './inject';
import { readInjectDoc, writeInjectDoc } from './injectServer';
import { pingIndexNow } from './indexnow';

// ADMIN AI MANAGER: the tools the manager AI may use. It does NOT get raw database access. It gets this fixed list, nothing else:
//   * safe tools run at once and are written to the log (aiManagerLog)
//   * RISKY tools (they change prices, delete things, publish religious texts or blog posts) are only PREPARED: the admin sees exactly
//     what will happen and must press Confirm. The AI can never confirm by itself.
//   * it can never read or change API keys, passwords, payout details or customer addresses / phone numbers.
export const RISKY = new Set(['update_product', 'delete_reel', 'add_feed_post', 'delete_feed_post', 'publish_blog', 'apply_deal', 'apply_deal_group', 'undo_deal_group', 'add_injection', 'toggle_injection', 'delete_injection', 'repo_write_file']);

// v23: files the AI manager may read or write in the repository (through GitHub, every change is a commit you can revert).
// Never: secrets, the login / admin-check code, database rules, workflows, package files, the build config.
export const REPO_ALLOW = /^(app|components|lib|content|public|scripts)\/[\w@\-./\[\]]+$/;
export const REPO_DENY = /(^|\/)(\.env[^/]*|firebase-admin\.js|adminAuth\.js|workerAuth\.js|firebase-config\.js|github\.js)$|\.\.|node_modules|\.rar$|\.zip$/;
export const repoPathOk = (p) => REPO_ALLOW.test(String(p || '')) && !REPO_DENY.test(String(p || '')) && String(p).length < 160;

export const TOOLS = [{
  functionDeclarations: [
    { name: 'site_overview', description: 'Counts of products, orders (all time and last 7 days), reels, open tasks, plus the shop status and the current season look.', parameters: { type: 'object', properties: {} } },
    { name: 'set_season', description: 'Change the season look of the whole shop (snow, hero, ticker). mode is one of: winter, autumn, spring, summer, auto (follows the months), off.', parameters: { type: 'object', properties: { mode: { type: 'string' } }, required: ['mode'] } },
    { name: 'list_reels', description: 'List the video feed items (reels): id, title, link, visible.', parameters: { type: 'object', properties: {} } },
    { name: 'add_reel', description: 'Add a video to the home video feed and /reels. url can be YouTube, Facebook, Instagram, TikTok, Vimeo, Dailymotion, Streamable, Google Drive, Dropbox or a direct .mp4 link. Optional: title, productSlug (Shop now button goes to that product), link (page link), order (1 shows first).', parameters: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' }, productSlug: { type: 'string' }, link: { type: 'string' }, order: { type: 'number' } }, required: ['url'] } },
    { name: 'set_reel_visible', description: 'Show or hide one reel by id.', parameters: { type: 'object', properties: { id: { type: 'string' }, visible: { type: 'boolean' } }, required: ['id', 'visible'] } },
    { name: 'delete_reel', description: 'Delete one reel by id. Needs the admin to confirm.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'add_feed_post', description: 'Add an Islamic post (ayat, hadith, qaul or dua) to the home Islamic feed. Only when you are SURE of the exact Arabic wording and the exact reference (surah:ayah, or hadith book and number). If you are not sure, do not call this: tell the admin to give you the text. Needs the admin to confirm. kind: ayat | hadith | qaul | dua. ar = Arabic text (optional but preferred), ur = meaning in Roman Urdu, ref = reference.', parameters: { type: 'object', properties: { kind: { type: 'string' }, ar: { type: 'string' }, ur: { type: 'string' }, ref: { type: 'string' } }, required: ['kind', 'ur', 'ref'] } },
    { name: 'list_feed_posts', description: 'List the Islamic posts the admin added to the feed.', parameters: { type: 'object', properties: {} } },
    { name: 'delete_feed_post', description: 'Delete one added Islamic post by id. Needs the admin to confirm.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'search_products', description: 'Find live products by words in the name, category or slug. Returns slug, name, price, comparePrice, inStock.', parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
    { name: 'update_product', description: 'Change a live product: price, comparePrice (old price shown struck through, 0 removes), inStock, featured, active. Needs the admin to confirm. slug is the product slug.', parameters: { type: 'object', properties: { slug: { type: 'string' }, price: { type: 'number' }, comparePrice: { type: 'number' }, inStock: { type: 'boolean' }, featured: { type: 'boolean' }, active: { type: 'boolean' } }, required: ['slug'] } },
    { name: 'add_task', description: 'Add a to-do for the admin (a reminder list that stays saved). title is short; notes and due (a date text) are optional.', parameters: { type: 'object', properties: { title: { type: 'string' }, notes: { type: 'string' }, due: { type: 'string' } }, required: ['title'] } },
    { name: 'list_tasks', description: 'List tasks. status: open (default) or done.', parameters: { type: 'object', properties: { status: { type: 'string' } } } },
    { name: 'complete_task', description: 'Mark one task done by id.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'web_research', description: 'Research a question on the internet (Google Search) and get a short answer with sources. Use it for ideas, competitors, trends, keywords, how-to questions. Facts from it must be presented as "found online", not as certain.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'quran_get', description: 'Read the Quran session setting (schedule, surah, reciter, look) and whether it is live now.', parameters: { type: 'object', properties: {} } },
    { name: 'quran_set', description: 'Change the Quran session that plays on the whole website at set times. Only send the fields you want to change. mode: schedule | always | off. windows: list of {start:"09:00", end:"09:30", days:[0-6, empty = every day]} in Pakistan time (the shop start time). surah 1-114, from/to ayah (to 0 = end). reciter: ar.alafasy | ar.abdurrahmaansudais | ar.abdulbasitmurattal | ar.husary | ar.minshawi | ar.saoodshuraym | ar.mahermuaiqly. translation: ur.jalandhry | ur.junagarhi | en.sahih | empty for none. display: pill | sheet | full. style: emerald | night | gold. animation: glow | rise | type | float. size s|m|l. The Quran text and voice come from AlQuran Cloud, never typed by you.', parameters: { type: 'object', properties: { mode: { type: 'string' }, windows: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' }, days: { type: 'array', items: { type: 'number' } } } } }, surah: { type: 'number' }, from: { type: 'number' }, to: { type: 'number' }, reciter: { type: 'string' }, translation: { type: 'string' }, display: { type: 'string' }, style: { type: 'string' }, animation: { type: 'string' }, size: { type: 'string' }, continuous: { type: 'boolean' }, loop: { type: 'boolean' }, autoStart: { type: 'boolean' }, volume: { type: 'number' }, title: { type: 'string' }, message: { type: 'string' } } } },
    { name: 'quran_start_now', description: 'Start the Quran session on the website right now for N minutes (1-240). minutes 0 stops a manual session.', parameters: { type: 'object', properties: { minutes: { type: 'number' } }, required: ['minutes'] } },
    { name: 'deals_get', description: 'Read the settings of the one-link deals page (/deals) and how many products are on it.', parameters: { type: 'object', properties: {} } },
    { name: 'deals_set', description: 'Change the deals page (/deals): enabled, title, subtitle, minPct (smallest discount % that counts), endsInHours (shows a countdown banner; 0 removes it), pinned (array of product slugs shown first), badge.', parameters: { type: 'object', properties: { enabled: { type: 'boolean' }, title: { type: 'string' }, subtitle: { type: 'string' }, minPct: { type: 'number' }, endsInHours: { type: 'number' }, pinned: { type: 'array', items: { type: 'string' } }, badge: { type: 'string' } } } },
    { name: 'apply_deal_group', description: 'Make a whole catalogue a deal at ONE rate: every LIVE product whose name/category contains one of the words (whole words, e.g. shirt, shoes, watch, men) gets the same percent off OR the same fixed price (old price shown struck through, shown in the home feed Hot deals and /deals). exclude = words that must NOT match (e.g. women for a men group). Give percent (1-80) or price in rupees. Needs the admin to confirm.', parameters: { type: 'object', properties: { name: { type: 'string' }, words: { type: 'array', items: { type: 'string' } }, exclude: { type: 'array', items: { type: 'string' } }, percent: { type: 'number' }, price: { type: 'number' } }, required: ['name', 'words'] } },
    { name: 'undo_deal_group', description: 'Put the old prices back for a deal group made with apply_deal_group. id = the group name in lowercase with dashes (e.g. shirts). Needs the admin to confirm.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'apply_deal', description: 'Make LIVE products a deal: the current price becomes the old (struck-through) price and the new price is percent lower (5-60). slugs: up to 30 product slugs (find them with search_products). Products whose cost would be violated (price must stay at least Rs 50 above cost) are skipped. Needs the admin to confirm.', parameters: { type: 'object', properties: { slugs: { type: 'array', items: { type: 'string' } }, percent: { type: 'number' } }, required: ['slugs', 'percent'] } },
    { name: 'set_effects', description: 'Switch the ready-made website animations on or off. effects = the COMPLETE list that should be on. Available: reveal, sparkle, lanterns, confetti, tilt, shimmer, glow, progress, smooth.', parameters: { type: 'object', properties: { effects: { type: 'array', items: { type: 'string' } } }, required: ['effects'] } },
    { name: 'list_injections', description: 'List the custom code snippets (CSS / JavaScript / HTML) injected into the website: id, name, type, pages, on/off.', parameters: { type: 'object', properties: {} } },
    { name: 'add_injection', description: 'Add a custom snippet to the whole website: type css (looks, animations), js (behaviour), or html (a banner / block without scripts). pages: all | home | comma list of paths like /products,/deals. For html, where: top | end. Write complete, safe, working code: CSS animations should use transform/opacity only and respect prefers-reduced-motion; JS must be defensive (try/catch, no external scripts, no tracking, never touch forms, payments or login). window.MZ.onRoute(fn) runs fn on every page change. Needs the admin to confirm (the admin sees the code). Starts ON once confirmed.', parameters: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, code: { type: 'string' }, pages: { type: 'string' }, where: { type: 'string' } }, required: ['name', 'type', 'code'] } },
    { name: 'toggle_injection', description: 'Switch one snippet on or off by id. Needs the admin to confirm.', parameters: { type: 'object', properties: { id: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['id', 'enabled'] } },
    { name: 'delete_injection', description: 'Delete one snippet by id. Needs the admin to confirm.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'repo_read_file', description: 'Read a source file of the website from GitHub (folders app/, components/, lib/, content/, public/, scripts/). Use it before changing a file. Returns up to 14000 characters from offset.', parameters: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'number' } }, required: ['path'] } },
    { name: 'repo_write_file', description: 'Create or replace ONE source file of the website through a GitHub commit (the shop redeploys in about a minute; the admin can revert the commit). Use it to build new pages, components, features or admin panels. Send the COMPLETE new file content, not a patch. Read the file first when it exists. Follow the project style (Next.js App Router, Tailwind, JavaScript, "use client" only where needed). Never touch secrets, login/admin-check code, database rules, workflows or package files (refused). Needs the admin to confirm.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' }, message: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'submit_to_search', description: 'Tell Bing, Yandex and other IndexNow search engines about important pages (new blogs, /deals, /quran, /muaaz-iqbal ...). paths: list of paths like /deals. Google learns from the sitemap (sitemap.xml) by itself; say that honestly.', parameters: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } }, required: ['paths'] } },
    { name: 'publish_blog', description: 'Publish a new blog post to the shop (a file in content/blog, shop redeploys in about a minute). Needs the admin to confirm. slug: lowercase letters, digits, hyphens. markdown: the body (use ## headings, - lists, [text](/path) links). No front matter.', parameters: { type: 'object', properties: { slug: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, markdown: { type: 'string' } }, required: ['slug', 'title', 'description', 'markdown'] } },
  ],
}];

const db = () => adminDb();
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v) => Number(v);
const refreshShop = () => { try { revalidateTag('catalog'); revalidatePath('/', 'layout'); } catch { /* refreshes by itself soon */ } };
const karachiDate = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };

async function countOf(q) { try { return (await q.count().get()).data().count; } catch { return null; } }

// What the admin sees before confirming a risky action (words, never code).
export async function describeRisky(name, a = {}) {
  if (name === 'update_product') {
    const d = await db().collection('products').doc(clip(a.slug, 120)).get();
    if (!d.exists) return { error: `No live product with slug "${clip(a.slug, 80)}" (archived products are edited in Catalogue files).` };
    const p = d.data();
    const ch = [];
    if (a.price !== undefined) ch.push(`price Rs ${p.price} -> Rs ${Math.round(num(a.price))}`);
    if (a.comparePrice !== undefined) ch.push(`old price Rs ${p.comparePrice || 0} -> Rs ${Math.round(num(a.comparePrice))}`);
    if (a.inStock !== undefined) ch.push(`in stock ${p.inStock ? 'yes' : 'no'} -> ${a.inStock ? 'yes' : 'no'}`);
    if (a.featured !== undefined) ch.push(`featured ${p.featured ? 'yes' : 'no'} -> ${a.featured ? 'yes' : 'no'}`);
    if (a.active !== undefined) ch.push(`visible ${p.active !== false ? 'yes' : 'no'} -> ${a.active ? 'yes' : 'no'}`);
    return { summary: `Change "${clip(p.name, 70)}": ${ch.join('; ') || 'nothing'}` };
  }
  if (name === 'delete_reel') return { summary: `Delete reel ${clip(a.id, 60)} permanently.` };
  if (name === 'delete_feed_post') return { summary: `Delete Islamic post ${clip(a.id, 60)} permanently.` };
  if (name === 'add_feed_post') {
    const x = cleanFeedItem(a);
    if (!x) return { error: 'An Islamic post needs the meaning (ur) and the exact reference (ref).' };
    return { summary: `Publish on the home Islamic feed (${x.kind}). Please check the wording and the reference yourself:\n${x.ar}\n${x.ur}\n(${x.ref})` };
  }
  if (name === 'publish_blog') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(a.slug || '')) || String(a.slug).length < 5 || String(a.slug).length > 90) return { error: 'The blog slug must be lowercase words joined by hyphens (5 to 90 characters).' };
    return { summary: `Publish blog post "${clip(a.title, 100)}" at /blog/${a.slug} (${String(a.markdown || '').split(/\s+/).length} words). The shop redeploys in about a minute.` };
  }
  if (name === 'apply_deal') {
    const pct = Math.round(num(a.percent));
    if (!(pct >= 5 && pct <= 60)) return { error: 'The deal percent must be between 5 and 60.' };
    const slugs = [...new Set((Array.isArray(a.slugs) ? a.slugs : []).map((x) => clip(x, 120)).filter(Boolean))].slice(0, 30);
    if (!slugs.length) return { error: 'Give at least one product slug.' };
    const lines = [];
    for (const sl of slugs.slice(0, 12)) {
      const d = await db().collection('products').doc(sl).get();
      if (!d.exists) { lines.push(`${sl}: not a live product (skipped)`); continue; }
      const p = d.data(); const price = Number(p.price) || 0;
      lines.push(`${clip(p.name, 50)}: Rs ${price} -> Rs ${dealPrice(price, pct)} (old price Rs ${price} shown struck through)`);
    }
    return { summary: `Make ${slugs.length} product(s) a ${pct}% deal:\n${lines.join('\n')}${slugs.length > 12 ? `\n...and ${slugs.length - 12} more` : ''}` };
  }
  if (name === 'apply_deal_group') {
    const g = cleanGroup({ name: a.name, words: a.words, exclude: a.exclude, pct: a.percent, price: a.price });
    if (!g || !g.words.length || !(g.pct || g.price)) return { error: 'Give a group name, at least one word and a percent (1-80) or a fixed price.' };
    const pv = await previewGroup(g);
    if (!pv.ok) return { error: pv.error };
    return { summary: `Deal group "${g.name}" (words: ${g.words.join(', ')}${g.exclude.length ? `; not: ${g.exclude.join(', ')}` : ''}) at ${g.price ? `Rs ${g.price} each` : `${g.pct}% off`}: ${pv.count} live product(s) change.${pv.sample.map((x) => `\n${x.name}: Rs ${x.from} -> Rs ${x.to}`).join('')}${pv.skippedCount ? `\n${pv.skippedCount} skipped (cost / no lower price).` : ''}` };
  }
  if (name === 'undo_deal_group') return { summary: `Put the old prices back for the deal group "${clip(a.id, 40)}".` };
  if (name === 'add_injection') {
    const it = cleanItem({ ...a, id: '', by: 'ai' });
    if (!it) return { error: 'The snippet needs a type (css, js or html) and some code.' };
    return { summary: `Add a ${it.type.toUpperCase()} snippet "${it.name}" to ${it.pages === 'all' ? 'every page' : it.pages} (switched ON). Please read the code:\n${it.code.slice(0, 3500)}${it.code.length > 3500 ? '\n...(cut for display)' : ''}` };
  }
  if (name === 'toggle_injection') return { summary: `Switch snippet ${clip(a.id, 40)} ${a.enabled ? 'ON' : 'OFF'}.` };
  if (name === 'delete_injection') return { summary: `Delete snippet ${clip(a.id, 40)} permanently.` };
  if (name === 'repo_write_file') {
    const path = String(a.path || '');
    if (!repoPathOk(path)) return { error: 'That path is not allowed. Allowed folders: app, components, lib, content, public, scripts (no secrets, login or admin-check files).' };
    const body = String(a.content || '');
    if (!body.trim() || body.length > 80000) return { error: 'The file must have content and be under 80,000 characters.' };
    let before = null;
    try { before = ghReady() ? await ghReadFile(path) : null; } catch { /* unknown */ }
    return { summary: `${before === null ? 'CREATE' : 'REPLACE'} ${path} (${body.length} characters, ${body.split('\n').length} lines${before !== null ? `, was ${before.length} characters` : ''}). Commit message: ${clip(a.message || `AI Manager: ${path}`, 80)}.\nStart of the file:\n${body.slice(0, 1200)}${body.length > 1200 ? '\n...' : ''}\nThe shop redeploys in about a minute. A broken file would fail the build and the previous version stays live; you can also revert the commit on GitHub.` };
  }
  return { error: 'Unknown action.' };
}

// New price of a deal: percent lower, rounded to a clean 10 (never below Rs 10).
const dealPrice = (price, pct) => Math.max(10, Math.round((price * (100 - pct)) / 100 / 10) * 10);

export async function runTool(name, a = {}, { uid = '' } = {}) {
  const r = await exec(name, a);
  try { await db().collection('aiManagerLog').add({ atMs: Date.now(), uid, tool: name, args: clip(JSON.stringify(a), 600), ok: r.ok !== false, summary: clip(r.summary || r.error || '', 300) }); } catch { /* logging must never block the work */ }
  return r;
}

async function exec(name, a) {
  try {
    switch (name) {
      case 'site_overview': {
        const week = Date.now() - 7 * 864e5;
        const [products, orders, orders7, reels, tasks, status, theme] = await Promise.all([
          countOf(db().collection('products')), countOf(db().collection('orders')), countOf(db().collection('orders').where('createdAtMs', '>=', week)),
          countOf(db().collection('reels')), countOf(db().collection('aiManagerTasks').where('done', '==', false)), getSiteStatus(), getThemeMode(),
        ]);
        return { ok: true, data: { liveProducts: products, ordersAllTime: orders, ordersLast7Days: orders7, reels, openTasks: tasks, shopMode: status.mode, season: theme }, summary: 'Overview read.' };
      }
      case 'set_season': {
        const mode = String(a.mode || '').toLowerCase();
        if (!SEASON_MODES.includes(mode)) return { ok: false, error: `mode must be one of: ${SEASON_MODES.join(', ')}` };
        await db().collection('siteMeta').doc('theme').set({ season: mode, updatedAtMs: Date.now() }, { merge: true });
        try { revalidateTag('theme'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, summary: `Season look set to "${mode}". Visitors see it within a minute.` };
      }
      case 'list_reels': {
        const s = await db().collection('reels').limit(40).get();
        const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (Number(x.order) || 0) - (Number(y.order) || 0)).map((r) => ({ id: r.id, title: clip(r.title, 60), url: clip(r.url, 100), visible: r.active !== false, product: r.productSlug || '' }));
        return { ok: true, data: list, summary: `${list.length} reels.` };
      }
      case 'add_reel': {
        const url = clip(a.url, 500);
        const v = parseVideo(url);
        if (!v) return { ok: false, error: 'That link is not a supported video link (YouTube, Facebook, Instagram, TikTok, Vimeo, Dailymotion, Streamable, Google Drive, Dropbox or a direct .mp4).' };
        const ref = await db().collection('reels').add({ url, title: clip(a.title, 90), productSlug: clip(a.productSlug, 120), link: clip(a.link, 200), order: Math.round(num(a.order)) || 0, active: true, updatedAtMs: Date.now() });
        refreshShop();
        return { ok: true, data: { id: ref.id, type: v.label }, summary: `${v.label} video added to the feed (id ${ref.id}).` };
      }
      case 'set_reel_visible': {
        await db().collection('reels').doc(clip(a.id, 80)).update({ active: Boolean(a.visible), updatedAtMs: Date.now() });
        refreshShop();
        return { ok: true, summary: `Reel ${a.visible ? 'shown' : 'hidden'}.` };
      }
      case 'delete_reel': { await db().collection('reels').doc(clip(a.id, 80)).delete(); refreshShop(); return { ok: true, summary: 'Reel deleted.' }; }
      case 'add_feed_post': {
        const x = cleanFeedItem(a);
        if (!x) return { ok: false, error: 'An Islamic post needs the meaning (ur) and the exact reference (ref).' };
        const ref = await db().collection('feedPosts').add({ kind: x.kind, ar: x.ar, ur: x.ur, ref: x.ref, createdAt: Date.now() });
        try { revalidateTag('feed-posts'); revalidatePath('/'); } catch { /* ignore */ }
        return { ok: true, data: { id: ref.id }, summary: 'Islamic post published on the home feed.' };
      }
      case 'list_feed_posts': {
        const s = await db().collection('feedPosts').orderBy('createdAt', 'desc').limit(30).get();
        return { ok: true, data: s.docs.map((d) => ({ id: d.id, kind: d.data().kind, ur: clip(d.data().ur, 80), ref: d.data().ref })), summary: `${s.size} posts.` };
      }
      case 'delete_feed_post': { await db().collection('feedPosts').doc(clip(a.id, 80)).delete(); try { revalidateTag('feed-posts'); revalidatePath('/'); } catch { /* ignore */ } return { ok: true, summary: 'Post deleted.' }; }
      case 'search_products': {
        const words = clip(a.query, 80).toLowerCase().split(' ').filter(Boolean);
        const all = await getProducts();
        const hit = all.filter((p) => { const t = `${p.name} ${p.category} ${p.slug}`.toLowerCase(); return words.every((w) => t.includes(w)); }).slice(0, Math.min(15, Math.max(1, Math.round(num(a.limit)) || 8)));
        return { ok: true, data: hit.map((p) => ({ slug: p.slug, name: clip(p.name, 80), price: p.price, comparePrice: p.comparePrice || 0, inStock: p.inStock !== false })), summary: `${hit.length} products found.` };
      }
      case 'update_product': {
        const ref = db().collection('products').doc(clip(a.slug, 120));
        const d = await ref.get();
        if (!d.exists) return { ok: false, error: 'No live product with that slug.' };
        const up = { updatedAt: Date.now() };
        if (a.price !== undefined) { const p = Math.round(num(a.price)); if (!(p >= 1 && p <= 1000000)) return { ok: false, error: 'Price must be between 1 and 1,000,000.' }; up.price = p; }
        if (a.comparePrice !== undefined) { const c = Math.round(num(a.comparePrice)); if (!(c >= 0 && c <= 2000000)) return { ok: false, error: 'Old price must be between 0 and 2,000,000.' }; up.comparePrice = c; }
        if (a.inStock !== undefined) up.inStock = Boolean(a.inStock);
        if (a.featured !== undefined) up.featured = Boolean(a.featured);
        if (a.active !== undefined) up.active = Boolean(a.active);
        await ref.update(up);
        refreshShop();
        return { ok: true, summary: `Product ${d.id} updated and live.` };
      }
      case 'add_task': {
        const title = clip(a.title, 140);
        if (!title) return { ok: false, error: 'A task needs a title.' };
        const ref = await db().collection('aiManagerTasks').add({ title, notes: clip(a.notes, 400), due: clip(a.due, 40), done: false, createdAtMs: Date.now() });
        return { ok: true, data: { id: ref.id }, summary: `Task saved: ${title}` };
      }
      case 'list_tasks': {
        const done = String(a.status || 'open').toLowerCase() === 'done';
        const s = await db().collection('aiManagerTasks').where('done', '==', done).limit(40).get();
        return { ok: true, data: s.docs.map((d) => ({ id: d.id, title: d.data().title, notes: d.data().notes || '', due: d.data().due || '' })), summary: `${s.size} ${done ? 'done' : 'open'} tasks.` };
      }
      case 'complete_task': { await db().collection('aiManagerTasks').doc(clip(a.id, 80)).update({ done: true, doneAtMs: Date.now() }); return { ok: true, summary: 'Task marked done.' }; }
      case 'web_research': {
        const { cfg } = await loadAssistant();
        const r = await geminiCall(ladderFor(cfg, 'fast'), {
          contents: [{ role: 'user', parts: [{ text: `Research this for a Pakistani Muslim online shop owner. Answer in at most 220 words, in simple English. Use only what you find with search and give sources. Never invent an ayah, hadith or reference. Say clearly when you are not sure or when scholars differ.\n\n${clip(a.query, 300)}` }] }],
          tools: [{ google_search: {} }], generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }, { timeoutMs: 20000, deadlineMs: 30000, maxTries: 3 });
        if (!r.ok) return { ok: false, error: `Research is not available right now (${r.status}).` };
        const gm = r.json.candidates && r.json.candidates[0] && r.json.candidates[0].groundingMetadata;
        const sources = ((gm && gm.groundingChunks) || []).map((c) => c.web && { title: clip(c.web.title, 60), url: c.web.uri }).filter(Boolean).slice(0, 5);
        return { ok: true, data: { answer: textOf(r.json).slice(0, 1500), sources }, summary: 'Research done.' };
      }
      case 'quran_get': {
        const d = await db().collection(QURAN_DOC.collection).doc(QURAN_DOC.id).get();
        const c = d.exists ? cleanQuran({ ...QURAN_DEFAULT, ...d.data() }) : { ...QURAN_DEFAULT, mode: 'off' };
        return { ok: true, data: { ...c, liveNow: quranStatus(c).live }, summary: 'Quran setting read.' };
      }
      case 'quran_set': {
        const ref = db().collection(QURAN_DOC.collection).doc(QURAN_DOC.id);
        const d = await ref.get();
        const cur = d.exists ? cleanQuran({ ...QURAN_DEFAULT, ...d.data() }) : { ...QURAN_DEFAULT, mode: 'off' };
        const next = cleanQuran({ ...cur, ...Object.fromEntries(Object.entries(a || {}).filter(([, v]) => v !== undefined && v !== null)) });
        await ref.set({ ...next, updatedAtMs: Date.now() });
        try { revalidateTag('quran'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, data: next, summary: `Quran session saved: ${next.mode}, surah ${next.surah}${next.mode === 'schedule' ? `, times ${next.windows.map((w) => `${w.start}-${w.end}`).join(', ') || 'none'}` : ''}.` };
      }
      case 'quran_start_now': {
        const m = Math.min(240, Math.max(0, Math.round(num(a.minutes)) || 0));
        const ref = db().collection(QURAN_DOC.collection).doc(QURAN_DOC.id);
        const d = await ref.get();
        const cur = d.exists ? cleanQuran({ ...QURAN_DEFAULT, ...d.data() }) : { ...QURAN_DEFAULT, mode: 'off' };
        const next = cleanQuran({ ...cur, mode: cur.mode === 'off' && m ? 'schedule' : cur.mode, liveUntil: m ? Date.now() + m * 60000 : 0 });
        await ref.set({ ...next, updatedAtMs: Date.now() });
        try { revalidateTag('quran'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, summary: m ? `Quran session is live for ${m} minutes (visitors see it within a minute).` : 'Manual Quran session stopped.' };
      }
      case 'deals_get': {
        const d = await db().collection(DEALS_DOC.collection).doc(DEALS_DOC.id).get();
        const c = d.exists ? cleanDeals({ ...DEALS_DEFAULT, ...d.data() }) : DEALS_DEFAULT;
        const all = await getProducts();
        const n = all.filter((p) => p.inStock !== false && p.comparePrice > p.price).length;
        return { ok: true, data: { ...c, liveDealProducts: n, link: '/deals' }, summary: 'Deals setting read.' };
      }
      case 'deals_set': {
        const ref = db().collection(DEALS_DOC.collection).doc(DEALS_DOC.id);
        const d = await ref.get();
        const cur = d.exists ? cleanDeals({ ...DEALS_DEFAULT, ...d.data() }) : DEALS_DEFAULT;
        const patch = { ...a };
        if (a.endsInHours !== undefined) patch.endsAtMs = num(a.endsInHours) > 0 ? Date.now() + Math.min(24 * 90, num(a.endsInHours)) * 3600e3 : 0;
        delete patch.endsInHours;
        const next = cleanDeals({ ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== null)) });
        await ref.set({ ...next, updatedAtMs: Date.now() });
        try { revalidateTag('deals-config'); revalidatePath('/deals'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, summary: 'Deals page saved. Link: /deals' };
      }
      case 'apply_deal': {
        const pct = Math.round(num(a.percent));
        if (!(pct >= 5 && pct <= 60)) return { ok: false, error: 'The deal percent must be between 5 and 60.' };
        const slugs = [...new Set((Array.isArray(a.slugs) ? a.slugs : []).map((x) => clip(x, 120)).filter(Boolean))].slice(0, 30);
        const done = []; const skipped = [];
        for (const sl of slugs) {
          const ref = db().collection('products').doc(sl);
          const d = await ref.get();
          if (!d.exists) { skipped.push(`${sl} (not live)`); continue; }
          const p = d.data(); const price = Number(p.price) || 0;
          const base = Number(p.comparePrice) > price ? Number(p.comparePrice) : price; // an existing old price stays the old price
          const np = dealPrice(base, pct);
          let costRow = null; try { costRow = await db().collection('productCosts').doc(sl).get(); } catch { /* none */ }
          const cost = costRow && costRow.exists ? Number(costRow.data().cost) || 0 : 0;
          if (cost && np < cost + 50) { skipped.push(`${sl} (would go under cost + Rs 50)`); continue; }
          if (!cost && p.dealRoom !== undefined && p.dealRoom !== null && base - np > Number(p.dealRoom)) { skipped.push(`${sl} (not enough profit room)`); continue; }
          await ref.update({ price: np, comparePrice: base, updatedAt: Date.now() });
          done.push(sl);
        }
        refreshShop();
        try { revalidatePath('/deals'); } catch { /* ignore */ }
        return { ok: true, summary: `${done.length} product(s) are now ${pct}% deals.${skipped.length ? ` Skipped: ${skipped.slice(0, 6).join('; ')}.` : ''} See /deals.` };
      }
      case 'apply_deal_group': {
        const g = cleanGroup({ name: a.name, words: a.words, exclude: a.exclude, pct: a.percent, price: a.price });
        if (!g || !g.words.length || !(g.pct || g.price)) return { ok: false, error: 'Give a group name, at least one word and a percent or a fixed price.' };
        const r = await applyGroup(g);
        if (!r.ok) return { ok: false, error: r.error };
        try {
          const cur = await db().collection('siteMeta').doc('deals').get();
          const groups = cleanGroups([...(((cur.exists && cur.data().groups) || []).filter((x) => x.id !== g.id)), g]);
          await db().collection('siteMeta').doc('deals').set({ groups, updatedAtMs: Date.now() }, { merge: true });
          revalidateTag('deals-config');
        } catch { /* the prices are already changed; the list entry is only a convenience */ }
        return { ok: true, summary: `${r.summary} See /deals and the home page.` };
      }
      case 'undo_deal_group': {
        const r = await undoGroup(clip(a.id, 40));
        return { ok: true, summary: r.summary };
      }
      case 'set_effects': {
        const list = (Array.isArray(a.effects) ? a.effects : []).filter((e) => EFFECT_IDS.includes(e));
        const cur = await readInjectDoc();
        await writeInjectDoc({ ...cur, effects: list });
        try { revalidateTag('inject'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, summary: `Animations on: ${list.join(', ') || 'none'}.` };
      }
      case 'list_injections': {
        const c = await readInjectDoc();
        return { ok: true, data: { effects: c.effects, disabled: c.disabled, items: c.items.map((i) => ({ id: i.id, name: i.name, type: i.type, pages: i.pages, enabled: i.enabled, by: i.by, chars: i.code.length })) }, summary: `${c.items.length} snippets.` };
      }
      case 'add_injection': {
        const it = cleanItem({ ...a, id: '', by: 'ai', enabled: true });
        if (!it) return { ok: false, error: 'The snippet needs a type (css, js or html) and some code.' };
        const c = await readInjectDoc();
        if (c.items.length >= 24) return { ok: false, error: 'Too many snippets (24). Delete one first.' };
        await writeInjectDoc({ ...c, items: [...c.items, it] });
        try { revalidateTag('inject'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, data: { id: it.id }, summary: `Snippet "${it.name}" is live (id ${it.id}). Test link: add ?noinject=1 to any shop address to see the shop without it.` };
      }
      case 'toggle_injection': {
        const c = await readInjectDoc();
        if (!c.items.some((i) => i.id === a.id)) return { ok: false, error: 'No snippet with that id.' };
        await writeInjectDoc({ ...c, items: c.items.map((i) => (i.id === a.id ? { ...i, enabled: Boolean(a.enabled) } : i)) });
        try { revalidateTag('inject'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, summary: `Snippet switched ${a.enabled ? 'on' : 'off'}.` };
      }
      case 'delete_injection': {
        const c = await readInjectDoc();
        await writeInjectDoc({ ...c, items: c.items.filter((i) => i.id !== a.id) });
        try { revalidateTag('inject'); revalidatePath('/', 'layout'); } catch { /* ignore */ }
        return { ok: true, summary: 'Snippet deleted.' };
      }
      case 'repo_read_file': {
        if (!ghReady()) return { ok: false, error: 'GitHub is not connected (GITHUB_TOKEN / GITHUB_REPO in Vercel).' };
        if (!repoPathOk(a.path)) return { ok: false, error: 'That path is not allowed.' };
        const t = await ghReadFile(String(a.path));
        if (t === null) return { ok: false, error: 'File not found.' };
        const off = Math.max(0, Math.round(num(a.offset)) || 0);
        return { ok: true, data: { path: a.path, totalChars: t.length, offset: off, text: t.slice(off, off + 14000), more: off + 14000 < t.length }, summary: `Read ${a.path}.` };
      }
      case 'repo_write_file': {
        if (!ghReady()) return { ok: false, error: 'GitHub is not connected (GITHUB_TOKEN / GITHUB_REPO in Vercel).' };
        const path = String(a.path || '');
        if (!repoPathOk(path)) return { ok: false, error: 'That path is not allowed.' };
        const body = String(a.content || '').replace(/\r/g, '');
        if (!body.trim() || body.length > 80000) return { ok: false, error: 'The file must have content and be under 80,000 characters.' };
        const sha = await ghBlob(body.endsWith('\n') ? body : `${body}\n`);
        await ghCommit([{ path, sha }], clip(a.message || `AI Manager: ${path}`, 100));
        return { ok: true, summary: `Committed ${path}. It is live after the redeploy (about a minute).` };
      }
      case 'submit_to_search': {
        const r = await pingIndexNow(Array.isArray(a.paths) ? a.paths : []);
        return r.ok ? { ok: true, summary: `Sent ${r.count} page(s) to IndexNow (Bing, Yandex...). Google reads sitemap.xml by itself; for Google use Search Console > Sitemaps.` } : { ok: false, error: r.skipped || r.error || `IndexNow answered ${r.status}.` };
      }
      case 'publish_blog': {
        if (!ghReady()) return { ok: false, error: 'GitHub is not connected (GITHUB_TOKEN / repository). Add it in Vercel, then try again.' };
        const slug = String(a.slug || '');
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 5 || slug.length > 90) return { ok: false, error: 'Bad slug.' };
        const body = String(a.markdown || '').replace(/\r/g, '').trim();
        if (body.length < 300 || body.length > 30000) return { ok: false, error: 'The blog body must be between 300 and 30,000 characters.' };
        if (await ghReadFile(`content/blog/${slug}.md`)) return { ok: false, error: 'A blog post with this slug already exists. Use another slug.' };
        const one = (s, n) => clip(s, n).replace(/:/g, ' -');
        const file = `---\ntitle: ${one(a.title, 110)}\nslug: ${slug}\ndescription: ${one(a.description, 200)}\ndate: ${karachiDate()}\n---\n${body.replace(/^---+\s*$/gm, '')}\n`;
        const sha = await ghBlob(file);
        await ghCommit([{ path: `content/blog/${slug}.md`, sha }], `Blog: ${one(a.title, 80)} (AI Manager)`);
        return { ok: true, summary: `Blog "${one(a.title, 80)}" committed. It is live after the redeploy (about a minute) at /blog/${slug}.` };
      }
      default: return { ok: false, error: `Unknown tool ${name}.` };
    }
  } catch (e) { return { ok: false, error: clip(e && e.message, 200) || 'Failed.' }; }
}

export function managerPrompt(lang = '') {
  return `You are the operations manager AI of MIZANORA, a Pakistani online shop. You work ONLY for the shop owner / admin who is talking to you now. Reply in the same language the admin writes (Roman Urdu, Urdu or English), short and clear. You are also a knowledgeable, honest helper: answer ANY question the admin asks (business, marketing, SEO, coding, Islam, general knowledge). For anything you are not sure of or that can change (news, prices, rules, trends, Islamic rulings with sources) call web_research first and say 'found online'. HONESTY AND ISLAM: always truthful, never invent facts, ayat, ahadees or references; Islamic rulings only well-established with their source, otherwise advise a qualified aalim; refuse riba, gambling, cheating, fake reviews, fake countdowns or fake discounts, adult content, and anything that deceives customers - offer the halal, honest alternative.
You can act through your tools: season look, video feed (reels), Islamic feed posts, products (search / price / stock), deals (/deals page and making products deals), the Quran session (schedule, surah, reciter, start now), website animations and custom CSS/JS/HTML snippets (Studio), source files of the website (read and write through GitHub, to build new features, pages and admin panels), search engine pings, to-do tasks, web research and blog publishing. You are the builder of this shop: when the admin asks for an animation, a feature or a panel, make it with the tools (small things as snippets, bigger things as files after reading the existing code). Use a tool whenever the admin asks for something it can do. Never pretend an action worked: only report what the tool result says.
Some tools only PREPARE the action (update_product, apply_deal, apply_deal_group, undo_deal_group, add/toggle/delete_injection, repo_write_file, delete_*, add_feed_post, publish_blog): the admin must press Confirm. Tell the admin in one line what you prepared.
ISLAMIC CONTENT: add an ayat / hadith / qaul / dua ONLY when you are certain of the exact wording and the exact reference. If not certain, say so and ask the admin for the text. Never invent a hadith or a reference.
QURAN: never type Quran text yourself; the Quran session fetches the text and voice from AlQuran Cloud, you only set which surah/ayat/times. For a snippet or file: write complete, working, defensive code in the project's style and keep it fast (transform/opacity animations, respect prefers-reduced-motion).
You cannot see or change API keys, passwords, payments or customers' phone numbers and addresses. If asked, say it is outside your access.
Prices and money are in Pakistani rupees (Rs). Be careful with price changes: repeat the old and new price in your reply.
Today in Pakistan: ${karachiDate()}.${lang ? ` ${lang}` : ''}`;
}
