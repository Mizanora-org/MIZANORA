import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from './firebase-admin';
import { DEALS_DOC } from './deals';
import { archiveBrowseList, archiveProduct } from './archive';
import { cleanGroup, groupPrice, matchesGroup } from './dealGroups';

// Server side of the deal groups: PREVIEW what would change, APPLY it to the LIVE products, or UNDO it.
// A product keeps a note of what happened (dealGroup, dealBase = the price before, dealSet = the price the deal set, dealPrevCompare).
// UNDO only touches products whose price is still the one the deal set, so a price the admin changed by hand later is never overwritten.
// Prices never go under (cost + Rs 50) when a cost is known. Products of the file catalogue (archive) are not changed here.
const KEEP_OVER_COST = 50;
const ARCHIVE_CAP = 300; // products of the file catalogue turned into a deal by ONE group (each becomes one small live product)

async function allLive() {
  const s = await adminDb().collection('products').get();
  return s.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}
async function costs(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const refs = ids.slice(i, i + 200).map((id) => adminDb().collection('productCosts').doc(id));
    try { (await adminDb().getAll(...refs)).forEach((d, n) => { if (d.exists) out.set(ids[i + n], Number(d.data().cost) || 0); }); } catch { /* costs unknown: no floor */ }
  }
  return out;
}

export async function planGroup(g) {
  const liveAll = await allLive();
  const liveIds = new Set(liveAll.map((p) => p.id));
  const live = liveAll.filter((p) => p.active !== false && p.inStock !== false && matchesGroup(p, g));
  // Products that only exist in the catalogue files (archive): they become a deal through a small LIVE copy that wins over the file copy.
  let arch = []; let archiveTooMany = 0; let archiveOff = false;
  try {
    const list = (await archiveBrowseList({})).filter((c) => !liveIds.has(String(c.id)) && c.inStock !== false && matchesGroup(c, g));
    if (list.length > ARCHIVE_CAP) archiveTooMany = list.length - ARCHIVE_CAP;
    arch = list.slice(0, ARCHIVE_CAP);
  } catch { archiveOff = true; }
  const cost = await costs([...live, ...arch].map((p) => String(p.id)));
  const change = []; const skipped = [];
  for (const p of [...live.map((x) => ({ x, from: 'live' })), ...arch.map((x) => ({ x, from: 'archive' }))]) {
    const q = p.x;
    const inDeal = p.from === 'live' && q.dealGroup === g.id && Number(q.dealBase) > 0;
    const base = inDeal ? Number(q.dealBase) : (Number(q.comparePrice) > Number(q.price) ? Number(q.comparePrice) : Number(q.price));
    const np = groupPrice(base, g);
    if (!np) { skipped.push(`${q.name}: no lower price possible`); continue; }
    const c = cost.get(String(q.id)) || 0;
    if (c && np < c + KEEP_OVER_COST) { skipped.push(`${q.name}: would go under cost + Rs ${KEEP_OVER_COST}`); continue; }
    change.push({ id: String(q.id), from: p.from, ref: p.from === 'live' ? q.ref : null, name: q.name, base, now: Number(q.price) || 0, to: np, prevCompare: inDeal ? Number(q.dealPrevCompare) || 0 : Number(q.comparePrice) || 0 });
  }
  return { change, skipped, archiveTooMany, archiveOff, liveCount: live.length, archiveCount: arch.length };
}

export async function previewGroup(raw) {
  const g = cleanGroup(raw);
  if (!g || !(g.words.length || g.ids.length)) return { ok: false, error: 'Give the group a name and at least one word (for example: shirt, tshirt) or choose some products.' };
  if (!g.pct && !g.price) return { ok: false, error: 'Set a percent off or a fixed price.' };
  const { change, skipped, archiveTooMany, archiveOff, liveCount, archiveCount } = await planGroup(g);
  return { ok: true, count: change.length, liveCount, archiveCount, archiveTooMany, archiveOff, sample: change.slice(0, 8).map((c) => ({ name: String(c.name).slice(0, 60), from: c.now, to: c.to })), skipped: skipped.slice(0, 6), skippedCount: skipped.length };
}

export async function applyGroup(raw) {
  const g = cleanGroup(raw);
  if (!g || !(g.words.length || g.ids.length) || !(g.pct || g.price)) return { ok: false, error: 'The group needs words or chosen products, and a rate.' };
  const { change, skipped, archiveTooMany, archiveOff } = await planGroup(g);
  const now = Date.now();
  const mark = (c) => ({ price: c.to, comparePrice: c.base, dealGroup: g.id, dealBase: c.base, dealSet: c.to, dealPrevCompare: c.prevCompare, updatedAt: now });
  // Live products: just the new price. File-catalogue products: a live copy (a "deal copy") with the new price; undo deletes the copy.
  const live = change.filter((c) => c.from === 'live');
  for (let i = 0; i < live.length; i += 400) {
    const b = adminDb().batch();
    for (const c of live.slice(i, i + 400)) b.update(c.ref, mark(c));
    await b.commit();
  }
  let made = 0; let lost = 0;
  const arch = change.filter((c) => c.from === 'archive');
  for (let i = 0; i < arch.length; i += 25) {
    const part = await Promise.all(arch.slice(i, i + 25).map(async (c) => { try { return { c, p: await archiveProduct(c.id) }; } catch { return { c, p: null }; } }));
    const b = adminDb().batch();
    for (const { c, p } of part) {
      if (!p || !p.data) { lost += 1; continue; }
      b.set(adminDb().collection('products').doc(c.id), { ...p.data, ...mark(c), fromArchive: true });
      made += 1;
    }
    await b.commit();
  }
  refresh();
  const n = live.length + made;
  return { ok: true, count: n, skipped: skipped.length, summary: `${n} product(s) of "${g.name}" are now a deal (${g.price ? `Rs ${g.price}` : `${g.pct}% off`}): ${live.length} live + ${made} from the catalogue files.${skipped.length ? ` ${skipped.length} skipped.` : ''}${archiveTooMany ? ` ${archiveTooMany} more matched but one group handles ${ARCHIVE_CAP} catalogue-file products: narrow the words or make a second group.` : ''}${archiveOff ? ' The catalogue files could not be read (GitHub not connected), so only live products were changed.' : ''}${lost ? ` ${lost} could not be read.` : ''}` };
}

export async function undoGroup(id) {
  const s = await adminDb().collection('products').where('dealGroup', '==', String(id)).get();
  let n = 0; let kept = 0;
  const docs = s.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const b = adminDb().batch();
    for (const d of docs.slice(i, i + 400)) {
      const p = d.data();
      if (p.fromArchive) { b.delete(d.ref); n += 1; continue; } // the file copy (old price) shows again
      if (Number(p.price) !== Number(p.dealSet)) { kept += 1; b.update(d.ref, { dealGroup: null, dealBase: null, dealSet: null, dealPrevCompare: null }); continue; } // price changed by hand: leave it
      b.update(d.ref, { price: Number(p.dealBase) || Number(p.price), comparePrice: Number(p.dealPrevCompare) || 0, dealGroup: null, dealBase: null, dealSet: null, dealPrevCompare: null, updatedAt: Date.now() });
      n += 1;
    }
    await b.commit();
  }
  refresh();
  return { ok: true, count: n, kept, summary: `${n} product(s) are back to their old price.${kept ? ` ${kept} had a price changed by hand and were left as they are.` : ''}` };
}

function refresh() { try { revalidateTag('catalog'); revalidatePath('/', 'layout'); revalidatePath('/deals'); } catch { /* refreshes by itself soon */ } }
export { DEALS_DOC };
