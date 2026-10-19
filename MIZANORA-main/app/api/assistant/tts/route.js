import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { TTS_MODELS, geminiCall, loadAssistant } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optional natural female voice from Gemini (admin chooses "Gemini voice" in /admin/assistant).
// Returns a WAV file. If anything fails the browser falls back to its own built-in voice.
const hits = new Map();
const audio = new Map(); // same sentence = same audio: repeated greetings and replies cost no Gemini request

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function POST(req) {
  const closed = await denyIf('assistant');
  if (closed) return closed;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 15) return NextResponse.json({ ok: false }, { status: 429 });

  const { cfg, keys } = await loadAssistant();
  if (!cfg.enabled || cfg.voiceMode !== 'gemini' || !keys.length) return NextResponse.json({ ok: false }, { status: 501 });
  let text = '';
  try { text = String((await req.json()).text || '').replace(/\s+/g, ' ').trim().slice(0, 420); } catch { /* ignore */ }
  if (!text) return NextResponse.json({ ok: false }, { status: 400 });

  const ck = `${cfg.voiceName}|${text}`;
  const hit = audio.get(ck);
  if (hit) return new Response(hit, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400' } });
  // Try every voice model in turn (auto-switch): whichever key/model is free answers first.
  let part = null;
  for (const model of TTS_MODELS) {
    const r = await geminiCall(model, {
      contents: [{ parts: [{ text: `Say in a warm, friendly young Pakistani woman's voice, natural pace: ${text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voiceName } } } },
    }, { timeoutMs: 25000 });
    const c = r.ok && r.json.candidates && r.json.candidates[0] && r.json.candidates[0].content;
    part = c && c.parts && c.parts.find((p) => p.inlineData);
    if (part) break;
  }
  if (!part) return NextResponse.json({ ok: false }, { status: 502 });
  const rate = Number((/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [])[1]) || 24000;
  const out = wav(Buffer.from(part.inlineData.data, 'base64'), rate);
  if (audio.size >= 40) audio.delete(audio.keys().next().value);
  audio.set(ck, out);
  return new Response(out, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400' } });
}
