#!/usr/bin/env node
// LIVE CHANNEL CASTER (v27.1) - the engine behind .github/workflows/live-channel.yml - built for 24/7.
//
// TWO MODES, both with ZERO internal restarts:
//
//   ONE SHOT (GitHub Action, default):
//   One job pushes up to ~5.5 hours with ONE ffmpeg process and ONE playlist that covers the whole budget - inside the
//   job the stream never stops, not even for a second. About 20 minutes before the budget ends the caster dispatches
//   the NEXT run of the workflow (the "baton"); the workflow's concurrency group queues that run so it starts the
//   moment this one ends. The 30-minute cron keeps a fresh pending run as well, so even if the baton dies the handover
//   still happens. If ffmpeg ever drops (network blip) it reconnects with backoff and the program CONTINUES from the
//   wall clock - the same ayah/hadith/ad as everyone else. When the admin's Pakistan-time window ends, the push stops
//   2 minutes early - never a wrong second on air.
//
//   --loop (your PC / a VPS - the TRULY gapless 24/7):
//   A tiny local playlist server feeds ffmpeg a LIVE sliding HLS window (no end) and ffmpeg runs until you press
//   Ctrl+C - days without a single restart. Reconnects happen only after a real failure (network/YouTube), and the
//   program re-syncs from the wall clock. Off-air window? The caster waits quietly and resumes by itself.
//   This is the recommended way for "ek second ka bhi gap nahi" (GitHub runners must hand over twice a day by design).
//
// Usage:  node scripts/live-cast.mjs [options]
//   --minutes N       one-shot budget 1..350 (default: env CAST_MINUTES or 45; the schedule can cut it shorter)
//   --loop            never exit (PC/VPS mode; --minutes is ignored - it runs until Ctrl+C)
//   --base URL        the site origin (default: env LIVE_CHANNEL_API or https://mizanora.vercel.app)
//   --serve-port N    playlist server port in --loop mode (default 8722)
//   --dry-run         only build and print the playlist - no ffmpeg, no YouTube, no baton
//   --force           cast even when the channel is off air (a test / special broadcast)
//   --no-chain        do not dispatch the next GitHub run (single-shot jobs)
// Env:
//   YOUTUBE_STREAM_KEY     stream key of the YouTube broadcast (GitHub secret). Missing -> dry run.
//   YOUTUBE_RTMP_URL       default rtmp://a.rtmp.youtube.com/live2
//   CAST_MINUTES           default minutes (one-shot mode)
//   GITHUB_ACTIONS/TOKEN/REPOSITORY/REF_NAME  used for the baton (set automatically inside Actions)
import fs from 'node:fs';
import http from 'node:http';
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

const loopMode = flag('--loop');
const dry = flag('--dry-run');
const force = flag('--force');
const noChain = flag('--no-chain');
const base = String(val('--base', process.env.LIVE_CHANNEL_API || 'https://mizanora.vercel.app')).replace(/\/+$/, '');
const servePort = Math.min(65000, Math.max(1024, Number(val('--serve-port', 8722)) || 8722));
const key = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const rtmpBase = String(process.env.YOUTUBE_RTMP_URL || 'rtmp://a.rtmp.youtube.com/live2').replace(/\/+$/, '');
const wantMinutes = Math.min(L.CAST_MAX_MIN, Math.max(1, Math.floor(Number(val('--minutes', process.env.CAST_MINUTES || 45)) || 45)));

