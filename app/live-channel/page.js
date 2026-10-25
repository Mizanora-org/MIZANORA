import { pageMeta } from '@/lib/seo';
import LiveChannel from '@/components/LiveChannel';

// v28: the page is a static shell; LiveChannel owns its own clock and polls the API in the browser.
// Rendering this on every request only added server latency without making the broadcast fresher.
export const revalidate = 3600;

export const metadata = pageMeta({
  title: { absolute: 'Quran & Hadith Live — Mizanora Live Channel' },
  description: 'Mizanora ki live channel: Quran ki tilawat, ahadees ki tilawat aur hamari products ke ads — live m3u8 stream aur YouTube live cast ke sath, Pakistan time par.',
  path: '/live-channel',
});

// THE QURAN & HADITH LIVE CHANNEL (v27). The whole screen is one broadcast surface (components/LiveChannel.js):
// the Mizanora logo and a ticking Pakistan clock on top, live tilawat / hadees / product ads in the middle,
// the program strip and the ticker below. The live m3u8 stream of the same programming is at /api/live/channel.m3u8.
export default function LiveChannelPage() {
  // The root layout already renders the page main landmark; another main element here was invalid nested HTML.
  return <div className="min-w-0"><LiveChannel /></div>;
}
