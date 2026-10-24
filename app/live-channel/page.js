import { pageMeta } from '@/lib/seo';
import LiveChannel from '@/components/LiveChannel';

export const dynamic = 'force-dynamic';

export const metadata = pageMeta({
  title: { absolute: 'Quran & Hadith Live — Mizanora Live Channel' },
  description: 'Mizanora ki live channel: Quran ki tilawat, ahadees ki tilawat aur hamari products ke ads — live m3u8 stream aur YouTube live cast ke sath, Pakistan time par.',
  path: '/live-channel',
});

// THE QURAN & HADITH LIVE CHANNEL (v27). The whole screen is one broadcast surface (components/LiveChannel.js):
// the Mizanora logo and a ticking Pakistan clock on top, live tilawat / hadees / product ads in the middle,
// the program strip and the ticker below. The live m3u8 stream of the same programming is at /api/live/channel.m3u8.
export default function LiveChannelPage() {
  return (
    <main className="min-w-0">
      <LiveChannel />
    </main>
  );
}
