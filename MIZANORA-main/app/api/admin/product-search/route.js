import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { ghReady, ghReadFile, ghInfo } from '@/lib/github';
import { MANIFEST_PATH, rowToCard } from '@/lib/archiveFormat';
import { adminHit, adminScore } from '@/lib/adminSearch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin only. SEARCH INSIDE THE PRODUCT ARCHIVE (the old products that live as JSON files in your repository, not in Firebase).
// The admin panel searches the live products in the browser itself (Firestore), and calls THIS route for the archive part.
// Body: { q: 'kurti silk', maxParts: 12, limit: 40 }
// Reads only the slim "cards" files, newest part first, and stops as soon as it has enough hits - so a 50,000-product
// archive answers in a second or two without any Firestore read.
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

let manifestCache = { t: 0, text: null };
async function manifestText() {
  if (manifestCache.text && Date.now() - manifestCache.t < 60e3) return manifestCache.text;
  const text = await ghReadFile(MANIFEST_PATH);
  manifestCache = { t: Date.now(), text: text || '' };
  return manifestCache.text;
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!ghReady()) {
    return json({
      ok: false,
      code: 'no-github',
      error: `${ghInfo().repo ? 'GitHub is not connected' : 'GITHUB_TOKEN + GITHUB_REPO are not set in Vercel'}, so archived products cannot be searched from here. Archived products are the old ones you moved out of Firebase (data/catalog).`,
    }, 503);
  }

  let b; try { b = await req.json(); } catch { b = {}; }
  const q = String(b.q || '').trim().slice(0, 120);
  if (!q) return json({ ok: false, error: 'Type something to search.' }, 400);
  const maxParts = Math.max(1, Math.min(30, Math.floor(Number(b.maxParts)) || 12));
  const limit = Math.max(1, Math.min(60, Math.floor(Number(b.limit)) || 40));

  let manifest;
  try { manifest = JSON.parse(await manifestText() || 'null'); } catch { manifest = null; }
  const parts = Array.isArray(manifest && manifest.parts) ? manifest.parts : [];
  if (!parts.length) return json({ ok: true, q, hits: [], scanned: 0, totalParts: 0, total: 0, empty: true });

  // Newest part first: a re-imported product beats its older copy.
  const order = [...parts].sort((x, y) => (Number(y.n) || 0) - (Number(x.n) || 0)).slice(0, maxParts);
  const seen = new Set();
  const hits = [];
  let scanned = 0;
  const started = Date.now();
  for (const p of order) {
    scanned += 1;
    let rows;
    try {
      const text = await ghReadFile(`data/catalog/${p.cards}`);
      rows = JSON.parse(text || '[]');
    } catch (e) { console.error('archive cards read failed:', p.cards, e.message); continue; }
    if (!Array.isArray(rows)) continue;
    for (let i = rows.length - 1; i >= 0; i--) { // newest part row wins: walk backwards and skip anything already seen
      const id = rows[i] && rows[i].id;
      if (!id || seen.has(id)) continue;
      if (!adminHit(q, `${id} ${rows[i].n} ${(rows[i].k || []).join(' ')} ${rows[i].p}`)) continue;
      seen.add(id);
      const card = rowToCard(rows[i], Number(p.n) || 0);
      hits.push({ id: card.id, name: card.name, price: card.price, comparePrice: card.comparePrice, image: (card.images || [])[0] || '', categories: card.categories, inStock: card.inStock, part: card.part, createdAt: card.createdAt, score: adminScore(q, `${id} ${card.name} ${(card.categories || []).join(' ')}`, card.name) });
      if (hits.length >= limit * 2) break;
    }
    if (hits.length >= limit * 2 || Date.now() - started > 8000) break; // keep the response quick on huge archives
  }
  hits.sort((x, y) => y.score - x.score || (y.createdAt || 0) - (x.createdAt || 0));
  return json({
    ok: true, q, hits: hits.slice(0, limit).map((h) => { const { score, ...rest } = h; return rest; }),
    scanned, totalParts: parts.length, truncated: scanned < parts.length, total: Number(manifest.total) || 0,
  });
}
