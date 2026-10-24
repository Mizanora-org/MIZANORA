import { NextResponse } from 'next/server';
import { CHANNEL_DEFAULT, cleanChannel, nowPlaying, pktClock, tickerLines } from '@/lib/liveChannel';
import { getChannelAds, getChannelConfig, getHadithSection, listVoices } from '@/lib/liveChannelServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// GET /api/live/channel  ->  everything the live channel player needs for THIS second:
//   { ok, now, pkt, onAir, why, current, next, channel, ads, voices }
// The player polls this every ~20 seconds; the clock and the program position are computed from the wall clock in the
// browser, so even between polls the screen stays in perfect sync with everyone else.
const hits = new Map();
export async function GET(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 40) return NextResponse.json({ ok: false, error: 'slow down' }, { status: 429 });

  try {
    const cfg = await getChannelConfig();
    const np = nowPlaying(cfg, now);
    const voices = new Set(await listVoices());
    const voiceUrl = (id) => (id && voices.has(id) ? `/api/live/voice/${id}.wav` : '');

    const seg = np.seg;
    let current = {
      kind: seg.kind, startMs: seg.startMs, endMs: seg.endMs, sec: seg.sec,
      voiceUrl: voiceUrl(seg.voiceId),
    };
    if (seg.kind === 'quran') {
      current = {
        ...current,
        surah: seg.surah, surahName: seg.surahName, reciter: seg.reciter, translation: seg.translation,
        ayat: seg.ayat.map((x) => ({ surah: x.surah, ayah: x.ayah, name: x.name, au: x.au })),
      };
    } else if (seg.kind === 'hadith') {
      const sec = await getHadithSection(seg.book, seg.section, seg.lang);
      current = {
        ...current,
        book: seg.book, section: seg.section, lang: seg.lang,
        title: (sec && sec.title) || '', // empty title is fine: the reader says the book and number
        text: sec && sec.hadiths && sec.hadiths[0] ? sec.hadiths[0].text : '',
        grades: sec && sec.hadiths && sec.hadiths[0] ? sec.hadiths[0].grades : [],
      };
    } else {
      current = { ...current, slug: seg.slug, seconds: seg.seconds };
    }

    const next = np.next.map((s) => ({
      kind: s.kind, startMs: s.startMs, endMs: s.endMs,
      surah: s.kind === 'quran' ? s.surah : undefined,
      surahName: s.kind === 'quran' ? s.surahName : undefined,
      book: s.kind === 'hadith' ? s.book : undefined,
      section: s.kind === 'hadith' ? s.section : undefined,
      slug: s.kind === 'ad' ? s.slug : undefined,
      voiceUrl: voiceUrl(s.voiceId),
    }));

    const c = cleanChannel(cfg);
    return NextResponse.json({
      ok: true, now,
      pkt: pktClock(now),
      onAir: np.onAir, why: np.why, endsAtMs: np.endsAtMs || 0, progress: np.progress,
      current, next,
      channel: { title: c.title, slogan: c.slogan, theme: c.theme, showClock: c.showClock, ticker: tickerLines(c) },
      // the programming rules (cadence, rotation) - NO secrets here: youtube/stream keys never leave the admin API
      cfg: { ...c, youtube: { privacy: 'public', title: '', last: null } },
      ads: c.ads.enabled ? await getChannelAds(c.ads.slugs) : [],
    }, { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30' } });
  } catch (e) {
    console.error('live channel api failed:', e.message);
    return NextResponse.json({ ok: false, error: 'The channel service is not reachable right now.' }, { status: 502 });
  }
}
