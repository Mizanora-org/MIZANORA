import { NextResponse } from 'next/server';
import { getSurah } from '@/lib/quranServer';
import { RECITERS, TRANSLATIONS, surahInfo } from '@/lib/quran';

export const runtime = 'nodejs';
export const maxDuration = 30;

// GET /api/quran?s=36&r=ar.alafasy&t=ur.jalandhry  ->  { ok, surah, name, ar, ayahs:[{ n, ar, bism, tr, au }] }
// Only known reciters and translations are accepted, so nobody can use this address to fetch something else.
const hits = new Map();
export async function GET(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 40) return NextResponse.json({ ok: false, error: 'slow down' }, { status: 429 });

  const u = new URL(req.url).searchParams;
  const s = Number(u.get('s'));
  if (!Number.isInteger(s) || s < 1 || s > 114) return NextResponse.json({ ok: false, error: 'bad surah' }, { status: 400 });
  const r = RECITERS.some((x) => x[0] === u.get('r')) ? u.get('r') : RECITERS[0][0];
  const tRaw = u.get('t') || '';
  const t = TRANSLATIONS.some((x) => x[0] === tRaw) ? tRaw : '';
  try {
    const data = await getSurah(surahInfo(s).n, r, t);
    // A complete answer may be kept by the CDN for a day; an answer with a missing part (text or translation down) only for a minute.
    const whole = data.arOk && (!t || data.trOk);
    return NextResponse.json({ ok: true, ...data }, { headers: { 'Cache-Control': whole ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=30' } });
  } catch (e) {
    console.error('quran api failed:', e.message);
    return NextResponse.json({ ok: false, error: 'The Quran service is not reachable right now.' }, { status: 502 });
  }
}
