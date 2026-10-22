import { revalidatePath, revalidateTag } from 'next/cache';
import { adminDb } from './firebase-admin';
import { DEALS_DOC } from './deals';
import { cleanGroup, groupPrice, matchesGroup } from './dealGroups';

// Server side of the deal groups: PREVIEW what would change, APPLY it to the LIVE products, or UNDO it.
// A product keeps a note of what happened (dealGroup, dealBase = the price before, dealSet = the price the deal set, dealPrevCompare).
// UNDO only touches products whose price is still the one the deal set, so a price the admin changed by hand later is never overwritten.
// Prices never go under (cost + Rs 50) when a cost is known. Products of the file catalogue (archive) are not changed here.
const KEEP_OVER_COST = 50;

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
  const live = (await allLive()).filter((p) => p.active !== false && p.inStock !== false && matchesGroup(p, g));
  const cost = await costs(live.map((p) => p.id));
  const change = []; const skipped = [];
  for (const p of live) {
    const inDeal = p.dealGroup === g.id && Number(p.dealBase) > 0;
    const base = inDeal ? Number(p.dealBase) : (Number(p.comparePrice) > Number(p.price) ? Number(p.comparePrice) : Number(p.price));
    const np = groupPrice(base, g);
    if (!np) { skipped.push(`${p.name}: no lower price possible`); continue; }
    const c = cost.get(p.id) || 0;
    if (c && np < c + KEEP_OVER_COST) { skipped.push(`${p.name}: would go under cost + Rs ${KEEP_OVER_COST}`); continue; }
    change.push({ id: p.id, ref: p.ref, name: p.name, base, from: Number(p.price) || 0, to: np, prevCompare: inDeal ? Number(p.dealPrevCompare) || 0 : Number(p.comparePrice) || 0, inDeal });
  }
  return { change, skipped };
}

export async function previewGroup(raw) {
  const g = cleanGroup(raw);
  if (!g || !g.words.length) return { ok: false, error: 'Give the group a name and at least one word (for example: shirt, tshirt).' };
  if (!g.pct && !g.price) return { ok: false, error: 'Set a percent off or a fixed price.' };
  const { change, skipped } = await planGroup(g);
  return { ok: true, count: change.length, sample: change.slice(0, 8).map((c) => ({ name: String(c.name).slice(0, 60), from: c.from, to: c.to })), skipped: skipped.slice(0, 6), skippedCount: skipped.length };
}

export async function applyGroup(raw) {
  const g = cleanGroup(raw);
  if (!g || !g.words.length || !(g.pct || g.price)) return { ok: false, error: 'The group needs words and a rate.' };
  const { change, skipped } = await planGroup(g);
  const now = Date.now();
  for (let i = 0; i < change.length; i += 400) {
    const b = adminDb().batch();
    for (const c of change.slice(i, i + 400)) b.update(c.ref, { price: c.to, comparePrice: c.base, dealGroup: g.id, dealBase: c.base, dealSet: c.to, dealPrevCompare: c.prevCompare, updatedAt: now });
    await b.commit();
  }
  refresh();
  return { ok: true, count: change.length, skipped: skipped.length, summary: `${change.length} product(s) of "${g.name}" are now a deal (${g.price ? `Rs ${g.price}` : `${g.pct}% off`}).${skipped.length ? ` ${skipped.length} skipped.` : ''}` };
}

export async function undoGroup(id) {
  const s = await adminDb().collection('products').where('dealGroup', '==', String(id)).get();
  let n = 0; let kept = 0;
  const docs = s.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const b = adminDb().batch();
    for (const d of docs.slice(i, i + 400)) {
      const p = d.data();
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
