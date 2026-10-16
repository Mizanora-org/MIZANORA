import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { archiveManifest, archiveProduct } from '@/lib/archive';
import { buildPart, mergeManifest, repoManifest, stageFiles } from '@/lib/archiveBuild';
import { ghBlob, ghCommit, ghInfo, ghReadFile, ghReady } from '@/lib/github';
import { MANIFEST_PATH } from '@/lib/archiveFormat';

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

const cleanDoc = (data = {}) => {
  const images = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8).map((u) => clip(u, 500)) : [];
  const categories = (Array.isArray(data.categories) ? data.categories : String(data.categories || '').split(','))
    .map((c) => clip(c, 60).trim()).filter(Boolean).slice(0, 6);
  const out = {
    name: clip(data.name, 160), price: Math.max(0, Math.floor(Number(data.price) || 0)), comparePrice: Math.max(0, Math.floor(Number(data.comparePrice) || 0)),
    description: clip(data.description, 5000), images, categories, category: categories[0] || clip(data.category, 60),
    inStock: data.inStock !== false, featured: Boolean(data.featured), active: data.active !== false,
    affOn: data.affOn !== false, affRate: Math.max(0, Math.min(50, Math.floor(Number(data.affRate) || 0))),
    createdAt: Number(data.createdAt) || Date.now(), updatedAt: Date.now(),
  };
  if (Array.isArray(data.options)) out.options = data.options.slice(0, 6).map((o) => ({ name: clip(o.name, 40), values: (o.values || []).slice(0, 30).map((v) => clip(v, 40)) }));
  if (Array.isArray(data.specs)) out.specs = data.specs.slice(0, 20).map((s) => clip(s, 120));
  if (Array.isArray(data.videos)) out.videos = data.videos.filter(Boolean).slice(0, 6).map((u) => clip(u, 500));
  return out;
};

// One product: the newest part that holds it wins (newest files first, GitHub is the truth).
async function findDoc(id, maxParts = 6) {
  const m = await repoManifest();
  const parts = [...(m.parts || [])].sort((a, b) => (Number(b.n) || 0) - (Number(a.n) || 0)).slice(0, maxParts);
  for (const p of parts) {
    try {
      const text = await ghReadFile(`data/catalog/${p.file}`);
      const rows = JSON.parse(text || '[]');
      const hit = Array.isArray(rows) ? rows.find((r) => r && String(r.id) === String(id)) : null;
      if (hit) return hit;
    } catch { /* try the next part */ }
  }
  return null;
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

    if (act === 'save' || act === 'patch') {
      const id = clip(b.id, 140).trim();
      if (!id) return json({ ok: false, error: 'Which product?' }, 400);
      let data = null;
      if (act === 'save') data = b.data;
      else {
        // The server reads the product itself, so a "hide" can never wipe the other fields.
        data = await archiveProduct(id).then((p) => (p ? p.data : null)).catch(() => null);
        if (!data) data = await findDoc(id, 8);
        if (!data) return json({ ok: false, error: 'This product is not in the deployed archive yet. Wait for the deploy (1 to 3 minutes) and try again.' }, 404);
        data = { ...data, ...(b.patch || {}) };
      }
      const doc = cleanDoc({ ...data, id: undefined });
      if (!doc.name || !(doc.price > 0)) return json({ ok: false, error: 'A product needs a name and a price.' }, 400);

      const old = await repoManifest();
      const n = Math.max(0, ...(old.parts || []).map((p) => Number(p.n) || 0)) + 1;
      const built = buildPart([{ id, data: doc }], n);
      const files = await stageFiles(built);
      const manifest = mergeManifest(old, [built.meta]);
      const msh = await ghBlob(JSON.stringify(manifest, null, 1));
      const sha = await ghCommit([...files, { path: MANIFEST_PATH, sha: msh }], `Catalogue: ${act === 'save' ? 'edit' : 'update'} ${id} (part ${n})`);
      try { revalidateTag('catalog'); } catch { /* the next deploy refreshes it anyway */ }
      return json({ ok: true, commit: sha, n, id, price: doc.price, active: doc.active, inStock: doc.inStock, featured: doc.featured });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('catalogue action failed:', act, e.message);
    return json({ ok: false, error: String(e.message || e).slice(0, 200) }, 500);
  }
}
