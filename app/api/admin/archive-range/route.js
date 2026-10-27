import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { verifyAdmin } from '@/lib/adminAuth';
import { archiveManifest } from '@/lib/archive';
import { repoManifest } from '@/lib/archiveBuild';
import { MANIFEST_PATH, cardsFile, partFile } from '@/lib/archiveFormat';
import { archiveDateRange, assertArchivePair, omitArchiveIds, rangeSelectionKey, selectArchiveRange } from '@/lib/archiveRange';
import { ghBlob, ghCommit, ghHead, ghListDir, ghReadFile, ghReady } from '@/lib/github';
import { pingIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const SHA = /^[a-f0-9]{40}$/i;
const DIR = path.join(process.cwd(), 'data', 'catalog');
const fingerprint = (rows) => createHash('sha256').update(rangeSelectionKey(rows)).digest('hex');

// Bounded concurrency avoids hundreds of simultaneous GitHub requests on large catalogues.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let at = 0;
  const worker = async () => { while (at < items.length) { const i = at++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
async function snapshot(ref) {
  const github = ref !== 'deployed';
  if (github && (!ghReady() || !SHA.test(ref))) throw new Error('GitHub is not connected or the preview is invalid. Preview again.');
  const m = github ? await repoManifest(ref) : await archiveManifest();
  const nums = new Set();
  const parts = (Array.isArray(m.parts) ? m.parts : []).map((p) => {
    const n = Number(p.n);
    if (!Number.isInteger(n) || n < 1 || n > 9999 || nums.has(n) || p.file !== partFile(n) || p.cards !== cardsFile(n)) throw new Error('Archive manifest has invalid or duplicate part names; no changes were made.');
    nums.add(n); return { ...p, n };
  }).sort((a, b) => b.n - a.n);
  // archiveManifest scans for files missing from the manifest; do the same safety check on GitHub.
  // Refuse a destructive operation rather than overlook an older version of a product.
  if (github) {
    const names = await ghListDir('data/catalog', ref);
    if (names.length >= 1000) throw new Error('Archive directory has 1000 or more files; this operation is stopped to avoid missing parts.');
    const found = names.map((f) => (f.match(/^cards-(\d{4})\.json$/) || [])[1]).filter(Boolean).map(Number);
    if (found.some((n) => !nums.has(n))) throw new Error('Archive contains parts missing from its manifest. Repair the manifest before using date-range operations.');
  }
  return { github, parts };
}
async function readRows(part, which, ref, github) {
  const file = which === 'cards' ? part.cards : part.file;
  const text = github ? await ghReadFile(`data/catalog/${file}`, ref) : await fs.readFile(path.join(DIR, file), 'utf8');
  if (text === null) throw new Error(`Archive file ${file} is missing; no changes were made.`);
  let rows;
  try { rows = JSON.parse(text); } catch { throw new Error(`Archive file ${file} is invalid; no changes were made.`); }
  if (!Array.isArray(rows)) throw new Error(`Archive file ${file} is invalid; no changes were made.`);
  return rows;
}

export async function POST(req) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  let body; try { body = await req.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
  const action = String(body.action || '');
  try {
    if (action === 'preview') {
      const range = archiveDateRange(body.from, body.to);
      const ref = ghReady() ? await ghHead() : 'deployed';
      const snap = await snapshot(ref);
      const parts = await mapLimit(snap.parts, 6, async (part) => ({ n: part.n, rows: await readRows(part, 'cards', ref, snap.github) }));
      const result = selectArchiveRange(parts, range);
      return json({ ok: true, ref, digest: fingerprint(result.matches), canDelete: snap.github, count: result.matches.length, undated: result.undated, total: result.total,
        parts: snap.parts.map((p) => p.n), sample: result.matches.slice(0, 12).map(({ row: r }) => ({ id: r.id, name: r.n || '', createdAt: r.t || 0, hidden: r.x === 0 })) });
    }
    if (action === 'part') {
      const ref = String(body.ref || '');
      const snap = await snapshot(ref);
      const part = snap.parts.find((p) => p.n === Number(body.n));
      if (!part) return json({ ok: false, error: 'Part is not in this snapshot.' }, 404);
      return json({ ok: true, rows: await readRows(part, 'part', ref, snap.github) });
    }
    if (action === 'delete') {
      if (!ghReady()) return json({ ok: false, error: 'GitHub must be connected to delete archived products.' }, 503);
      const range = archiveDateRange(body.from, body.to);
      const ref = String(body.ref || '');
      const expectedCount = Number(body.count);
      if (!SHA.test(ref) || !Number.isSafeInteger(expectedCount) || expectedCount < 1 || body.confirm !== `DELETE ${expectedCount}`) return json({ ok: false, error: 'Preview first and type DELETE followed by the product count.' }, 400);
      if (await ghHead() !== ref) return json({ ok: false, error: 'Repository changed since preview. Preview again before deleting.' }, 409);
      const snap = await snapshot(ref);
      const full = await mapLimit(snap.parts, 6, async (part) => {
        const [rows, cards] = await Promise.all([readRows(part, 'part', ref, true), readRows(part, 'cards', ref, true)]);
        assertArchivePair(part.n, rows, cards);
        return { n: part.n, rows, cards };
      });
      const selected = selectArchiveRange(full, range);
      if (selected.matches.length !== expectedCount || fingerprint(selected.matches) !== body.digest) return json({ ok: false, error: 'Full product data differs from the preview. Nothing was deleted; repair the archive and preview again.' }, 409);
      const ids = new Set(selected.matches.map(({ row }) => String(row.id)));
      const files = [];
      const nextParts = await mapLimit(snap.parts, 4, async (part) => {
        const original = full.find((p) => p.n === part.n);
        const { rows: remaining, cards } = omitArchiveIds(original.rows, original.cards, ids);
        if (remaining.length !== original.rows.length) {
          const [fullSha, cardSha] = await Promise.all([ghBlob(JSON.stringify(remaining)), ghBlob(JSON.stringify(cards))]);
          files.push({ path: `data/catalog/${part.file}`, sha: fullSha }, { path: `data/catalog/${part.cards}`, sha: cardSha });
        }
        return { ...part, count: remaining.length };
      });
      nextParts.sort((a, b) => a.n - b.n);
      const manifest = { version: 1, total: nextParts.reduce((s, p) => s + p.count, 0), parts: nextParts };
      files.push({ path: MANIFEST_PATH, sha: await ghBlob(JSON.stringify(manifest, null, 1)) });
      const commit = await ghCommit(files, `Archive: remove ${ids.size} products added ${body.from} to ${body.to}`, ref);
      try { revalidateTag('catalog'); } catch { /* the deployment refreshes the archive */ }
      pingIndexNow(['/products', '/sitemap.xml']).catch(() => {});
      return json({ ok: true, count: ids.size, commit });
    }
    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('archive range failed:', action, e.message);
    return json({ ok: false, error: String(e.message || 'Archive range operation failed.').slice(0, 300) }, e.status === 409 ? 409 : 400);
  }
}
