#!/usr/bin/env node
// LIVE CHANNEL CASTER (v27) - the engine behind .github/workflows/live-channel.yml.
//
// It turns the shop's Quran & Hadith channel into a real YouTube live stream:
//   1. reads the schedule + program rules from the site (/api/live/channel)
//   2. builds the LIVE M3U8 PLAYLIST of the coming minutes (Quran ayah files from the CDN + the AI voiceovers of the
//      hadith readings and the product ads) with exactly the same pure code the website uses (lib/liveChannel.js),
//   3. feeds it to ffmpeg: the playlist loops as the audio, the shop banner becomes the video of the "radio TV",
//   4. pushes it to YouTube over RTMPS (-re means real-time: one second of audio per second, like a real broadcast).
//
// Usage:  node scripts/live-cast.mjs [--minutes 45] [--base https://mizanora.vercel.app] [--dry-run] [--force]
//   --minutes N   how long to stay live (1..60). The playlist loops if it runs out.
//   --base URL    the site origin (default: env LIVE_CHANNEL_API or https://mizanora.vercel.app)
//   --dry-run     only build and print the playlist - no ffmpeg, no YouTube
//   --force       go live even when the channel is off air (for a test or a special broadcast)
// Env:
//   YOUTUBE_STREAM_KEY   the stream key of the YouTube broadcast (GitHub secret). Missing -> dry run.
//   YOUTUBE_RTMP_URL     default rtmp://a.rtmp.youtube.com/live2 (change for a custom ingest)
//   CAST_MINUTES         default minutes when --minutes is not given (default 45)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const L = await import(pathToFileURL(path.join(root, 'lib/liveChannel.js')).href);

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const minutes = Math.min(60, Math.max(1, Math.floor(Number(val('--minutes', process.env.CAST_MINUTES || 45)) || 45)));
const base = String(val('--base', process.env.LIVE_CHANNEL_API || 'https://mizanora.vercel.app')).replace(/\/+$/, '');
const dry = flag('--dry-run');
const force = flag('--force');
const key = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const rtmpBase = String(process.env.YOUTUBE_RTMP_URL || 'rtmp://a.rtmp.youtube.com/live2').replace(/\/+$/, '');

const say = (...m) => console.log('[live-cast]', ...m);

// ---- 1) what is on air right now ----------------------------------------------------------------------------------
say(`site: ${base}`);
let state;
try {
  const r = await fetch(`${base}/api/live/channel`, { signal: AbortSignal.timeout(20000) });
  state = await r.json();
  if (!r.ok || !state.ok) throw new Error(state.error || `http ${r.status}`);
} catch (e) {
  say('could not read the channel state:', e.message);
  process.exit(1);
}

say(`channel: ${state.channel.title} | on air: ${state.onAir ? `yes (${state.why})` : 'no'}`);
if (!state.onAir && !force) {
  say('the channel is off air right now (Pakistan-time schedule) - nothing to cast. Bye.');
  process.exit(0);
}

// ---- 2) the playlist (the SAME program the website shows, built from the same lib) --------------------------------
const cfg = L.cleanChannel(state.cfg || {});
const segCount = Math.min(400, Math.ceil(minutes / 5) + 8);
const playlist = L.buildM3U8(cfg, Date.now(), segCount, {
  base,
  endlist: true, // a closed playlist that ffmpeg loops for the whole broadcast
});
if (!playlist.trim()) {
  say('the playlist came out empty - check the channel settings.');
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mizanora-live-'));
const m3u8 = path.join(tmp, 'channel.m3u8');
fs.writeFileSync(m3u8, playlist);
const lines = playlist.split('\n').filter((l) => l && !l.startsWith('#'));
say(`playlist: ${lines.length} media files (${playlist.length} bytes) -> ${m3u8}`);
say('first items:', lines.slice(0, 3).join(' | ') || '(none)');

if (dry || !key) {
  say(dry ? 'dry run: stopping before ffmpeg.' : 'YOUTUBE_STREAM_KEY is not set - stopping before ffmpeg (playlist is ready).');
  say('to go live: set the YOUTUBE_STREAM_KEY secret (Admin > Live Channel > YouTube) and run again.');
  process.exit(0);
}

// ---- 3+4) ffmpeg: loop the playlist as audio, the shop banner as video, push RTMPS in real time -------------------
const banner = path.join(root, 'public/img/hero-banner.jpg');
const out = `${rtmpBase}/${key}`;
say(`going live for ${minutes} minute(s) -> ${rtmpBase}/••••••••`);

const ff = spawn('ffmpeg', [
  '-hide_banner', '-loglevel', 'warning', '-stats',
  '-re', '-stream_loop', '-1', '-i', m3u8,
  ...(fs.existsSync(banner) ? ['-loop', '1', '-framerate', '15', '-i', banner] : ['-f', 'lavfi', '-i', 'color=c=0x06402B:s=1280x720:r=15']),
  '-map', '1:v', '-map', '0:a',
  '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage',
  '-pix_fmt', 'yuv420p', '-g', '60', '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
  '-t', String(minutes * 60),
  '-f', 'flv', out,
], { stdio: ['ignore', 'inherit', 'inherit'] });

const bye = (code) => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  say('stream finished with code', code);
  process.exit(code || 0);
};
ff.on('error', (e) => { say('ffmpeg could not start (is ffmpeg installed?):', e.message); bye(1); });
ff.on('exit', (c) => bye(c));
process.on('SIGINT', () => { ff.kill('SIGINT'); });
process.on('SIGTERM', () => { ff.kill('SIGTERM'); });
