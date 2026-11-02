import { verifyLine, checkDevice } from './lines';
import { findChannel } from './catalogue';
import { clientIp, rateLimit } from './security';
import { trackEvent } from './track';
import { proxyMedia } from './handleStream';
import { archiveDaysFor, catchupWindow, timeshiftUrl } from '../iptvCatchup';

// 7-DIN CATCH-UP ka core. Do raaste isi ko bulate hain:
//   /timeshift/<user>/<pass>/<minutes>/<YYYY-MM-DD:HH-MM>/<id>[.ts]   (Xtream apps)
//   /api/gw/timeshift?u=..&p=..&dur=..&start=..&f=..                  (browser / testing)
//
// Channel ka archive URL client ko kabhi nahi dikhta: playlist ke andar ke pieces
// /api/gw/s?t=<sealed> ban jate hain, 3 ghante mein khud expire.

const bad = (m, s = 400) => new Response(m, { status: s, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

/** @param {{u?:string,p?:string,f?:string,start?:string,dur?:string|number}} q */
export async function handleTimeshift(req, q = {}) {
  const username = String(q.u || q.username || '');
  const password = String(q.p || q.password || '');
  const file = String(q.f || q.id || '');
  const start = String(q.start || '');
  const minutes = Number(q.dur || q.minutes || 0);

  if (!rateLimit(clientIp(req), 'gw-catchup', 120, 60_000)) return bad('Too many requests', 429);
  if (!username || !password || !file) return bad('Username, password aur channel id chahiye');

  const m = file.match(/^([^/]+?)(?:\.([a-z0-9]{2,5}))?$/i);
  if (!m) return bad('Bad catch-up address');
  const id = decodeURIComponent(m[1]);
  const ext = (m[2] || 'ts').toLowerCase();

  const v = await verifyLine(username, password);
  if (!v.ok) return bad(v.error, v.status);

  const dev = await checkDevice(v.line, req);
  if (!dev.ok) return bad('Too many connections — kisi doosre device par line band karein.', 403);

  const ch = await findChannel(id);
  if (!ch) return bad('Channel not found', 404);

  const days = archiveDaysFor(ch);
  if (!days) return bad('Is channel par catch-up available nahi hai', 503);

  const win = catchupWindow(start, { days, minutes });
  if (!win.ok) return bad(win.error, 400);

  const target = timeshiftUrl(ch.archiveUrl || ch.catchupUrl || ch.url, win.start, win.end);
  if (!target) return bad('Archive link set nahi hai', 503);

  trackEvent('timeshift_start', v.line, req, { channel: ch.name, id, start: win.start, minutes: win.minutes });
  return proxyMedia(req, target, ext);
}
