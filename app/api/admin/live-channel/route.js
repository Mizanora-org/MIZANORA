import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { TTS_MODELS, geminiCall } from '@/lib/gemini';
import { CHANNEL_DEFAULT, CHANNEL_DOC, TTS_VOICES, cleanChannel, pcmToWav, channelStatus, nowPlaying, pktClock, voiceIdOk } from '@/lib/liveChannel';
import { deleteVoice, listVoices, saveVoice } from '@/lib/liveChannelServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s });

// Admin only - the control desk of the live channel.
//  get                                        -> saved setting + on-air state + voiceover index
//  save  { ...cleanChannel fields }           -> publish a new setting (the shop refreshes within seconds)
//  voice { id, text, voiceName, kind }        -> make ONE AI voiceover with Gemini TTS and store it
//  voiceDelete { id }                         -> remove one voiceover
//  ytStatus                                   -> is the YouTube API set up? (env only, never returns secrets)
//  ytCreate { title, privacy }                -> create + bind a YouTube live broadcast, return RTMPS + stream key
//  ytEnd { broadcastId }                      -> complete the broadcast
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const act = String(b.action || '');

  try {
    if (act === 'get') {
      const d = await adminDb().collection(CHANNEL_DOC.collection).doc(CHANNEL_DOC.id).get();
      const cfg = cleanChannel({ ...CHANNEL_DEFAULT, ...(d.exists ? d.data() : {}) });
      const voices = await listVoices();
      return json({ ok: true, cfg, voices, onAir: channelStatus(cfg), now: nowPlaying(cfg), pkt: pktClock() });
    }

    if (act === 'save') {
      const cfg = cleanChannel(b.cfg || b);
      await adminDb().collection(CHANNEL_DOC.collection).doc(CHANNEL_DOC.id).set({ ...cfg, updatedAtMs: Date.now(), updatedBy: a.uid || '' }, { merge: true });
      try { revalidateTag('livechannel'); } catch { /* it refreshes by itself within 10 minutes */ }
      return json({ ok: true, cfg, onAir: channelStatus(cfg) });
    }

    if (act === 'voice') {
      const id = String(b.id || '');
      const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      const voiceName = TTS_VOICES.includes(b.voiceName) ? b.voiceName : 'Kore';
      if (!voiceIdOk(id)) return json({ ok: false, error: 'Bad voice id.' }, 400);
      if (!text) return json({ ok: false, error: 'Write the ad / hadith script first.' }, 400);
      let part = null;
      for (const model of TTS_MODELS) {
        const r = await geminiCall(model, {
          contents: [{ parts: [{ text: `Speak clearly, warm and natural, medium pace, like a Pakistani TV channel announcer: ${text}` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
        }, { timeoutMs: 30000 });
        const c = r.ok && r.json.candidates && r.json.candidates[0] && r.json.candidates[0].content;
        part = c && c.parts && c.parts.find((p) => p.inlineData);
        if (part) break;
      }
      if (!part) return json({ ok: false, error: 'The AI voice could not be made right now. Check the Gemini keys in Admin > AI Assistant and try again.' }, 502);
      const rate = Number((/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [])[1]) || 24000;
      const wav = pcmToWav(Buffer.from(part.inlineData.data, 'base64'), rate);
      const saved = await saveVoice(id, wav, { text, voiceName, kind: String(b.kind || '').slice(0, 12) });
      try { revalidateTag('livechannel'); } catch { /* ignore */ }
      return json({ ok: true, ...saved, voiceName });
    }

    if (act === 'voiceDelete') {
      const gone = await deleteVoice(String(b.id || ''));
      try { revalidateTag('livechannel'); } catch { /* ignore */ }
      return json({ ok: true, gone });
    }

    // ---- YouTube Live (YouTube Data API v3 + Live Streaming API) --------------------------------------------------
    if (act === 'ytStatus') {
      return json({ ok: true, configured: ytConfigured(), hint: ytConfigured() ? '' : 'Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN in Vercel (see UPGRADE-v27.md).' });
    }

    if (act === 'ytCreate' || act === 'ytEnd') {
      const token = await ytToken();
      if (!token) return json({ ok: false, error: 'YouTube is not set up. Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN in Vercel.' }, 503);
      if (act === 'ytEnd') {
        const id = String(b.broadcastId || '');
        if (!id) return json({ ok: false, error: 'No broadcast id.' }, 400);
        const r = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,status&id=${encodeURIComponent(id)}&transitionToStatus=complete`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        return json(r.ok ? { ok: true } : { ok: false, error: `YouTube said ${r.status}` }, r.ok ? 200 : 502);
      }
      const title = String(b.title || '').slice(0, 100) || 'Mizanora Quran & Hadith Live';
      const privacy = ['public', 'unlisted', 'private'].includes(b.privacy) ? b.privacy : 'public';
      // 1) the broadcast (the watch page)
      const bcRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippet: { title, scheduledStartTime: new Date(Date.now() - 60000).toISOString(), description: 'Live Quran tilawat, ahadees aur Mizanora products — mizanora.com/live-channel' },
          status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
          // enableAutoStop:false is the 24/7 key: when the encoder hands over to the next runner (or reconnects after
          // a network blip), YouTube must NOT complete the broadcast - the watch page stays live through the handover.
          contentDetails: { enableAutoStart: true, enableAutoStop: false, enableDvr: true, recordFromStart: true },
        }),
      });
      const bc = await bcRes.json().catch(() => ({}));
      if (!bcRes.ok || !bc.id) return json({ ok: false, error: ytErr(bc, bcRes.status) }, 502);
      // 2) the stream (the pipe our ffmpeg pushes into)
      const stRes = await fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: { title: `${title} (Mizanora)` }, cdn: { ingestionType: 'rtmp', resolution: '720p', frameRate: '30' } }),
      });
      const st = await stRes.json().catch(() => ({}));
      if (!stRes.ok || !st.id) return json({ ok: false, error: ytErr(st, stRes.status) }, 502);
      // 3) bind them together
      await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=id,contentDetails&id=${bc.id}&streamId=${st.id}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const ing = (st.cdn && st.cdn.ingestionInfo) || {};
      const last = {
        broadcastId: bc.id, streamId: st.id,
        rtmpUrl: String(ing.ingestionAddress || 'rtmp://a.rtmp.youtube.com/live2'),
        streamKey: String(ing.streamName || ''),
        watchUrl: `https://www.youtube.com/watch?v=${bc.id}`,
        createdAt: Date.now(),
      };
      const ref = adminDb().collection(CHANNEL_DOC.collection).doc(CHANNEL_DOC.id);
      await ref.set({ youtube: { privacy, title: '', last } }, { merge: true });
      try { revalidateTag('livechannel'); } catch { /* ignore */ }
      return json({ ok: true, ...last, rtmp: `${last.rtmpUrl}/${last.streamKey}` });
    }

    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('live channel admin api failed:', e.message);
    return json({ ok: false, error: e.message || 'Server error.' }, 500);
  }
}

// ---- YouTube OAuth (refresh token flow; the three variables never leave the server) --------------------------------
function ytConfigured() {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);
}
async function ytToken() {
  if (!ytConfigured()) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  return j.access_token || null;
}
function ytErr(j, status) {
  const m = j && j.error && (j.error.message || (j.error.errors && j.error.errors[0] && j.error.errors[0].reason));
  return `YouTube: ${m || `error ${status}`}`;
}
