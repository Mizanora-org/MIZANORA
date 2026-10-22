import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { dealsRemote } from '@/lib/catalogQuery';
import { getDealsConfig } from '@/lib/dealsServer';
import { SORTS } from '@/lib/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// GET /api/deals?min=20&cat=<slug>&sort=pct|saved|low|high|new&cursor=i:48   -> one page of deals (the browser's "load more")
const hits = new Map();
export async function GET(req) {
  const closed = await denyIf();
  if (closed) return closed;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 60) return NextResponse.json({ ok: false, items: [], next: '' }, { status: 429 });
  const u = new URL(req.url).searchParams;
  try {
    const cfg = await getDealsConfig();
    const sort = SORTS.some((s) => s[0] === u.get('sort')) ? u.get('sort') : 'pct';
    const min = Math.max(cfg.minPct, Math.min(90, Math.floor(Number(u.get('min'))) || 0));
    const r = await dealsRemote({ minPct: min, cat: String(u.get('cat') || '').slice(0, 80), sort, cursor: String(u.get('cursor') || '').slice(0, 20), size: 48, pinned: cfg.pinned });
    return NextResponse.json(r, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } });
  } catch (e) {
    console.error('deals failed:', e.message);
    return NextResponse.json({ ok: false, items: [], next: '' }, { status: 500 });
  }
}
