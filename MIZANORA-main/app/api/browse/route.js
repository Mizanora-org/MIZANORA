import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { browseRemote } from '@/lib/catalogQuery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// One page of products for a shop with lakhs of products: GET /api/browse?cat=<slug>&sort=low|high|new&min=&max=&cursor=
const hits = new Map();
const nums = (v) => Math.max(0, Math.floor(Number(v) || 0));

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
    const r = await browseRemote({ cat: String(u.get('cat') || '').slice(0, 80), sort: String(u.get('sort') || 'low'), min: nums(u.get('min')), max: nums(u.get('max')), cursor: String(u.get('cursor') || ''), size: 48 });
    return NextResponse.json(r, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
  } catch (e) {
    console.error('browse failed:', e.message);
    return NextResponse.json({ ok: false, items: [], next: '' }, { status: 500 });
  }
}
