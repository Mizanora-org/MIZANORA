import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => NextResponse.json(body, { status });
// Only the supplier's own image hosts may be fetched (stops this route being used to reach other sites).
const HOSTS = new Set(['www.markaz.app', 'markaz.app', 'static.markaz.app']);
const okUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && HOSTS.has(x.hostname); } catch { return false; } };

async function grab(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MizanoraImport/1.0)', Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`source ${res.status}`);
  if (res.url && !okUrl(res.url)) throw new Error('redirected to an unknown host');
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('image/')) throw new Error('not an image');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error('image too large');
  return buf;
}

// Admin only. Body: { url }. Downloads a supplier photo on the server and stores it on ImgBB (your own copy).
export async function POST(req) {
  const admin = await verifyAdmin(req);
  if (!admin.ok) return json({ ok: false, error: admin.error }, admin.status);
  const key = process.env.IMGBB_API_KEY;
  if (!key) return json({ ok: false, error: 'IMGBB_API_KEY is not set in Vercel.' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }
  const url = String((body && body.url) || '');
  if (!okUrl(url)) return json({ ok: false, error: 'Only Markaz photo links can be copied.' }, 400);

  // Try the link as given, then the plain CDN address inside ?src=
  const tries = [url];
  try { const s = new URL(url).searchParams.get('src'); if (s && okUrl(s)) tries.push(s); } catch { /* ignore */ }
  let buf = null, last = '';
  for (const t of tries) { try { buf = await grab(t); break; } catch (e) { last = e.message; } }
  if (!buf) return json({ ok: false, error: `Could not download: ${last}` }, 502);

  try {
    const form = new URLSearchParams({ key, image: buf.toString('base64'), name: `mizanora-${Date.now()}` });
    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success || !data.data) return json({ ok: false, error: `ImgBB: ${(data && data.error && data.error.message) || res.status}` }, 502);
    return json({ ok: true, url: data.data.display_url || data.data.url });
  } catch (e) {
    return json({ ok: false, error: 'Upload to ImgBB failed.' }, 500);
  }
}
