import { archiveDaysFor } from '@/lib/iptvCatchup';
import { getGatewayCatalogue, groupsOf } from '@/lib/gateway/catalogue';
import { verifyLine, checkDevice } from '@/lib/gateway/lines';
import { clientIp, rateLimit, sealUrl, noStore } from '@/lib/gateway/security';
import { touchSession, trackEvent } from '@/lib/gateway/track';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// Xtream Codes ka dil: player_api.php  ->  /api/gw/player (next.config rewrite)
// Sab jawab HAMARE catalogue se bante hain (admin ki M3U/manual entries).
// Client ko sirf apni line + channel ids milti hain, asli URLs kabhi nahi.

const baseUrlOf = (req) => {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
};

const CATEGORY = (list) => {
  const g = groupsOf(list.map((x) => ({ group: x.group, off: false })));
  return g;
};

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const action = String(q.get('action') || '').toLowerCase();

  if (!rateLimit(clientIp(req), 'gw-player', 180, 60_000)) return noStore({ user_info: { auth: 0 } }, 429);

  const v = await verifyLine(q.get('username') || '', q.get('password') || '');
  if (!v.ok) return noStore({ user_info: { auth: 0, status: v.error, message: v.error }, server_info: {} }, v.status);

  const dev = await checkDevice(v.line, req);
  if (!dev.ok) return noStore({ user_info: { auth: 0, status: dev.error, message: dev.error } }, 403);

  if (!action) {
    touchSession(v.line, req, { kind: 'login', force: true });
    trackEvent('login', v.line, req);
  }

  const userInfo = {
    username: v.line.username,
    password: v.line.password,
    message: 'Welcome to Mizanora IPTV',
    auth: 1,
    status: 'Active',
    exp_date: String(Math.floor((Number(v.line.expiresAt) || 0) / 1000) || ''),
    is_trial: v.line.trial ? '1' : '0',
    active_cons: String(dev.devices || 1),
    created_at: String(Math.floor((Number(v.line.createdAt) || Date.now()) / 1000)),
    max_connections: String(dev.max || 1),
    allowed_output_formats: ['m3u8', 'ts'],
  };
  const serverInfo = {
    url: baseUrlOf(req).replace(/^https?:\/\//, '').split(':')[0],
    port: '443', https_port: '443', server_protocol: 'https', rtmp_port: '',
    timezone: 'Asia/Karachi',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };

  try {
    const cat = await getGatewayCatalogue();

    if (!action) return noStore({ user_info: userInfo, server_info: serverInfo });

    // ---------------- LIVE
    if (action === 'get_live_categories') {
      return noStore(cat.groups.map((g) => ({ category_id: g.id, category_name: g.name, parent_id: 0 })));
    }

    if (action === 'get_live_streams') {
      const wanted = String(q.get('category_id') || '');
      const gid = new Map(cat.groups.map((g) => [g.name, g.id]));
      const rows = cat.channels
        .filter((c) => !wanted || gid.get(c.group) === wanted)
        .map((c) => ({
          num: Number(c.id) || 0,
          name: c.name,
          stream_type: /m3u8/i.test(c.url) ? 'hls' : 'live',
          stream_id: Number(c.id) || c.id,
          stream_icon: c.logo ? `/api/gw/icon?t=${sealUrl(c.logo)}` : '',
          epg_channel_id: c.epg || `mz-${c.id}.tv`,
          added: '',
          category_id: String(gid.get(c.group) || '1'),
          custom_sid: '', direct_source: '',
          tv_archive: archiveDaysFor(c) ? 1 : 0,
          tv_archive_duration: archiveDaysFor(c),
        }));
      return noStore(rows);
    }

    // ---------------- MOVIES
    if (action === 'get_vod_categories') {
      return noStore(CATEGORY(cat.movies).map((g) => ({ category_id: g.id, category_name: g.name, parent_id: 0 })));
    }

    if (action === 'get_vod_streams') {
      const groups = CATEGORY(cat.movies);
      const gid = new Map(groups.map((g) => [g.name, g.id]));
      const rows = cat.movies.map((m) => ({
        num: Number(String(m.id).replace(/\D/g, '')) || 0,
        name: m.name,
        stream_type: 'movie',
        stream_id: m.id,
        stream_icon: m.poster ? `/api/gw/icon?t=${sealUrl(m.poster)}` : '',
        rating: String(m.rating || ''),
        rating_5based: m.rating ? (m.rating / 2).toFixed(1) : '',
        added: '',
        category_id: String(gid.get(m.group) || '1'),
        container_extension: m.ext,
        custom_sid: '', direct_source: '',
      }));
      return noStore(rows);
    }

    if (action === 'get_vod_info') {
      const id = String(q.get('vod_id') || '');
      const m = cat.movies.find((x) => x.id === id);
      if (!m) return noStore({ info: {}, movie_data: {} });
      return noStore({
        info: { name: m.name, plot: m.plot || '', releasedate: m.year ? `${m.year}-01-01` : '', rating: m.rating || '', cover_big: m.poster ? `/api/gw/icon?t=${sealUrl(m.poster)}` : '' },
        movie_data: { stream_id: m.id, name: m.name, added: '', category_id: '', container_extension: m.ext, custom_sid: '', direct_source: '' },
      });
    }

    // ---------------- SERIES
    if (action === 'get_series_categories') {
      return noStore(CATEGORY(cat.series).map((g) => ({ category_id: g.id, category_name: g.name, parent_id: 0 })));
    }

    if (action === 'get_series') {
      const groups = CATEGORY(cat.series);
      const gid = new Map(groups.map((g) => [g.name, g.id]));
      return noStore(cat.series.map((s) => ({
        num: Number(String(s.id).replace(/\D/g, '')) || 0,
        name: s.name,
        series_id: s.id,
        cover: s.poster ? `/api/gw/icon?t=${sealUrl(s.poster)}` : '',
        plot: s.plot || '',
        cast: '', director: '', genre: s.group || '',
        releaseDate: '', rating: '', rating_5based: '',
        backdrop_path: [], youtube_trailer: '', episode_run_time: '', category_id: String(gid.get(s.group) || '1'),
      })));
    }

    if (action === 'get_series_info') {
      const id = String(q.get('series_id') || '');
      const s = cat.series.find((x) => x.id === id);
      if (!s) return noStore({ seasons: [], info: {}, episodes: {} });
      const episodes = {};
      for (const season of s.seasons) {
        episodes[String(season.n)] = season.episodes.map((e) => ({
          id: `${s.id}-${season.n}-${e.n}`,
          episode_num: e.n,
          title: e.title || `Episode ${e.n}`,
          season: season.n,
          container_extension: e.ext,
          info: { name: e.title || '', plot: '', duration: '', rating: '' },
          custom_sid: '', added: '', direct_source: '',
        }));
      }
      return noStore({
        seasons: s.seasons.map((x) => ({ season_number: x.n, name: `Season ${x.n}`, cover: '', cover_big: '', episode_count: x.episodes.length })),
        info: { name: s.name, plot: s.plot || '', cover: s.poster ? `/api/gw/icon?t=${sealUrl(s.poster)}` : '', genre: s.group || '' },
        episodes,
      });
    }

    // ---------------- EPG (apni list abhi guide ke baghair; app ko khaali array theek lagta hai)
    if (action === 'get_short_epg' || action === 'get_simple_data_table') return noStore({ epg_listings: [] });

    return noStore({ user_info: userInfo, server_info: serverInfo });
  } catch (e) {
    console.error('gw player:', e.message);
    return noStore({ user_info: { ...userInfo, auth: 0, status: 'Server busy' } }, 200);
  }
}

export const POST = GET;
