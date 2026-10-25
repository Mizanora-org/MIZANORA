// Soft interface sounds made in the browser (no audio files). Small, pleasant, and always optional: shoppers can mute them.
const KEY = 'mz_sound';
let ctx = null;
let lastTap = 0;

export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); window.dispatchEvent(new Event('mz-sound')); } catch (_) {}
  if (on) sfx.tap();
}

function audio() {
  if (typeof window === 'undefined') return null;
  try {
    // Safari still exposes the prefixed constructor; treat it as an optional window property.
    const win = /** @type {Window & { webkitAudioContext?: typeof AudioContext }} */ (window);
    if (!ctx) { const C = win.AudioContext || win.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

// one soft note
function note(freq, at, dur, { type = 'sine', vol = 0.05, glide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
const play = (fn, vib) => { if (!soundOn()) return; fn(); if (vib) buzz(vib); };

export const sfx = {
  // tap is throttled: fast repeated taps give one soft click, not a machine-gun of sounds
  tap: () => { const now = Date.now(); if (now - lastTap < 70) return; lastTap = now; play(() => note(720, 0, 0.05, { type: 'triangle', vol: 0.03, glide: -180 }), 8); },
  add: () => play(() => { note(523, 0, 0.1, { vol: 0.06 }); note(784, 0.09, 0.16, { vol: 0.06 }); }, [12, 30, 12]),
  wish: () => play(() => { note(660, 0, 0.09, { vol: 0.05 }); note(880, 0.08, 0.14, { vol: 0.05 }); }, 15),
  coupon: () => play(() => { note(784, 0, 0.09, { vol: 0.05 }); note(988, 0.09, 0.09, { vol: 0.05 }); note(1319, 0.18, 0.18, { vol: 0.05 }); }, [10, 20, 10]),
  success: () => play(() => { [523, 659, 784, 1047].forEach((f, n) => { note(f, n * 0.11, 0.28, { vol: 0.07 }); note(f * 2, n * 0.11, 0.2, { type: 'triangle', vol: 0.015 }); }); }, [20, 40, 20, 40, 60]),
  error: () => play(() => { note(260, 0, 0.14, { type: 'square', vol: 0.025, glide: -60 }); note(200, 0.14, 0.18, { type: 'square', vol: 0.025, glide: -40 }); }, [40, 50, 40]),
};

// Small message at the bottom of the screen ("Added to cart")
export const toast = (msg, { href = '', label = '' } = {}) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mz-toast', { detail: { msg, href, label } }));
};
