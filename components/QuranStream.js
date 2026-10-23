'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from 'lucide-react';
import { streamTarget } from '@/lib/quran';

// The "ready-made live stream" version of the Quran session: the admin pasted the link of an existing live Quran stream
// (a YouTube live / channel link, or a live audio stream). The same beautiful living background, a LIVE badge, no buttons for the visitor.
// A stream has no ayah timing, so no ayah text is shown (use the normal ayah-by-ayah mode when you want the ayat on the screen).
export default function QuranStream({ cfg, onClose }) {
  const t = streamTarget(cfg.streamUrl);
  const audio = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [on, setOn] = useState(false);

  const start = () => {
    const a = audio.current;
    if (!a) return;
    a.volume = Math.min(1, Math.max(0, cfg.volume / 100));
    const p = a.play();
    if (p && p.then) p.then(() => { setBlocked(false); setOn(true); }).catch((e) => { if (e && e.name === 'NotAllowedError') setBlocked(true); else setFailed(true); });
  };
  useEffect(() => { if (t && t.kind === 'audio') start(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    if (!blocked) return undefined;
    const ev = ['pointerup', 'touchend', 'click', 'keydown'];
    ev.forEach((e) => document.addEventListener(e, start, { once: true, passive: true }));
    return () => ev.forEach((e) => document.removeEventListener(e, start));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);
  useEffect(() => {
    if (!cfg.pauseMusic) return undefined;
    try { window.dispatchEvent(new CustomEvent('mz-reels-viewer', { detail: { open: true } })); } catch (_) { /* ignore */ }
    return () => { try { window.dispatchEvent(new CustomEvent('mz-reels-viewer', { detail: { open: false } })); } catch (_) { /* ignore */ } };
  }, [cfg.pauseMusic]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); const a = audio.current; if (a) { a.pause(); a.removeAttribute('src'); } };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  const full = cfg.display === 'full';
  return createPortal(
    <div className={`mzq-layer ${full ? 'is-full' : 'is-sheet'}`} role="dialog" aria-modal="true" aria-label={cfg.title}>
      {!full && <button type="button" className="mzq-scrim" aria-label="Close" onClick={onClose} />}
      <div className={`mzq mzq-${full ? 'full' : 'sheet'}`} data-style={cfg.style} data-anim={cfg.animation} data-size={cfg.size} data-playing="1" data-radio="1">
        <div className="mzq-bg" aria-hidden="true">
          <i className="mzq-orb o1" /><i className="mzq-orb o2" /><i className="mzq-orb o3" /><i className="mzq-rays" />
          <svg className="mzq-star" viewBox="0 0 200 200"><g fill="none" stroke="currentColor" strokeWidth="1"><rect x="40" y="40" width="120" height="120" /><rect x="40" y="40" width="120" height="120" transform="rotate(45 100 100)" /><circle cx="100" cy="100" r="62" /><circle cx="100" cy="100" r="38" /></g></svg>
          <svg className="mzq-moon" viewBox="0 0 100 100"><path d="M62 10a40 40 0 1 0 28 68A34 34 0 0 1 62 10z" fill="currentColor" /></svg>
          {Array.from({ length: 22 }, (_, n) => <b key={n} className="mzq-twk" style={{ '--x': `${(n * 53 + 11) % 97}%`, '--y': `${(n * 31 + 7) % 62}%`, '--d': `${2.2 + (n % 6) * 0.7}s`, '--w': `${(n * 0.37) % 4}s` }} />)}
          {Array.from({ length: 5 }, (_, n) => <em key={n} className="mzq-lamp" style={{ '--x': `${12 + n * 19}%`, '--d': `${5 + n * 1.3}s`, '--w': `${n * 0.9}s` }} />)}
        </div>
        <header className="mzq-head">
          <div className="min-w-0"><p className="mzq-kicker">{cfg.title}</p><p className="mzq-surah">{cfg.streamTitle || 'Live Quran'}</p></div>
          <button type="button" onClick={onClose} className="mzq-icon" aria-label="Close"><X size={20} /></button>
        </header>
        <main className="mzq-body">
          {!t && <div className="mzq-state">Live stream ka link theek nahi hai. Admin ke Quran page mein dobara check karein.</div>}
          {t && t.kind === 'youtube' && <div className="mzq-stream-frame"><iframe src={t.src} title={cfg.streamTitle || 'Live Quran'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
          {t && t.kind === 'audio' && (
            <>
              <audio ref={audio} src={t.src} preload="none" onError={() => setFailed(true)} onPlaying={() => { setOn(true); setBlocked(false); }} />
              {failed && <div className="mzq-state">Live stream abhi nahi chal rahi. Thori dair baad koshish karein.</div>}
              {!failed && !on && blocked && <button type="button" onClick={start} className="mzq-tap"><Play size={20} /> Live suniye</button>}
              {!failed && !on && !blocked && <div className="mzq-state"><span className="mzq-spin" aria-hidden="true" />Live se jud rahe hain...</div>}
              {on && <div className="mzq-state" style={{ flexDirection: 'column' }}><b style={{ fontSize: '1.4rem', color: 'var(--gold)' }}>{cfg.streamTitle || 'Live Quran'}</b><span>Allah ka kalaam live chal raha hai</span></div>}
            </>
          )}
        </main>
        <footer className="mzq-foot">
          <div className="mzq-live"><span className="mzq-livebadge"><i aria-hidden="true" />LIVE</span><span className="mzq-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span>{cfg.message && <span className="mzq-msg">{cfg.message}</span>}</div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
