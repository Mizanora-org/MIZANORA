import { silenceWav } from '@/lib/liveChannel';
import { loadVoice } from '@/lib/liveChannelServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/live/voice/<id>.wav  ->  one AI voiceover (the hadith readings and the product ads of the live channel).
// /api/live/voice/silence.wav?s=8 is a generated silent WAV - the pause a player can use between parts.
// The files are immutable per id, so they are cached hard.
export async function GET(req, { params }) {
  const { id: raw } = await params;
  const id = String(raw || '').replace(/\.(wav|mp3|m4a)$/i, '');

  if (id === 'silence') {
    const s = Number(new URL(req.url).searchParams.get('s')) || 8;
    const buf = silenceWav(s);
    return new Response(buf, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(buf.length), 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }

  const buf = await loadVoice(id);
  if (!buf) return new Response('Not found', { status: 404 });
  return new Response(buf, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(buf.length), 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
