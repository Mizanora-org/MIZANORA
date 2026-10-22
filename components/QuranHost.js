'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import QuranStage, { useQuran } from './QuranStage';

// The pop-up / full-screen shell of the Quran session. Loaded only when the session is opened (next/dynamic in QuranSession).
//  * starts the recitation by itself when the admin allowed it (autoStart): at once, or with the visitor's first touch when the
//    browser refuses sound before a touch
//  * the shop's background music steps aside while the recitation plays (same event the reels use)
//  * the page behind does not scroll; Esc closes
export default function QuranHost({ cfg, onClose, autoStart = true }) {
  const player = useQuran({ surah: cfg.surah, from: cfg.from, to: cfg.to, reciter: cfg.reciter, translation: cfg.translation, volume: cfg.volume, continuous: cfg.continuous, loop: cfg.loop });
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
      <QuranStage player={player} style={cfg.style} animation={cfg.animation} size={cfg.size} showArabic={cfg.showArabic} showTranslation={Boolean(cfg.translation)} variant={full ? 'full' : 'sheet'} title={cfg.title} message={cfg.message} onClose={onClose} />
    </div>,
    document.body,
  );
}
