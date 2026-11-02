import { getGatewayCatalogue } from '@/lib/gateway/catalogue';
import { getEpg, guideForChannels } from '@/lib/gateway/epg';
import { verifyLine } from '@/lib/gateway/lines';
import { clientIp, rateLimit } from '@/lib/gateway/security';
import { nowNext } from '@/lib/iptvEpg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Player ka EPG — har channel ka "abhi chal raha" aur "agla" programme.
const json = (b, s = 200) => Response.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req) {
  if (!rateLimit(clientIp(req), 'gw-guide', 40, 60_000)) return json({ ok: false, error: 'Bohat requests' }, 429);
  const q = new URL(req.url).searchParams;
  const v = await verifyLine(q.get('username') || '', q.get('password') || '');
  if (!v.ok) return json({ ok: false, error: v.error }, v.status);

  const cat = await getGatewayCatalogue();
  const epg = await getEpg().catch(() => ({ map: {}, guide: { channels: [], programmes: [] } }));
  const guide = guideForChannels(cat.channels.slice(0, 600), epg);
  const now = Date.now();

  return json({
    ok: true,
    updatedAt: Date.now(),
    real: guide.real,
    generated: guide.generated,
    channels: cat.channels.slice(0, 600).map((c, i) => {
      // guideForChannels tarteeb barqarar rakhta hai — index se hi id lo (naam duplicate ho sakte hain).
      const id = (guide.channels[i] || {}).id || c.epg || `mz-${c.id}.tv`;
      const nn = nowNext({ programmes: guide.programmes }, id, now);
      return {
        id: c.id,
        now: nn.now ? { title: nn.now.title, start: nn.now.start, stop: nn.now.stop } : null,
        next: nn.next ? { title: nn.next.title, start: nn.next.start, stop: nn.next.stop } : null,
      };
    }),
  });
}
