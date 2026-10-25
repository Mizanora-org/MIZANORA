import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getYtSecret } from '@/lib/ytSecret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/live/cast-key   Authorization: Bearer <CAST_TOKEN>
// Used ONLY by scripts/live-cast.mjs (GitHub Action / your PC) so the stream key can be set once in Admin > Live Channel > YouTube
// and never has to be copied into GitHub. Without the CAST_TOKEN env var this endpoint is closed (404).
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export async function GET(req) {
  const token = process.env.CAST_TOKEN || '';
  if (token.length < 24) return new NextResponse('Not found', { status: 404 });
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!got || !same(got, token)) return new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const s = await getYtSecret();
  if (!s.key) return NextResponse.json({ ok: false, error: 'No stream key saved in Admin > Live Channel > YouTube.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ ok: true, key: s.key, rtmpUrl: s.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2' }, { headers: { 'Cache-Control': 'no-store' } });
}
