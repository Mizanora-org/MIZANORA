import { getSource, sourceReady } from '@/lib/gateway/source';
import { getCatalogue, readUpstreamJson, groupsOf } from '@/lib/gateway/catalogue';
import { verifyLine, checkDevice } from '@/lib/gateway/lines';
import { clientIp, rateLimit, sealUrl, noStore } from '@/lib/gateway/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// Xtream Codes ka dil: player_api.php
// Rewrite (next.config.js): /player_api.php -> /api/gw/player
//
// Sirf server par: upstream source, aur line ka password. Client ko sirf apni info.
// Vanilla apps (TiviMate, Smarters, XCIPTV, OTT Navigator) isi jawab se login karte hain.

const baseUrlOf = (req) => {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
};

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const username = q.get('username') || '';
  const password = q.get('password') || '';
  const action = String(q.get('action') || '').toLowerCase();

  if (!rateLimit(clientIp(req), 'gw-player', 180, 60_000)) return noStore({ user_info: { auth: 0 } }, 429);

  const v = await verifyLine(username, password);
  if (!v.ok) {
    return noStore({ user_info: { auth: 0, status: v.error, message: v.error }, server_info: {} }, v.status);
  }

  const dev = await checkDevice(v.line, req);
  if (!dev.ok) return noStore({ user_info: { auth: 0, status: dev.error, message: dev.error } }, 403);

  const source = await getSource();
  const cat = await getCatalogue();

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
    port: '443',
    https_port: '443',
    server_protocol: 'https',
    rtmp_port: '',
    timezone: 'Asia/Karachi',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };

  try {
    // default / get.php wala basic call
    if (!action) return noStore({ user_info: userInfo, server_info: serverInfo });

    // ---- categories
    if (action === 'get_live_categories') {
      if (source.mode === 'xtream' && sourceReady(source)) {
        const up = await readUpstreamJson(source, '&action=get_live_categories');
        if (Array.isArray(up)) return noStore(up);
      }
      return noStore(cat.groups.map((g) => ({ category_id: g.id, category_name: g.name, parent_id: 0 })));
    }

    // ---- live streams
    if (action === 'get_live_streams') {
      const wanted = String(q.get('category_id') || '');
      const groups = groupsOf(cat.channels);
      const groupId = new Map(groups.map((g) => [g.name, g.id]));
      const rows = cat.channels
        .filter((c) => !wanted || groupId.get(c.group) === wanted)
        .map((c) => ({
          num: Number(c.id) || 0,
          name: c.name,
          stream_type: c.ext === 'm3u8' ? 'hls' : 'live',
          stream_id: Number(c.id) || c.id,
          stream_icon: c.logo ? `/api/gw/icon?t=${sealUrl(c.logo)}` : '',
          epg_channel_id: c.epg || '',
          added: '',
          category_id: String(groupId.get(c.group) || '1'),
          custom_sid: '',
          tv_archive: 0,
          direct_source: '',
          tv_archive_duration: 0,
        }));
      return noStore(rows);
    }

    // ---- short EPG (app ke andar ka guide)
    if (action === 'get_short_epg' || action === 'get_simple_data_table') {
      if (source.mode === 'xtream' && sourceReady(source)) {
        const qs = `&action=${action}&stream_id=${encodeURIComponent(q.get('stream_id') || '')}${q.get('limit') ? `&limit=${Number(q.get('limit'))}` : ''}`;
        const up = await readUpstreamJson(source, qs);
        if (up) return noStore(up);
      }
      return noStore({ epg_listings: [] });
    }

    // ---- VOD / series: upstream se seedha (sirf xtream mode)
    if (['get_vod_streams', 'get_series', 'get_vod_categories', 'get_series_categories', 'get_vod_info', 'get_series_info'].includes(action)) {
      if (source.mode === 'xtream' && sourceReady(source)) {
        const extra = ['get_vod_info', 'get_series_info'].includes(action)
          ? `&vod_id=${encodeURIComponent(q.get('vod_id') || '')}&series_id=${encodeURIComponent(q.get('series_id') || '')}`
          : q.get('category_id') ? `&category_id=${encodeURIComponent(q.get('category_id'))}` : '';
        const up = await readUpstreamJson(source, `&action=${action}${extra}`);
        if (up) return noStore(up);
      }
      return noStore([]);
    }

    return noStore({ user_info: userInfo, server_info: serverInfo });
  } catch (e) {
    console.error('gw player:', e.message);
    return noStore({ user_info: { ...userInfo, auth: 0, status: 'Server busy' } }, 200);
  }
}

export const POST = GET;
