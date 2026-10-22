import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { FieldPath } from 'firebase-admin/firestore';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { archiveManifest, archiveProduct } from '@/lib/archive';
import { ghBlob, ghCommit, ghInfo, ghReadFile, ghReady } from '@/lib/github';
import { buildPart, mergeManifest, repoManifest, stageFiles } from '@/lib/archiveBuild';
import { MANIFEST_PATH, PART_SIZE, cleanDoc } from '@/lib/archiveFormat';
import { pingIndexNow } from '@/lib/indexnow';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s });

// Admin only. The product archive: old products move from Firebase into JSON files in the repository (data/catalog).
//  status                      -> what is live, what is archived, is GitHub connected
//  archive {count}             -> take the OLDEST live products, write them as the next part and commit them to GitHub (one commit)
//  export  {count}             -> same, but returns the files to download (when GitHub is not connected)
//  stage / commit              -> used by the CSV import for big files: stage one part (blobs), then one commit for all parts
//  clear   {n}                 -> delete from Firebase exactly the products of part n, but ONLY when that part is live on the website
//  get     {slug}              -> one archived product (to copy it back to Firebase for editing)
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const act = String(b.action || '');

  try {
    if (act === 'status') {
      const m = await archiveManifest();
      let live = null;
      if (adminReady()) { try { live = Number((await adminDb().collection('products').count().get()).data().count) || 0; } catch { /* count unavailable */ } }
      let repoParts = m.parts;
      if (ghReady()) { try { repoParts = (await repoManifest()).parts; } catch (e) { return json({ ok: true, live, archived: m.total, parts: m.parts, github: { ready: true, error: e.message, ...ghInfo() }, nextN: Math.max(0, ...m.parts.map((p) => p.n)) + 1 }); } }
      return json({ ok: true, live, archived: m.total, parts: m.parts, github: { ready: ghReady(), ...ghInfo() }, nextN: Math.max(0, ...repoParts.map((p) => p.n)) + 1, partSize: PART_SIZE });
    }

    if (act === 'exportLive') { // every live product, 300 per call (for "download everything")
      if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up.' }, 503);
      let q = adminDb().collection('products').orderBy(FieldPath.documentId()).limit(300);
      if (b.cursor) q = q.startAfter(String(b.cursor));
      const snap = await q.get();
      return json({ ok: true, docs: snap.docs.map((d) => ({ id: d.id, data: JSON.parse(JSON.stringify(d.data())) })), next: snap.size === 300 ? snap.docs[snap.size - 1].id : '' });
    }
    if (act === 'getPart') { // the text of one archive file (so the ZIP can contain the old parts too)
      const n = Math.floor(Number(b.n));
      const m = await archiveManifest();
      const meta = m.parts.find((p) => p.n === n);
      if (!meta) return json({ ok: false, error: `Part ${n} is not on the live website.` }, 404);
      const file = b.which === 'cards' ? meta.cards : meta.file;
      return json({ ok: true, text: await fs.readFile(path.join(process.cwd(), 'data', 'catalog', file), 'utf8') });
    }
    if (act === 'deleteExported') { // delete exactly the products that were put in a downloaded ZIP (only if unchanged since)
      if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up.' }, 503);
      if (b.confirm !== 'DELETE') return json({ ok: false, error: 'Type DELETE to confirm.' }, 400);
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).filter((x) => x && x.id);
      const db = adminDb();
      const snaps = items.length ? await db.getAll(...items.map((x) => db.collection('products').doc(String(x.id)))) : [];
      const batch = db.batch();
      let deleted = 0, kept = 0;
      snaps.forEach((s, k) => { if (!s.exists) return; if (Number(s.data().updatedAt || 0) === Number(items[k].updatedAt || 0)) { batch.delete(s.ref); batch.delete(db.collection('productCosts').doc(s.id)); deleted++; } else kept++; });
      if (deleted) await batch.commit();
      try { revalidateTag('catalog'); } catch { /* refreshes by itself */ }
      return json({ ok: true, deleted, kept });
    }

    if (act === 'get') {
      const p = await archiveProduct(String(b.slug || '').slice(0, 120));
      return p ? json({ ok: true, id: p.id, data: p.data }) : json({ ok: false, error: 'Not found in the archive.' }, 404);
    }

    if (act === 'stage') { // CSV import, big files
      if (!ghReady()) return json({ ok: false, error: 'GitHub is not connected (GITHUB_TOKEN and GITHUB_REPO in Vercel).' }, 503);
      const n = Math.floor(Number(b.n));
      const docs = (Array.isArray(b.products) ? b.products : []).slice(0, 1000).filter((d) => d && d.id && d.data);
      if (!(n >= 1) || !docs.length) return json({ ok: false, error: 'Nothing to stage.' }, 400);

      // PRICE LOCK (on by default). A product that already exists in the archive keeps the price it has -
      // re-uploading your CSV, or an export downloaded earlier, can never change a live price by accident.
      // Only products that are NEW in this import get the price from the CSV.
      let locked = 0;
      if (b.priceLock !== false) {
        try {
          const old = await repoManifest();
          const map = new Map();
          const parts = [...(old.parts || [])].sort((x, y) => (Number(y.n) || 0) - (Number(x.n) || 0)).slice(0, 200);
          for (const p of parts) {
            let rows = [];
            try { rows = JSON.parse((await ghReadFile(`data/catalog/${p.cards}`)) || '[]'); } catch { continue; }
            for (const r of rows) if (r && r.id && !map.has(r.id)) map.set(r.id, { price: Number(r.p) || 0, comparePrice: Number(r.c) || 0 });
            if (map.size >= docs.length * 6 + 2000) break; // enough to match this batch (newest parts first)
          }
          for (const d of docs) {
            const o = map.get(d.id);
            if (o && o.price > 0 && Number(d.data.price) !== o.price) {
              d.data = { ...d.data, price: o.price, ...(o.comparePrice ? { comparePrice: o.comparePrice } : {}) };
              locked++;
            }
          }
        } catch (e) { console.error('price lock skipped:', e.message); }
      }
      const built = buildPart(docs, n);
      return json({ ok: true, meta: built.meta, files: await stageFiles(built), locked });
    }
    if (act === 'commit') {
      if (!ghReady()) return json({ ok: false, error: 'GitHub is not connected.' }, 503);
      const metas = (Array.isArray(b.metas) ? b.metas : []).map((m) => ({ n: Number(m.n), file: String(m.file), cards: String(m.cards), count: Number(m.count) || 0, at: Number(m.at) || Date.now() }));
      const files = (Array.isArray(b.files) ? b.files : []).map((f) => ({ path: String(f.path), sha: String(f.sha) })).filter((f) => /^data\/catalog\/(part|cards)-\d{4}\.json$/.test(f.path));
      if (!metas.length || !files.length) return json({ ok: false, error: 'Nothing to commit.' }, 400);
      const manifest = mergeManifest(await repoManifest(), metas);
      const msh = await ghBlob(JSON.stringify(manifest, null, 1));
      const sha = await ghCommit([...files, { path: MANIFEST_PATH, sha: msh }], `Archive: add ${metas.length} product part(s), ${manifest.total} products in total`);
      pingIndexNow(['/products', '/', '/sitemap.xml']).catch(() => {});
      return json({ ok: true, commit: sha, total: manifest.total });
    }

    if (act === 'archive' || act === 'export') {
      if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up.' }, 503);
      const count = Math.max(50, Math.min(act === 'export' ? 400 : 1000, Math.floor(Number(b.count)) || PART_SIZE));
      const snap = await adminDb().collection('products').orderBy('createdAt', 'asc').limit(count + 40).get();
      const docs = snap.docs.filter((d) => d.data().active !== false).slice(0, count).map((d) => ({ id: d.id, data: JSON.parse(JSON.stringify(d.data())) }));
      if (!docs.length) return json({ ok: false, error: 'There are no live products to archive.' }, 400);
      const old = ghReady() ? await repoManifest() : await archiveManifest();
      const n = Math.max(0, ...old.parts.map((p) => p.n)) + 1;
      const built = buildPart(docs, n);
      if (act === 'export') {
        const manifest = mergeManifest(old, [built.meta]);
        return json({ ok: true, n, count: docs.length, files: { [built.meta.file]: built.part, [built.meta.cards]: built.cards, 'manifest.json': JSON.stringify(manifest, null, 1) } });
      }
      if (!ghReady()) return json({ ok: false, error: 'GitHub is not connected. Use "Download files" instead.' }, 503);
      const files = await stageFiles(built);
      const manifest = mergeManifest(old, [built.meta]);
      const msh = await ghBlob(JSON.stringify(manifest, null, 1));
      const sha = await ghCommit([...files, { path: MANIFEST_PATH, sha: msh }], `Archive part ${n}: ${docs.length} products (${manifest.total} archived in total)`);
      return json({ ok: true, n, count: docs.length, commit: sha });
    }

    if (act === 'clear') {
      if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up.' }, 503);
      const n = Math.floor(Number(b.n));
      // The part must be part of the RUNNING website (deployed), otherwise deleting from Firebase would lose products.
      const m = await archiveManifest();
      const meta = m.parts.find((p) => p.n === n);
      if (!meta) return json({ ok: false, notDeployed: true, error: `Part ${n} is not on the live website yet. Vercel is still deploying (1 to 3 minutes). Wait, then press Clear again.` });
      let rows;
      try { rows = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'catalog', meta.file), 'utf8')); } catch { return json({ ok: false, notDeployed: true, error: `The file of part ${n} is not readable on the live website yet. Wait for the deployment, then press Clear again.` }); }
      const db = adminDb();
      let deleted = 0, kept = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const snaps = await db.getAll(...chunk.map((r) => db.collection('products').doc(r.id)));
        const batch = db.batch();
        snaps.forEach((s, k) => {
          if (!s.exists) return;
          const same = Number(s.data().updatedAt || 0) === Number(chunk[k].updatedAt || 0); // edited since it was archived: keep it live
          if (same) { batch.delete(s.ref); deleted++; } else kept++;
        });
        await batch.commit();
      }
      try { revalidateTag('catalog'); } catch { /* refreshes by itself later */ }
      return json({ ok: true, deleted, kept, total: rows.length });
    }
    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('archive action failed:', act, e.message);
    return json({ ok: false, error: e.message || 'Archive failed.' }, 500);
  }
}