const say = (...m) => console.log('[live-cast]', new Date().toISOString().slice(11, 19), ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the state of the channel -------------------------------------------------------------------------------------
async function readState() {
  try {
    const r = await fetch(`${base}/api/live/channel`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || `http ${r.status}`);
    return j;
  } catch (e) {
    say('could not read the channel state:', e.message);
    return null;
  }
}

// ---- playlists ----------------------------------------------------------------------------------------------------
// How many programming segments cover `sec` seconds of air time (quran 18 min | hadith 6 min | ad 45 s, per cycle).
function segsFor(cfg, sec) {
  const { cycleSec, parts } = L.segLayout(cfg);
  return Math.min(400, Math.ceil(sec / cycleSec) * parts.length + 6);
}
// One-shot: a CLOSED playlist that covers the whole budget + a 20-minute margin (ffmpeg loops it as a safety net and
// stops at -t). One ffmpeg, one playlist, ZERO restarts inside the run.
function buildClosed(cfg, minutes) {
  return L.buildM3U8(cfg, Date.now(), segsFor(cfg, minutes * 60 + 1200), { base, endlist: true });
}
// --loop: a LIVE sliding window (3 minutes back, ~3.5 hours ahead) WITHOUT end - ffmpeg follows it forever.
function buildLive(cfg) {
  return L.buildM3U8(cfg, Date.now() - 3 * 60e3, segsFor(cfg, 3.5 * 3600), { base, endlist: false });
}

// ---- the baton: dispatch the next GitHub run so the handover is already queued when this job ends ------------------
let chained = false;
async function chainDispatch() {
  if (chained || noChain || dry || loopMode) return;
  chained = true;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const ref = process.env.GITHUB_REF_NAME || 'main';
  if (!repo || !token) { say('no GITHUB_TOKEN/REPOSITORY - the baton is left to the 30-minute cron.'); return; }
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/live-channel.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref, inputs: { duration: String(wantMinutes), dry_run: 'false', force: String(force), no_chain: 'false' } }),
      signal: AbortSignal.timeout(20000),
    });
    say(r.ok ? 'baton sent: the next run is queued and takes over when this job ends.' : `baton dispatch failed (http ${r.status}) - the 30-minute cron hands over instead.`);
  } catch (e) {
    say('baton dispatch failed:', e.message, '- the 30-minute cron hands over instead.');
  }
}

// ---- one ffmpeg push of `input` for `seconds` (0 = until killed) ---------------------------------------------------
let currentFf = null;
process.on('SIGINT', () => { if (currentFf) currentFf.kill('SIGINT'); else process.exit(0); });
process.on('SIGTERM', () => { if (currentFf) currentFf.kill('SIGTERM'); else process.exit(0); });
function push(input, seconds) {
  return new Promise((resolve) => {
    const banner = path.join(root, 'public/img/hero-banner.jpg');
    const out = `${rtmpBase}/${key}`;
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'warning', '-stats',
      '-re', ...(seconds ? ['-stream_loop', '-1'] : []), '-i', input,
      ...(fs.existsSync(banner) ? ['-loop', '1', '-framerate', '15', '-i', banner] : ['-f', 'lavfi', '-i', 'color=c=0x06402B:s=1280x720:r=15']),
      '-map', '1:v', '-map', '0:a',
      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage',
      '-pix_fmt', 'yuv420p', '-g', '60', '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      ...(seconds ? ['-t', String(Math.max(30, Math.floor(seconds)))] : []),
      '-f', 'flv', out,
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
    currentFf = ff;

    const started = Date.now();
    const totalMs = (seconds || 0) * 1000;
    const chainAt = totalMs ? started + Math.max(5 * 60e3, totalMs - 20 * 60e3) : 0;
    const tick = setInterval(() => {
      if (chainAt && !chained && Date.now() >= chainAt) chainDispatch();
    }, 30000);
    tick.unref();

    // mid-run schedule check every 3 minutes: the admin switched the channel off -> stop at the window edge
    let guard;
    if (!force) {
      guard = setInterval(async () => {
        if (Date.now() - started < 3 * 60e3) return;
        const s = await readState();
        if (s && !s.onAir) { say('the channel went off air mid-run - stopping at the window edge.'); ff.kill('SIGTERM'); }
      }, 180000);
      guard.unref();
    }

    const done = (code) => { clearInterval(tick); if (guard) clearInterval(guard); currentFf = null; resolve(code); };
    ff.on('error', (e) => { say('ffmpeg could not start (is ffmpeg installed?):', e.message); done(127); });
    ff.on('exit', (c) => done(c));
  });
}

