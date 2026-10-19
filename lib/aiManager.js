import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from './firebase-admin';
import { getProducts } from './products';
import { parseVideo } from './video';
import { cleanFeedItem } from './islamic';
import { SEASON_MODES } from './season';
import { getThemeMode } from './themeServer';
import { getSiteStatus } from './siteGate';
import { ghBlob, ghCommit, ghReadFile, ghReady } from './github';
import { geminiCall, ladderFor, loadAssistant, textOf } from './gemini';

// ADMIN AI MANAGER: the tools the manager AI may use. It does NOT get raw database access. It gets this fixed list, nothing else:
//   * safe tools run at once and are written to the log (aiManagerLog)
//   * RISKY tools (they change prices, delete things, publish religious texts or blog posts) are only PREPARED: the admin sees exactly
//     what will happen and must press Confirm. The AI can never confirm by itself.
//   * it can never read or change API keys, passwords, payout details or customer addresses / phone numbers.
export const RISKY = new Set(['update_product', 'delete_reel', 'add_feed_post', 'delete_feed_post', 'publish_blog']);

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
  return { error: 'Unknown action.' };
}

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
          contents: [{ role: 'user', parts: [{ text: `Research this for a Pakistani online shop owner. Answer in at most 170 words, in simple English. Use only what you find with search. Say clearly when you are not sure.\n\n${clip(a.query, 300)}` }] }],
          tools: [{ google_search: {} }], generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }, { timeoutMs: 20000, deadlineMs: 30000, maxTries: 3 });
        if (!r.ok) return { ok: false, error: `Research is not available right now (${r.status}).` };
        const gm = r.json.candidates && r.json.candidates[0] && r.json.candidates[0].groundingMetadata;
        const sources = ((gm && gm.groundingChunks) || []).map((c) => c.web && { title: clip(c.web.title, 60), url: c.web.uri }).filter(Boolean).slice(0, 5);
        return { ok: true, data: { answer: textOf(r.json).slice(0, 1500), sources }, summary: 'Research done.' };
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
  return `You are the operations manager AI of MIZANORA, a Pakistani online shop. You work ONLY for the shop owner / admin who is talking to you now. Reply in the same language the admin writes (Roman Urdu, Urdu or English), short and clear.
You can act through your tools: season look, video feed (reels), Islamic feed posts, products (search / price / stock), to-do tasks, web research and blog publishing. Use a tool whenever the admin asks for something it can do. Never pretend an action worked: only report what the tool result says.
Some tools only PREPARE the action (update_product, delete_*, add_feed_post, publish_blog): the admin must press Confirm. Tell the admin in one line what you prepared.
ISLAMIC CONTENT: add an ayat / hadith / qaul / dua ONLY when you are certain of the exact wording and the exact reference. If not certain, say so and ask the admin for the text. Never invent a hadith or a reference.
You cannot see or change API keys, passwords, payments or customers' phone numbers and addresses. If asked, say it is outside your access.
Prices and money are in Pakistani rupees (Rs). Be careful with price changes: repeat the old and new price in your reply.
Today in Pakistan: ${karachiDate()}.${lang ? ` ${lang}` : ''}`;
}
