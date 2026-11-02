import { getGatewayCatalogue } from '@/lib/gateway/catalogue';
import { getEpg, guideForChannels } from '@/lib/gateway/epg';
import { verifyLine } from '@/lib/gateway/lines';
import { accessDenied } from '@/lib/gateway/access';
import { clientIp, rateLimit } from '@/lib/gateway/security';
import { toXmltv } from '@/lib/iptvEpg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

// xmltv.php — hamare catalogues ki guide. Line ke baghair koi nahi khol sakta.
// Asli XMLTV source ho to woh programmes, warna har channel ke generated slots.
const xml = (body, status = 200, cache = 'no-store') => new Response(body, {
  status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cache },
});

export async function GET(req) {
  const q = new URL(req.url).searchParams;

  if (!rateLimit(clientIp(req), 'gw-epg', 12, 60_000)) return xml('<?xml version="1.0"?><tv/>', 429);

  const ipAccess = await accessDenied({ ip: clientIp(req) });
  if (ipAccess.blocked) return xml('<?xml version="1.0"?><tv/>', 403);

  const v = await verifyLine(q.get('username') || '', q.get('password') || '');
  if (!v.ok) return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${v.error} -->\n<tv/>`, v.status);

  try {
    const cat = await getGatewayCatalogue();
    const epg = await getEpg().catch(() => ({ map: {}, guide: { channels: [], programmes: [] } }));
    const guide = guideForChannels(cat.channels, epg);
    const body = toXmltv(guide.channels, guide.programmes, { generator: 'Mizanora IPTV', siteUrl: 'https://mizanora.vercel.app' });
    // Cache chhota rakhein: guide refresh hoti rehti hai.
    return xml(body, 200, 'public, max-age=300, s-maxage=300');
  } catch (e) {
    console.error('gw epg:', e.message);
    return xml('<?xml version="1.0" encoding="UTF-8"?>\n<tv/>', 200);
  }
}
