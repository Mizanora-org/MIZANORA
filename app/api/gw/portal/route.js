import { adminDb, adminReady } from '@/lib/firebase-admin';
import { getGatewayCatalogue, groupsOf } from '@/lib/gateway/catalogue';
import { checkDevice } from '@/lib/gateway/lines';
import { seal, open, clientIp, rateLimit, sealUrl } from '@/lib/gateway/security';
import { touchSession, trackEvent } from '@/lib/gateway/track';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// STALKER / MAG portal — /portal.php aur /server/load.php (next.config rewrites).
//
// MAG box MAC se pehchana jata hai (username/password nahi). Line banate waqt admin
// MAC deta hai — wohi `iptvLines.mac` mein hota hai.
//   handshake -> stateless token (sealed, 12 ghante)
//   get_profile, get_genres, get_all_channels, get_ordered_list, vod...

const json = (b, s = 200) => new Response(JSON.stringify(b), {
  status: s,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const normMac = (v) => {
  const hex = String(v || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return hex.length === 12 ? hex.match(/.{2}/g).join(':') : '';
};

function macFrom(req, q) {
  const direct = normMac(q.get('mac') || req.headers.get('x-mac') || '');
  if (direct) return direct;
  const cookie = String(req.headers.get('cookie') || '');
  const m = cookie.match(/mac=([^;]+)/i);
  return m ? normMac(m[1]) : '';
}

function baseOf(req) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
}

async function lineByMac(mac) {
  if (!adminReady() || !mac) return null;
  try {
    const snap = await adminDb().collection('iptvLines').where('mac', '==', mac).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const line = { id: doc.id, ...doc.data() };
    if (String(line.status || 'active') !== 'active') return null;
    if (Number(line.expiresAt) && Number(line.expiresAt) < Date.now()) return null;
    return line;
  } catch { return null; }
}

async function handle(req) {
  const url = new URL(req.url);
  const q = url.searchParams;
  let body = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = {}; }
  }
  const get = (k) => q.get(k) || body[k] || '';

  if (!rateLimit(clientIp(req), 'gw-portal', 240, 60_000)) return json({ js: null, text: 'too many requests' }, 429);

  // Token (handshake ke baad) — MAC isi ke andar sealed hai.
  const authHeader = String(req.headers.get('authorization') || '');
  const token = (authHeader.replace(/^Bearer\s+/i, '') || get('token') || '').trim();
  const fromToken = token ? open(token) : null;

  const mac = normMac(fromToken && fromToken.mac) || macFrom(req, q);
  const line = await lineByMac(mac);
  if (!line) return json({ js: null, text: 'unauthorized' }, 401);

  const type = String(get('type') || 'stb').toLowerCase();
  const action = String(get('action') || '').toLowerCase();

  if (!action || action === 'handshake') {
    const t = seal({ mac, uid: line.id }, 12 * 3600);
    touchSession(line, req, { kind: 'stalker', force: true });
    trackEvent('login', line, req, { app: 'MAG/Stalker' });
    return json({ js: { token: t, random: Math.random().toString(36).slice(2) }, text: 'ok' });
  }

  const dev = await checkDevice(line, req);
  if (!dev.ok) return json({ js: null, text: 'too many connections' }, 403);

  const cat = await getGatewayCatalogue();
  const base = baseOf(req);
  const u = encodeURIComponent(line.username || '');
  const p = encodeURIComponent(line.password || '');
  const groups = cat.groups.map((g, i) => ({ id: String(i + 1), title: g.name, alias: g.name, censored: false, name: g.name, count: g.count }));
  const gidOf = new Map(cat.groups.map((g, i) => [g.name, String(i + 1)]));

  if (action === 'get_profile') {
    return json({
      js: {
        id: line.id, login: line.username || mac, mac,
        name: line.clientName || line.name || 'Mizanora',
        status: 1, expire_billing_date: line.expiresAt ? new Date(Number(line.expiresAt)).toISOString().slice(0, 10) : '',
        phone: line.phone || '', tariff_plan: line.plan || '',
        settings: { allow_channels: '1', allow_watch: '1' },
      },
      text: 'ok',
    });
  }

  if (action === 'get_genres') {
    touchSession(line, req, { kind: 'stalker' });
    return json({ js: groups, text: 'ok' });
  }

  if (type === 'itv' && (action === 'get_all_channels' || action === 'get_ordered_list')) {
    const genre = String(get('genre') || '');
    const page = Math.max(1, Number(get('p')) || 1);
    const perPage = Math.max(1, Number(get('per_page')) || 999);
    const filtered = genre && genre !== '*' ? cat.channels.filter((c) => gidOf.get(c.group) === genre) : cat.channels;
    const start = (page - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);
    const ext = (c) => (/m3u8/i.test(c.url) ? 'm3u8' : 'ts');
    const data = slice.map((c, i) => ({
      id: String(c.id),
      name: c.name,
      number: String(start + i + 1),
      cmd: `ffmpeg ${base}/live/${u}/${p}/${c.id}.${ext(c)}`,
      logo: c.logo ? `${base}/api/gw/icon?t=${sealUrl(c.logo)}` : '',
      tv_genre_id: gidOf.get(c.group) || '1',
      censored: 0, status: 1, hd: 0, archive: 0, tv_archive_duration: 0,
    }));
    touchSession(line, req, { kind: 'stalker' });
    return json({ js: { total_items: filtered.length, max_page_items: perPage, data }, text: 'ok' });
  }

  if (type === 'vod' && (action === 'get_categories' || action === 'get_genres')) {
    const m = groupsOf(cat.movies.map((x) => ({ group: x.group || 'Movies', off: false })));
    return json({ js: m.map((g, i) => ({ id: String(i + 1), title: g.name, alias: g.name, censored: false })), text: 'ok' });
  }

  if (type === 'vod' && (action === 'get_ordered_list' || action === 'get_all_channels')) {
    const rows = cat.movies.map((m, i) => ({
      id: String(m.id), name: m.name, o_name: m.name, number: String(i + 1),
      cmd: `ffmpeg ${base}/movie/${u}/${p}/${m.id}.${m.ext || 'mp4'}`,
      screenshot_uri: m.poster ? `${base}/api/gw/icon?t=${sealUrl(m.poster)}` : '',
      year: m.year ? String(m.year) : '', rating_imdb: m.rating ? String(m.rating) : '',
      description: m.plot || '', genre: m.group || 'Movies', is_series: 0,
    }));
    return json({ js: { total_items: rows.length, max_page_items: rows.length || 1, data: rows }, text: 'ok' });
  }

  if (action === 'watchdog' || action === 'ping') {
    touchSession(line, req, { kind: 'stalker' });
    return json({ js: true, text: 'ok' });
  }

  if (action === 'get_short_epg' || action === 'get_epg_info') return json({ js: [], text: 'ok' });

  return json({ js: {}, text: 'ok' });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
