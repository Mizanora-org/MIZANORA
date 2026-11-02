import { apiBase, getSource, sourceReady } from '@/lib/gateway/source';
import { getGatewayCatalogue } from '@/lib/gateway/catalogue';
import { verifyLine } from '@/lib/gateway/lines';
import { clientIp, rateLimit } from '@/lib/gateway/security';
import { fetchPublic } from '@/lib/tvProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// xmltv.php — EPG. Line ke baghair koi ise nahi khol sakta.
// v43: guide hamare apne channels se banti hai. Channel-wise EPG mapping abhi baqi hai
// (item 1 in UPGRADE-v43.md), is liye filhaal valid magar khali guide jati hai.

const xml = (body, status = 200, cache = 'no-store') => new Response(body, {
  status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cache },
});

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const username = q.get('username') || '';
  const password = q.get('password') || '';

  if (!rateLimit(clientIp(req), 'gw-epg', 12, 60_000)) return xml('<?xml version="1.0"?><tv/>', 429);

  const v = await verifyLine(username, password);
  if (!v.ok) return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${v.error} -->\n<tv/>`, v.status);

  const source = await getSource();

  if (sourceReady(source) && source.mode === 'xtream') {
    const base = apiBase(source);
    const url = `${base}/xmltv.php?username=${encodeURIComponent(source.username)}&password=${encodeURIComponent(source.password)}`;
    try {
      const { res } = await fetchPublic(url, { timeout: 25000 });
      if (res.ok) {
        const text = (await res.text()).slice(0, 8_000_000);
        if (/<tv[\s>]/i.test(text)) return xml(text, 200, 'public, max-age=600, s-maxage=600');
      } else {
        try { res.body && res.body.cancel(); } catch { /* ignore */ }
      }
    } catch { /* fall through to the skeleton */ }
  }

  // Fallback: valid XMLTV with our channel ids (guide khali, magar app khush).
  const cat = await getGatewayCatalogue();
  const rows = (cat.channels || []).slice(0, 3000).map((c) =>
    `  <channel id="${String(c.epg || c.id).replace(/"/g, '')}"><display-name>${String(c.name).replace(/[<>&]/g, '')}</display-name></channel>`);
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Mizanora IPTV">\n${rows.join('\n')}\n</tv>`, 200, 'public, max-age=300');
}
