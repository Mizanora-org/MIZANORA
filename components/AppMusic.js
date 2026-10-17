'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_MUSIC_KEY } from '@/lib/appMusic';

// ---------------------------------------------------------------------------------------------
// The Mizanora background music player.
//
// It lives in the root layout, so it plays on EVERY page of the shop (home, products, category,
// cart, blog, ...). It renders no visible element of its own: the button in the header
// (components/MusicToggle.js) talks to it through the "mz-app-music" window event.
//
// Rules it follows:
//   1. One <audio> element for the whole app, looping, with the volume the admin set.
//   2. The shopper's on/off choice lives on their device (localStorage "mz_app_music").
//   3. Browsers refuse to play sound before the first tap, so we wait for the first touch.
//   4. The full-screen reels have their own music: while a reel is open the background music
//      pauses, and it comes back when the reel is closed.
//   5. Nothing plays in the admin panel.
// ---------------------------------------------------------------------------------------------
export default function AppMusic({ music = null }) {
  const path = usePathname() || '/';

  // ---- refs: the live audio element and the state the event handlers need
  const audio = useRef(null);
  const onRef = useRef(false);       // the shopper wants music on
  const playingRef = useRef(false);  // the audio is actually playing
  const failedRef = useRef(false);   // the link did not work in this browser
  const wantPlay = useRef(false);    // we want music playing right now
  const reelsOpen = useRef(false);   // a full-screen reel is showing

  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = music && music.url ? music.url : '';
  const volume = music ? Math.min(1, Math.max(0, Number(music.volume) || 0)) : 0;
  const autoplay = music ? music.autoplay !== false : false;
  const isAdmin = path.startsWith('/admin');

  // Tell the whole page (the header button) what the player is doing.
  const broadcast = useCallback((detail) => {
    try { window.dispatchEvent(new CustomEvent('mz-app-music', { detail })); } catch (_) { /* ignore */ }
  }, []);

  // ---- Read the shopper's choice (once) and keep it in sync with the header button.
  useEffect(() => {
    let stored = '1';
    try { stored = localStorage.getItem(APP_MUSIC_KEY) !== '0' ? '1' : '0'; } catch (_) { /* ignore */ }
    onRef.current = stored === '1';
    setOn(stored === '1');
    const sync = (e) => { if (e.detail && typeof e.detail.on === 'boolean') { onRef.current = e.detail.on; setOn(e.detail.on); } };
    window.addEventListener('mz-app-music', sync);
    return () => window.removeEventListener('mz-app-music', sync);
  }, []);

  // ---- The audio element: one song, on repeat, at the admin's volume.
  // NOTE: no crossOrigin here. It would force a CORS check and break hosts that do not send
  // CORS headers; a plain <audio src> does not need it.
  useEffect(() => {
    if (!url) { setPlaying(false); setFailed(false); playingRef.current = false; failedRef.current = false; return undefined; }
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = volume;
    audio.current = el;
    const onPlay = () => { playingRef.current = true; setPlaying(true); setFailed(false); failedRef.current = false; broadcast({ on: onRef.current, playing: true }); };
    const onPause = () => { playingRef.current = false; setPlaying(false); broadcast({ on: onRef.current, playing: false }); };
    const onError = () => { failedRef.current = true; setFailed(true); playingRef.current = false; setPlaying(false); broadcast({ on: onRef.current, playing: false, failed: true }); };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
      el.pause();
      audio.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // keep the refs in step with the state
  useEffect(() => { onRef.current = on; }, [on]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { failedRef.current = failed; }, [failed]);

  // ---- Volume changes (the admin can change it without a new page load).
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);

  // ---- Start / stop. play() can be refused by the browser; then we wait for the next tap.
  const tryPlay = useCallback(() => {
    const el = audio.current;
    if (!el || !url) return;
    wantPlay.current = true;
    const p = el.play();
    if (p && p.catch) p.catch(() => { playingRef.current = false; setPlaying(false); }); // blocked: the unlock listener retries
  }, [url]);

  const pauseMusic = useCallback(() => {
    wantPlay.current = false;
    if (audio.current) audio.current.pause();
  }, []);

  // ---- The shopper's switch: on -> play, off -> pause. Remembered on the device.
  const setSwitch = useCallback((next) => {
    onRef.current = next;
    setOn(next);
    try { localStorage.setItem(APP_MUSIC_KEY, next ? '1' : '0'); } catch (_) { /* ignore */ }
    // Only the switch is reported here. The "playing" state comes from the audio element itself,
    // so the button never claims the music plays while the browser is still refusing to start it.
    broadcast({ on: next });
    if (next) tryPlay(); else pauseMusic();
  }, [broadcast, pauseMusic, tryPlay]);

  // ---- Browser rule: no sound before the first tap. The very first touch anywhere unlocks it.
  useEffect(() => {
    if (!url) return undefined;
    const unlock = () => {
      if (!wantPlay.current) return;
      const el = audio.current;
      if (!el) return;
      const p = el.play();
      if (p && p.then) p.then(() => { setFailed(false); failedRef.current = false; }).catch(() => { /* still blocked: wait for the next tap */ });
    };
    // v19: touchstart / pointerdown do NOT unlock audio on phones (Chrome Android and iPhone need the finger to lift), so the first tap
    // never started the music. touchend, pointerup and click do.
    const events = ['pointerup', 'touchend', 'click', 'keydown'];
    events.forEach((e) => document.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, unlock));
  }, [url]);

  // ---- Should the music be playing right now? (on + not in the admin + not a reel on screen)
  useEffect(() => {
    if (!url || isAdmin) { pauseMusic(); return; }
    if (!on) { pauseMusic(); return; }
    if (!autoplay) return;         // the shopper has to press the button
    if (reelsOpen.current) return; // the reels have their own music
    tryPlay();
  }, [url, on, autoplay, isAdmin, pauseMusic, tryPlay]);

  // ---- The reels screen has its own music: pause ours while a reel is open, come back after.
  useEffect(() => {
    const onReels = (e) => {
      const isOpen = Boolean(e.detail && e.detail.open);
      reelsOpen.current = isOpen;
      if (isOpen) pauseMusic();
      else if (on && autoplay && !isAdmin) tryPlay();
    };
    window.addEventListener('mz-reels-viewer', onReels);
    return () => window.removeEventListener('mz-reels-viewer', onReels);
  }, [on, autoplay, isAdmin, pauseMusic, tryPlay]);

  // ---- The header button (and other parts of the app) ask the player to change state.
  useEffect(() => {
    const cmd = (e) => {
      const d = e.detail || {};
      if (d.cmd === 'toggle') setSwitch(!onRef.current);
      else if (d.cmd === 'on') setSwitch(true);
      else if (d.cmd === 'off') setSwitch(false);
      else if (d.cmd === 'state') broadcast({ on: onRef.current, playing: playingRef.current, failed: failedRef.current });
    };
    window.addEventListener('mz-app-music-cmd', cmd);
    return () => window.removeEventListener('mz-app-music-cmd', cmd);
  }, [broadcast, setSwitch]);

  return null; // the player is invisible: the header button is what people see
}
