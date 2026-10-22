import { revalidatePath, revalidateTag } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { checkImages } from './imageCheck';

// One product whose photos may be broken. Broken photos are removed from the product; when NO working photo is left the product is
// hidden from the shop (active:false) and moved to the admin "Photo errors" list (collection imageErrors) so you can fix or delete it.
let lastTag = 0;
export function refreshShop(slug) {
  try {
    if (Date.now() - lastTag > 60e3) { lastTag = Date.now(); revalidateTag('catalog'); } // at most once a minute: a refresh re-reads the catalogue
    if (slug) revalidatePath(`/product/${String(slug).slice(0, 90)}`);
  } catch { /* the pages also refresh by themselves */ }
}

// -> { found, state: 'ok' | 'hidden' | 'trimmed' | 'unknown' | 'skipped', bad: [urls] }
export async function inspectProduct(slug, { source = 'visitor', all = true, snap = null } = {}) {
  const db = adminDb();
  const ref = db.collection('products').doc(slug);
  const doc = snap || await ref.get();
  if (!doc.exists) return { found: false, state: 'skipped', bad: [] };
  const x = doc.data();
  if (x.active === false && x.hiddenReason !== 'image') return { found: true, state: 'skipped', bad: [] }; // hidden on purpose by the admin
  const images = (Array.isArray(x.images) ? x.images : []).filter(Boolean);
  const errRef = db.collection('imageErrors').doc(slug);
  const stamp = { slug, name: String(x.name || '').slice(0, 120), price: Number(x.price) || 0, category: String(x.category || '').slice(0, 60), lastAt: Date.now(), source };

  if (!images.length) {
    await ref.set({ active: false, hiddenReason: 'image', updatedAt: Date.now() }, { merge: true });
    await errRef.set({ ...stamp, reason: 'no photo', badImages: [], hidden: true, status: 'open', count: FieldValue.increment(1) }, { merge: true });
    refreshShop(slug);
    return { found: true, state: 'hidden', bad: [] };
  }
  const list = all ? images.slice(0, 8) : images.slice(0, 1);
  const res = await checkImages(list);
  const bad = res.filter((r) => r.state === 'bad');
  const unknown = res.filter((r) => r.state === 'unknown');
  if (!bad.length) return { found: true, state: unknown.length === list.length ? 'unknown' : 'ok', bad: [] };

  const badUrls = new Set(bad.map((b) => b.url));
  const good = images.filter((u) => !badUrls.has(u));
  const hide = good.length === 0 && unknown.length === 0; // nothing works and nothing is merely uncertain
  if (!hide && !good.length) return { found: true, state: 'unknown', bad: [...badUrls] };
  const patch = { images: good, updatedAt: Date.now() };
  if (hide) { patch.active = false; patch.hiddenReason = 'image'; }
  await ref.set(patch, { merge: true });
  await errRef.set({ ...stamp, reason: bad[0].why || 'photo does not load', badImages: [...badUrls].slice(0, 8), hidden: hide, status: hide ? 'open' : 'trimmed', count: FieldValue.increment(1) }, { merge: true });
  refreshShop(slug);
  return { found: true, state: hide ? 'hidden' : 'trimmed', bad: [...badUrls] };
}
