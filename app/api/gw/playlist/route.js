import { getGatewayCatalogue } from '@/lib/gateway/catalogue';
import { verifyLine } from '@/lib/gateway/lines';
import { clientIp, rateLimit, sealUrl } from '@/lib/gateway/security';
import { touchSession, trackEvent } from '@/lib/gateway/track';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// get.php — poori M3U (live + movies + series). Har address HAMARI website ka hai.
const esc = (s) => String(s || '').replace(/"/g, '').replace(/[\r\n]+/g, ' ').slice(0, 120);

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const type = String(q.get('type') || 'm3u_plus');

  if (!rateLimit(clientIp(req), 'gw-playlist', 30, 60_000)) return new Response('Too many requests', { status: 429 });

  const v = await verifyLine(q.get('username') || '', q.get('password') || '');
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'audio/x-mpegurl; charset=utf-8' };
  if (!v.ok) return new Response(`#EXTM3U\n# ${v.error}\n`, { status: v.status, headers });

  touchSession(v.line, req, { kind: 'playlist', force: true });
  trackEvent('playlist', v.line, req);

  const cat = await getGatewayCatalogue();
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  const base = `${proto}://${host}`;
  const u = encodeURIComponent(v.line.username);
  const p = encodeURIComponent(v.line.password);
  const logo = (src) => (src ? `${base}/api/gw/icon?t=${sealUrl(src)}` : '');

  const out = ['#EXTM3U'];
  for (const c of cat.channels) {
    const ext = /m3u8/i.test(c.url) ? 'm3u8' : 'ts';
    out.push(`#EXTINF:-1 tvg-name="${esc(c.name)}" tvg-logo="${logo(c.logo)}" group-title="${esc(c.group)}",${c.name}`);
    out.push(`${base}/live/${u}/${p}/${c.id}.${ext}`);
  }
  for (const m of cat.movies) {
    out.push(`#EXTINF:-1 tvg-name="${esc(m.name)}" tvg-logo="${logo(m.poster)}" group-title="${esc(m.group || 'Movies')}",${m.name}`);
    out.push(`${base}/movie/${u}/${p}/${m.id}.${m.ext || 'mp4'}`);
  }
  for (const s of cat.series) {
    for (const season of s.seasons) {
      for (const e of season.episodes) {
        const label = `${s.name} S${String(season.n).padStart(2, '0')}E${String(e.n).padStart(2, '0')}${e.title ? ` - ${e.title}` : ''}`;
        out.push(`#EXTINF:-1 tvg-logo="${logo(s.poster)}" group-title="${esc(s.group || 'Series')}",${esc(label)}`);
        out.push(`${base}/series/${u}/${p}/${s.id}-${season.n}-${e.n}.${e.ext || 'mp4'}`);
      }
    }
  }
  if (type === 'm3u') out.push('#EXT-X-ENDLIST');

  return new Response(out.join('\n'), {
    status: 200,
    headers: { ...headers, 'Content-Disposition': `attachment; filename="mizanora-${v.line.username}.m3u"` },
  });
}
