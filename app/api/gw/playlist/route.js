import { getCatalogue } from '@/lib/gateway/catalogue';
import { verifyLine } from '@/lib/gateway/lines';
import { clientIp, rateLimit, sealUrl } from '@/lib/gateway/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// get.php — poori M3U playlist. Har line ka address YAHI website hai; upstream kabhi nahi.
// Rewrite (next.config.js): /get.php -> /api/gw/playlist

const esc = (s) => String(s || '').replace(/"/g, '').replace(/[\r\n]+/g, ' ').slice(0, 120);

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const username = q.get('username') || '';
  const password = q.get('password') || '';
  const type = String(q.get('type') || 'm3u_plus');

  if (!rateLimit(clientIp(req), 'gw-playlist', 30, 60_000)) {
    return new Response('Too many requests', { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const v = await verifyLine(username, password);
  if (!v.ok) return new Response(`#EXTM3U\n# ${v.error}\n`, { status: v.status, headers: { 'Content-Type': 'audio/x-mpegurl; charset=utf-8', 'Cache-Control': 'no-store' } });

  const cat = await getCatalogue();
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  const base = `${proto}://${host}`;
  const u = encodeURIComponent(v.line.username);
  const p = encodeURIComponent(v.line.password);

  const lines = ['#EXTM3U'];
  for (const c of cat.channels) {
    const ext = c.ext === 'm3u8' ? 'm3u8' : 'ts';
    const logo = c.logo ? `${base}/api/gw/icon?t=${sealUrl(c.logo)}` : '';
    lines.push(`#EXTINF:-1 tvg-id="${esc(c.epg)}" tvg-name="${esc(c.name)}" tvg-logo="${logo}" group-title="${esc(c.group)}",${c.name}`);
    lines.push(`${base}/live/${u}/${p}/${c.id}.${ext}`);
  }
  if (type === 'm3u') lines.push('#EXT-X-ENDLIST');

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'audio/x-mpegurl; charset=utf-8',
      'Content-Disposition': `attachment; filename="mizanora-${v.line.username}.m3u"`,
      'Cache-Control': 'no-store',
    },
  });
}