// ---- ONE SHOT: state -> budget -> closed playlist -> push (with reconnects) --------------------------------------
async function oneShot() {
  const state = await readState();
  if (!state) return 'retry';
  say(`channel: ${state.channel.title} | on air: ${state.onAir ? `yes (${state.why})` : 'no'}`);
  const cfg = L.cleanChannel(state.cfg || {});
  const budget = L.castBudget(cfg, Date.now(), wantMinutes, { force });
  if (!budget.ok) {
    say(`not casting now (${budget.why}) - the schedule says off air. Bye.`);
    return 'done';
  }
  say(`budget: ${budget.minutes} minute(s)${budget.endsAtMs ? `, window ends ${new Date(budget.endsAtMs).toISOString().slice(11, 16)} UTC` : ''}`);

  const deadline = Date.now() + budget.minutes * 60e3;
  let attempt = 0;
  while (Date.now() < deadline - 45e3) {
    const left = Math.max(30, (deadline - Date.now()) / 1000);
    const text = buildClosed(cfg, left / 60 + 10);
    if (!text.trim()) { say('empty playlist - retrying in 30 s.'); await sleep(30e3); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mizanora-live-'));
    const file = path.join(tmp, 'channel.m3u8');
    fs.writeFileSync(file, text);
    const items = text.split('\n').filter((l) => l && !l.startsWith('#')).length;
    say(`pushing: ${items} media files, ${Math.round(left / 60)} minute(s) of budget left (attempt ${attempt + 1})`);

    const code = await push(file, left);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    if (code === 0) { say('budget finished cleanly.'); return 'done'; }
    attempt++;
    if (attempt > 10) { say('too many reconnects - giving up this shot.'); break; }
    const wait = Math.min(60, 6 * attempt);
    say(`ffmpeg exited with code ${code} - reconnecting in ${wait}s (the program continues from the wall clock).`);
    await sleep(wait * 1000);
  }
  await chainDispatch();
  return 'done';
}

// ---- LOOP (PC / VPS): live sliding playlist server + one endless ffmpeg, weeks without a restart ------------------
async function runLoop() {
  let lastState = null;
  const server = http.createServer((req, res) => {
    if (!/^\/(live|channel)?(\.m3u8)?\/?$/.test(req.url || '/')) { res.writeHead(404).end('not found'); return; }
    const state = lastState;
    const text = state ? buildLive(L.cleanChannel(state.cfg || {})) : '#EXTM3U\n';
    res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' });
    res.end(text);
  });
  await new Promise((r) => server.listen(servePort, '127.0.0.1', r));
  say(`live playlist server: http://127.0.0.1:${servePort}/live.m3u8 (sliding window, follows the wall clock)`);

  lastState = await readState();
  if (!lastState) process.exit(1);
  setInterval(async () => {
    const s = await readState();
    if (s) lastState = s;
  }, 5 * 60e3).unref();

  let attempt = 0;
  for (;;) {
    const s = lastState;
    const onAir = force || (s && s.onAir);
    if (!onAir) {
      say(`off air (${(s && s.why) || 'unknown'}) - waiting quietly for the next window...`);
      await sleep(60e3);
      continue;
    }
    say(`channel: ${s.channel.title} | pushing live (attempt ${attempt + 1})...`);
    const code = await push(`http://127.0.0.1:${servePort}/live.m3u8`, 0);
    if (code === 0) say('ffmpeg stopped by itself - restarting.');
    else say(`ffmpeg exited with code ${code}.`);
    attempt++;
    if (attempt > 100) attempt = 10; // the backoff stays gentle forever
    await sleep(Math.min(60, 4 * attempt) * 1000);
    // refresh the picture before reconnecting
    const fresh = await readState();
    if (fresh) lastState = fresh;
  }
}

// ---- main ----------------------------------------------------------------------------------------------------------
if (dry || !key) {
  const state = await readState();
  if (!state) process.exit(1);
  const cfg = L.cleanChannel(state.cfg || {});
  const budget = L.castBudget(cfg, Date.now(), wantMinutes, { force });
  const minutes = budget.ok ? budget.minutes : wantMinutes;
  const text = loopMode ? buildLive(cfg) : buildClosed(cfg, Math.min(minutes, 30));
  const items = text.split('\n').filter((l) => l && !l.startsWith('#')).length;
  say(`DRY RUN (${loopMode ? 'loop/live window' : 'one shot'}): on air: ${state.onAir}, budget: ${budget.ok ? `${minutes} min (${budget.why})` : `none (${budget.why})`}`);
  say(`playlist would carry ${items} media files; first items:`);
  say(' ', text.split('\n').filter((l) => l && !l.startsWith('#')).slice(0, 3).join('\n  '));
  say(dry ? 'dry run: stopping before ffmpeg.' : 'YOUTUBE_STREAM_KEY is not set - stopping before ffmpeg.');
  process.exit(0);
}

say(`site: ${base} | mode: ${loopMode ? 'LOOP (24/7 until Ctrl+C)' : `one shot (${wantMinutes} min max)`} | key: ${key.slice(0, 4)}••••••••`);
if (loopMode) {
  await runLoop();
} else {
  for (;;) {
    const r = await oneShot();
    if (r === 'done') break;
    say('state was unreachable - retrying in 30 s...');
    await sleep(30e3);
  }
  say('bye.');
}
