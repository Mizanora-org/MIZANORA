'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QuranStage, { useQuran } from './QuranStage';
import QuranStream from './QuranStream';
import { startPoint } from '@/lib/quranState';
import { RECITERS, TRANSLATIONS } from '@/lib/quran';

// The visitor's own choice (translation, voice, text size, volume) is kept on his device.
const PKEY = 'mz_quran_prefs';
function readPrefs(cfg) {
  const base = { reciter: cfg.reciter, translation: cfg.translation, size: cfg.size, showArabic: cfg.showArabic, volume: cfg.volume };
  if (!cfg.allowChoice) return base;
  try {
    const j = JSON.parse(localStorage.getItem(PKEY) || 'null') || {};
    return {
      reciter: RECITERS.some((r) => r[0] === j.reciter) ? j.reciter : base.reciter,
      translation: typeof j.translation === 'string' && TRANSLATIONS.some((t) => t[0] === j.translation) ? j.translation : base.translation,
      size: ['s', 'm', 'l'].includes(j.size) ? j.size : base.size,
      showArabic: typeof j.showArabic === 'boolean' ? j.showArabic : base.showArabic,
      volume: Number.isFinite(j.volume) ? Math.min(100, Math.max(0, j.volume)) : base.volume,
    };
  } catch (_) { return base; }
}

// The pop-up / full-screen shell of the Quran session. Loaded only when the session is opened (next/dynamic in QuranSession).
//  * starts the recitation by itself when the admin allowed it (autoStart): at once, or with the visitor's first touch when the
//    browser refuses sound before a touch
//  * the shop's background music steps aside while the recitation plays (same event the reels use)
//  * the page behind does not scroll; Esc closes
//  * LIVE RADIO: the visitor joins where the recitation is right now (shared pointer, /api/quran/state), it continues surah after
//    surah, and there is no pause / speed / next button. When the admin's window ends the pointer stays, so the next window goes on from there.
export default function QuranHost({ cfg, onClose, autoStart = true, radio = true }) {
  const [streamBad, setStreamBad] = useState(false);
  if (radio && cfg.source === 'stream' && cfg.streamUrl && !streamBad) return <QuranStream cfg={cfg} onClose={onClose} onFail={() => setStreamBad(true)} />;
  return <AyahHost cfg={cfg} onClose={onClose} autoStart={autoStart} radio={radio} />;
}

function AyahHost({ cfg, onClose, autoStart, radio }) {
  const [start, setStart] = useState(radio ? null : { surah: cfg.surah, ayah: cfg.from || 1 });
  useEffect(() => {
    if (!radio) return undefined;
    let dead = false;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3500);
    fetch('/api/quran/state', { cache: 'no-store', signal: ctl.signal }).then((r) => r.json()).catch(() => null).then((j) => {
      clearTimeout(t);
      if (!dead) setStart(startPoint(cfg, j && j.state));
    });
    return () => { dead = true; clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radio]);
  if (!start) return <Loading cfg={cfg} onClose={onClose} />;
  return <Live cfg={cfg} onClose={onClose} autoStart={autoStart} radio={radio} start={start} />;
}

function Loading({ cfg, onClose }) {
  useEffect(() => { const esc = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="mzq-layer is-sheet" role="status" aria-label={cfg.title}><div className="mzq mzq-sheet" data-style={cfg.style} data-radio="1"><div className="mzq-bg" aria-hidden="true"><i className="mzq-orb o1" /><i className="mzq-orb o2" /></div><div className="mzq-body"><div className="mzq-state"><span className="mzq-spin" aria-hidden="true" />Live tilawat se jud rahe hain...</div></div></div></div>, document.body);
}

function Live({ cfg, onClose, autoStart, radio, start }) {
  const [prefs, setPrefs] = useState(() => (typeof window === 'undefined' ? { reciter: cfg.reciter, translation: cfg.translation, size: cfg.size, showArabic: cfg.showArabic, volume: cfg.volume } : readPrefs(cfg)));
  const change = (patch) => setPrefs((p) => { const n = { ...p, ...patch }; try { localStorage.setItem(PKEY, JSON.stringify(n)); } catch (_) { /* storage blocked */ } return n; });
  const player = useQuran({ surah: start.surah, from: start.ayah, to: radio ? 0 : cfg.to, reciter: prefs.reciter, translation: prefs.translation, volume: prefs.volume, continuous: cfg.continuous, loop: cfg.loop, radio });
  const lastPost = useRef('');
  // Tell the server which ayah is being recited (only honest steps forward are kept) so the next visitor / the next window continues here.
  useEffect(() => {
    if (!radio || !player.playing || !player.data || !player.ayah) return;
    const key = `${player.data.surah}:${player.ayah.n}`;
    if (lastPost.current === key) return;
    lastPost.current = key;
    try { fetch('/api/quran/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surah: player.data.surah, ayah: player.ayah.n }), keepalive: true }).catch(() => {}); } catch (_) { /* best effort */ }
  }, [radio, player.playing, player.data, player.ayah]);
  const started = useRef(false);
  const ready = player.state === 'ready';

  // Start once the surah is loaded.
  useEffect(() => {
    if (!autoStart || !ready || started.current) return;
    started.current = true;
    player.play();
  }, [autoStart, ready, player]);

  // The browser said "touch first": the next touch anywhere starts it.
  useEffect(() => {
    if (!player.blocked || !autoStart) return undefined;
    const go = () => { player.play(); };
    const ev = ['pointerup', 'touchend', 'click', 'keydown'];
    ev.forEach((e) => document.addEventListener(e, go, { once: true, passive: true }));
    return () => ev.forEach((e) => document.removeEventListener(e, go));
  }, [player.blocked, autoStart, player]);

  // Background music pauses while the recitation plays.
  useEffect(() => {
    if (!cfg.pauseMusic) return undefined;
    try { window.dispatchEvent(new CustomEvent('mz-reels-viewer', { detail: { open: player.playing } })); } catch (_) { /* ignore */ }
    return undefined;
  }, [player.playing, cfg.pauseMusic]);
  useEffect(() => () => { if (cfg.pauseMusic) { try { window.dispatchEvent(new CustomEvent('mz-reels-viewer', { detail: { open: false } })); } catch (_) { /* ignore */ } } }, [cfg.pauseMusic]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  const full = cfg.display === 'full';
  return createPortal(
    <div className={`mzq-layer ${full ? 'is-full' : 'is-sheet'}`} role="dialog" aria-modal="true" aria-label={cfg.title}>
      {!full && <button type="button" className="mzq-scrim" aria-label="Close" onClick={onClose} />}
      <QuranStage player={player} style={cfg.style} animation={cfg.animation} size={prefs.size} showArabic={prefs.showArabic} showTranslation={Boolean(prefs.translation)} settings={cfg.allowChoice ? { ...prefs, onChange: change } : null} variant={full ? 'full' : 'sheet'} title={cfg.title} message={cfg.message} onClose={onClose} />
    </div>,
    document.body,
  );
}
