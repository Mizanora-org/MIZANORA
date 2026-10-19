import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { searchRemote } from '@/lib/catalogQuery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// Search of a shop with lakhs of products (the browser only holds the newest part). Answers are cached on the server.
// GET /api/search?q=red suit under 2000&cat=<category slug>&sort=low|high|new&min=&max=
//     &w=word,word&c=colour&  (optional: words understood by the AI helper, replace the typed words)
const hits = new Map();
const nums = (v) => Math.max(0, Math.floor(Number(v) || 0));

export async function GET(req) {
  const closed = await denyIf();
  if (closed) return closed;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 40) return NextResponse.json({ ok: false, items: [] }, { status: 429 });

  const u = new URL(req.url).searchParams;
  const q = String(u.get('q') || '').slice(0, 120);
  if (q.trim().length < 2) return NextResponse.json({ ok: true, items: [] });
  const list = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 8);
  const intent = u.get('w') ? { words: list(u.get('w')), colors: list(u.get('c')), min: nums(u.get('min')), max: nums(u.get('max')), sort: String(u.get('sort') || '') } : undefined;
  try {
    const r = await searchRemote(q, { intent, cat: String(u.get('cat') || '').slice(0, 80), sort: ['low', 'high', 'new'].includes(u.get('sort')) ? u.get('sort') : '', min: nums(u.get('min')), max: nums(u.get('max')), limit: 60 });
    return NextResponse.json(r, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
  } catch (e) {
    console.error('search failed:', e.message);
    return NextResponse.json({ ok: false, items: [] }, { status: 500 });
  }
}
