import { NextResponse } from 'next/server';
import { geminiCall, loadAssistant } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optional natural female voice from Gemini (admin chooses "Gemini voice" in /admin/assistant).
// Returns a WAV file. If anything fails the browser falls back to its own built-in voice.
const hits = new Map();

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function POST(req) {
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

  const r = await geminiCall('gemini-2.5-flash-preview-tts', {
    contents: [{ parts: [{ text: `Say in a warm, friendly young Pakistani woman's voice, natural pace: ${text}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voiceName } } } },
  }, { timeoutMs: 25000 });
  const part = r.ok && r.json.candidates && r.json.candidates[0] && r.json.candidates[0].content && r.json.candidates[0].content.parts && r.json.candidates[0].content.parts.find((p) => p.inlineData);
  if (!part) return NextResponse.json({ ok: false }, { status: 502 });
  const rate = Number((/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [])[1]) || 24000;
  return new Response(wav(Buffer.from(part.inlineData.data, 'base64'), rate), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
}
