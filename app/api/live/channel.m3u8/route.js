import { buildM3U8, cleanChannel, CHANNEL_DEFAULT } from '@/lib/liveChannel';
import { getChannelConfig, listVoices } from '@/lib/liveChannelServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// GET /api/live/channel.m3u8  ->  THE LIVE STREAM (HLS playlist of the channel's programming).
//   ?count=40     how many segments ahead (4..400, default 40)
//   ?endlist=1    close the playlist (for tools that loop it, like the YouTube cast action)
//   ?from=MS      start the playlist at a moment (default: now)
// The playlist holds REAL media: every ayah is its own recitation file from the Islamic Network CDN and every hadith /
// ad is its AI voiceover from /api/live/voice/<id>.wav. VLC, ffmpeg, any HLS player - and YouTube through the cast
// action - can play it. A slot without a voiceover yet is filled with Quran audio, so the stream is never silent.
export async function GET(req) {
  const u = new URL(req.url);
  const base = u.origin;
  const count = Math.min(400, Math.max(4, Number(u.searchParams.get('count')) || 40));
  const endlist = u.searchParams.get('endlist') === '1';
  const from = Math.max(0, Number(u.searchParams.get('from')) || Date.now());

  try {
    const cfg = cleanChannel({ ...CHANNEL_DEFAULT, ...(await getChannelConfig()) });
    const voices = new Set(await listVoices());
    const body = buildM3U8(cfg, from, count, {
      base,
      endlist,
      resolve: (s) => (s.voiceId && voices.has(s.voiceId) ? `${base}/api/live/voice/${s.voiceId}.wav` : null),
    });
    return new Response(body || '#EXTM3U\n', {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    console.error('live channel m3u8 failed:', e.message);
    return new Response('#EXTM3U\n', { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'public, s-maxage=10' } });
  }
}
