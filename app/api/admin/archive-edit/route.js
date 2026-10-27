import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { archiveManifest } from '@/lib/archive';
import { buildPart, mergeManifest, repoManifest, stageFiles } from '@/lib/archiveBuild';
import { ghBlob, ghCommit, ghHead, ghInfo, ghReadFile, ghReady } from '@/lib/github';
import { pingIndexNow } from '@/lib/indexnow';
import { MANIFEST_PATH } from '@/lib/archiveFormat';
import { mergeArchiveProduct } from '@/lib/archiveProductEdit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin only. THE ZERO-FIREBASE CATALOGUE (Admin > Catalogue).
// The whole shop can live in the JSON files of data/catalog: this route lets you browse, edit, hide and re-price those
// products WITHOUT writing anything to Firestore. Every change is committed to your repository as a small new part,
// and the archive reader already knows that the NEWEST part wins - so the shop shows the new price after the deploy.
//   parts                                  -> the parts in the repository (+ how many products in total)
//   list    { n }                          -> the products of one part (slim rows)
//   hide / show / soldout / feature { id }  -> flip one field (server reads the current product itself)
//   save    { id, data }                   -> write a full product as a new part (edited name, price, photos...)
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

// One product: the newest part that holds it wins (newest files first, GitHub is the truth).
async function findDocs(ids, ref) {
  const pending = new Set(ids.map(String));
  const found = new Map();
  const m = await repoManifest(ref);
  const parts = [...(m.parts || [])].sort((a, b) => (Number(b.n) || 0) - (Number(a.n) || 0));
  for (const p of parts) {
    if (!pending.size) break;
    const cardsText = await ghReadFile(`data/catalog/${p.cards}`, ref);
    if (cardsText === null) throw new Error(`Missing archive cards for part ${p.n}.`);
    const cards = JSON.parse(cardsText);
    if (!Array.isArray(cards)) throw new Error(`Invalid archive cards for part ${p.n}.`);
    const wanted = new Set(cards.filter((r) => r && pending.has(String(r.id))).map((r) => String(r.id)));
    if (!wanted.size) continue;
    const text = await ghReadFile(`data/catalog/${p.file}`, ref);
    if (text === null) throw new Error(`Missing archive part ${p.n}.`);
    const rows = JSON.parse(text);
    if (!Array.isArray(rows)) throw new Error(`Invalid archive part ${p.n}.`);
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]; const id = String(row && row.id);
      if (wanted.has(id)) { found.set(id, row); pending.delete(id); wanted.delete(id); }
    }
    if (wanted.size) throw new Error(`Archive part ${p.n} and its cards disagree.`);
  }
  return { found, manifest: m };
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!ghReady()) return json({ ok: false, code: 'no-github', error: 'GITHUB_TOKEN + GITHUB_REPO are needed to change products in the files. Without them the shop can still READ the archive, but not edit it.' }, 503);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const act = String(b.action || '');

  try {
    if (act === 'parts') {
      const m = await repoManifest();
      const local = await archiveManifest().catch(() => ({ parts: [], total: 0 }));
      return json({ ok: true, parts: m.parts || [], total: Number(m.total) || 0, deployedParts: (local.parts || []).length, github: ghInfo() });
    }

    if (act === 'list') {
      const m = await repoManifest();
      const part = (m.parts || []).find((p) => Number(p.n) === Math.floor(Number(b.n)));
      if (!part) return json({ ok: false, error: `Part ${b.n} is not in the repository.` }, 404);
      const rows = JSON.parse((await ghReadFile(`data/catalog/${part.cards}`)) || '[]');
      return json({
        ok: true, n: Number(part.n), count: Number(part.count) || rows.length, at: Number(part.at) || 0,
        rows: (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, name: r.n, price: r.p, comparePrice: r.c || 0, image: r.i || '', categories: r.k || [], inStock: r.s !== 0, featured: Boolean(r.f), active: r.x !== 0, createdAt: r.t || 0 })),
      });
    }

    if (act === 'get') {
      const id = clip(b.id, 140).trim();
      if (!id) return json({ ok: false, error: 'Which product?' }, 400);
      const ref = await ghHead();
      const hit = (await findDocs([id], ref)).found.get(id);
      if (!hit) return json({ ok: false, error: 'Product not found in the repository.' }, 404);
      const { id: ignored, ...data } = hit;
      return json({ ok: true, id, data, ref });
    }

    if (act === 'hideMany') {
      // Bulk show/hide (used by the photo check: every product whose photo is broken is hidden in ONE commit).
      const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 400).map((x) => clip(x, 140).trim()).filter(Boolean);
      if (!ids.length) return json({ ok: false, error: 'Which products?' }, 400);
      const hide = b.hidden !== false;
      const ref = await ghHead();
      const { found, manifest: old } = await findDocs(ids, ref);
      const docs = ids.filter((id) => found.has(id)).map((id) => ({ id, data: mergeArchiveProduct(found.get(id), { active: !hide }) }));
      if (!docs.length) return json({ ok: false, error: 'These products are not in the deployed archive yet. Wait for the deploy (1 to 3 minutes) and try again.' }, 404);
      const n = Math.max(0, ...(old.parts || []).map((p) => Number(p.n) || 0)) + 1;
      const built = buildPart(docs, n);
      const files = await stageFiles(built);
      const manifest = mergeManifest(old, [built.meta]);
      const msh = await ghBlob(JSON.stringify(manifest, null, 1));
      const sha = await ghCommit([...files, { path: MANIFEST_PATH, sha: msh }], `Catalogue: ${hide ? 'hide' : 'show'} ${docs.length} product(s) (part ${n})`, ref);
      try { revalidateTag('catalog'); } catch { /* the next deploy refreshes it anyway */ }
      pingIndexNow(['/products']).catch(() => {});
      return json({ ok: true, commit: sha, n, count: docs.length, hidden: hide });
    }

    if (act === 'save' || act === 'patch') {
      const id = clip(b.id, 140).trim();
      if (!id) return json({ ok: false, error: 'Which product?' }, 400);
      // Always read the newest GitHub version; the currently deployed copy may be one edit behind.
      const ref = await ghHead();
      const { found, manifest: old } = await findDocs([id], ref);
      const existing = found.get(id);
      if (!existing) return json({ ok: false, error: 'This product is no longer in the archive.' }, 404);
      const changes = act === 'save' ? (b.data || {}) : (b.patch || {});
      const doc = mergeArchiveProduct(existing, changes);
      if (!doc.name || !(doc.price > 0)) return json({ ok: false, error: 'A product needs a name and a price.' }, 400);

      const n = Math.max(0, ...(old.parts || []).map((p) => Number(p.n) || 0)) + 1;
      const built = buildPart([{ id, data: doc }], n);
      const files = await stageFiles(built);
      const manifest = mergeManifest(old, [built.meta]);
      const msh = await ghBlob(JSON.stringify(manifest, null, 1));
      const sha = await ghCommit([...files, { path: MANIFEST_PATH, sha: msh }], `Catalogue: ${act === 'save' ? 'edit' : 'update'} ${id} (part ${n})`, ref);
      try { revalidateTag('catalog'); } catch { /* the next deploy refreshes it anyway */ }
      pingIndexNow(doc.active === false ? '/' : [`/product/${id}`, '/products']).catch(() => {});
      return json({ ok: true, commit: sha, n, id, price: doc.price, active: doc.active, inStock: doc.inStock, featured: doc.featured });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('catalogue action failed:', act, e.message);
    return json({ ok: false, error: String(e.message || e).slice(0, 200) }, 500);
  }
}
