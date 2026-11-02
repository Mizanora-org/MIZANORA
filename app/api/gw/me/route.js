import { getGatewayCatalogue } from '@/lib/gateway/catalogue';
import { verifyLine, checkDevice } from '@/lib/gateway/lines';
import { clientIp, rateLimit } from '@/lib/gateway/security';
import { touchSession, trackEvent, appName } from '@/lib/gateway/track';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// MIZANORA PLAYER — line ke saath catalogue ki list (bina kisi asli URL ke).
// Player sirf ids leta hai; stream /live|/movie|/series se milti hai (sealed gateway).
const json = (b, s = 200) => Response.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

async function handle(req) {
  if (!rateLimit(clientIp(req), 'gw-me', 40, 60_000)) return json({ ok: false, error: 'Bohat zyada koshishein — thori der baad.' }, 429);

  let b = {};
  if (req.method === 'POST') { try { b = await req.json(); } catch { b = {}; } }
  const q = new URL(req.url).searchParams;
  const username = b.username || q.get('username') || '';
  const password = b.password || q.get('password') || '';

  const v = await verifyLine(username, password);
  if (!v.ok) return json({ ok: false, error: v.error }, v.status);

  const dev = await checkDevice(v.line, req);
  if (!dev.ok) return json({ ok: false, error: 'Too many connections — koi doosra device band karein.' }, 403);

  touchSession(v.line, req, { kind: 'player', force: true });
  trackEvent('login', v.line, req, { via: 'player', app: appName(req.headers.get('user-agent') || '') });

  const cat = await getGatewayCatalogue();
  return json({
    ok: true,
    line: {
      username: v.line.username,
      plan: v.line.plan || 'starter',
      expiresAt: Number(v.line.expiresAt) || 0,
      maxDevices: Number(v.line.maxDevices) || 1,
      devices: dev.devices || 1,
    },
    counts: { channels: cat.channels.length, movies: cat.movies.length, series: cat.series.length },
    groups: cat.groups,
    channels: cat.channels.map((c) => ({ id: c.id, name: c.name, group: c.group, logo: c.logo || '', epg: c.epg || '' })),
    movies: cat.movies.map((m) => ({ id: m.id, name: m.name, group: m.group, poster: m.poster || '', year: m.year || 0, rating: m.rating || 0, plot: m.plot || '', ext: m.ext || 'mp4' })),
    series: cat.series.map((s) => ({
      id: s.id, name: s.name, group: s.group, poster: s.poster || '', plot: s.plot || '',
      seasons: s.seasons.map((x) => ({ n: x.n, episodes: x.episodes.map((e) => ({ n: e.n, title: e.title || '', ext: e.ext || 'mp4' })) })),
    })),
  });
}

export async function POST(req) { return handle(req); }
export async function GET(req) { return handle(req); }
