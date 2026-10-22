'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, X } from 'lucide-react';
import { apiUrl, parseSurahResponse, surahInfo, wordShares } from '@/lib/quran';

// ---------------------------------------------------------------------------------------------------------------------
// THE QURAN PLAYER (v23).  Two parts in this file:
//   useQuran()   the engine: loads a surah, plays the verses one after the other and keeps the screen in step with the voice
//   QuranStage   the beautiful screen (animated background, the ayah being recited with its words lighting up, translation)
// Used by the site-wide session (components/QuranSession.js) and by the reader pages (/quran and /quran/<surah>).
//
// HOW THE SYNC WORKS: every ayah is its own audio file. The ayah on the screen is the ayah that is playing; when the file ends the
// next ayah is shown and its file starts, so the text can never run ahead of or behind the voice. Inside an ayah the words light up
// in proportion to their length and the progress of the file (a close approximation, no timing data is needed).
// ---------------------------------------------------------------------------------------------------------------------

async function loadSurah(n, reciter, translation) {
  const q = new URLSearchParams({ s: String(n), r: reciter, t: translation || '' });
  try {
    const r = await fetch(`/api/quran?${q}`);
    const j = await r.json();
    if (j && j.ok && Array.isArray(j.ayahs) && j.ayahs.length) return j;
  } catch (_) { /* try the public API directly */ }
  const tryUrl = async (t) => {
    const r = await fetch(apiUrl(n, reciter, t));
    return parseSurahResponse(await r.json(), { reciter, translation: t });
  };
  try { const d = await tryUrl(translation); if (d) return d; } catch (_) { /* next */ }
  if (translation) { try { const d = await tryUrl(''); if (d) return d; } catch (_) { /* give up */ } }
  return null;
}

export function useQuran({ surah = 1, from = 1, to = 0, reciter = 'ar.alafasy', translation = 'ur.jalandhry', volume = 85, continuous = false, loop = true, initial = null, radio = false }) {
  // RADIO (live session): always surah after surah (114 -> 1), the admin's range is only the very first start, no loop restart.
  if (radio) { continuous = true; loop = false; to = 0; }
  const [cur, setCur] = useState(surah);
  const [data, setData] = useState(initial && initial.surah === surah ? initial : null);
  const [i, setI] = useState(Math.max(0, from - 1));
  const [playing, setPlaying] = useState(false);
  const [state, setState] = useState(initial && initial.surah === surah ? 'ready' : 'loading');
  const [blocked, setBlocked] = useState(false);
  const [prog, setProg] = useState(0);
  const [rate, setRateState] = useState(1);
  const audio = useRef(null);
  const warm = useRef(null);
  const errs = useRef(0);
  const ranged = useRef(true); // the admin's from/to range only applies to the first surah (continuous mode then plays whole surahs)
  const live = useRef({});
  live.current = { cur, data, i, from, to, continuous, loop, volume, rate, playing };

  const el = useCallback(() => {
    if (!audio.current && typeof Audio !== 'undefined') {
      const a = new Audio();
      a.preload = 'auto';
      audio.current = a;
    }
    return audio.current;
  }, []);

  const hiOf = useCallback(() => {
    const L = live.current;
    const n = (L.data && L.data.ayahs.length) || 0;
    return ranged.current && L.cur === surah && L.to ? Math.min(n, L.to) : n;
  }, [surah]);
  const loOf = useCallback(() => (ranged.current && live.current.cur === surah ? Math.max(0, live.current.from - 1) : 0), [surah]);

  const playIndex = useCallback((idx, d) => {
    const a = el();
    const dd = d || live.current.data;
    const ay = dd && dd.ayahs[idx];
    if (!a || !ay) return;
    if (a.dataset.src !== ay.au) { a.src = ay.au; a.dataset.src = ay.au; }
    a.volume = Math.min(1, Math.max(0, live.current.volume / 100));
    a.playbackRate = live.current.rate;
    const p = a.play();
    if (p && p.then) {
      p.then(() => { setPlaying(true); setBlocked(false); errs.current = 0; })
        .catch((e) => { setPlaying(false); if (e && e.name === 'NotAllowedError') setBlocked(true); }); // other failures raise the audio element's own error event
    } else setPlaying(true);
    const nx = dd.ayahs[idx + 1];
    if (nx) { if (!warm.current && typeof Audio !== 'undefined') warm.current = new Audio(); if (warm.current) { warm.current.preload = 'auto'; warm.current.src = nx.au; } }
    try {
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: `${dd.name} ${ay.n}`, artist: 'Mizanora', album: 'Quran' });
    } catch (_) { /* optional */ }
  }, [el]);

  const goTo = useCallback((idx, auto = true) => { setI(idx); setProg(0); if (auto) playIndex(idx); }, [playIndex]);

  const openSurah = useCallback(async (n, auto) => {
    setState('loading'); setCur(n); setProg(0);
    const d = await loadSurah(n, reciter, translation);
    if (!d) { setState('error'); return; }
    setData(d); setI(ranged.current && n === surah ? Math.max(0, from - 1) : 0); setState('ready');
    if (auto) playIndex(ranged.current && n === surah ? Math.max(0, from - 1) : 0, d);
  }, [reciter, translation, surah, from, playIndex]);

  const next = useCallback((auto = true) => {
    const L = live.current;
    if (!L.data) return;
    const hi = hiOf();
    if (L.i + 1 < hi) { goTo(L.i + 1, auto); return; }
    if (L.continuous) { ranged.current = false; openSurah((L.cur % 114) + 1, auto); return; }
    if (L.loop) { goTo(loOf(), auto); return; }
    setPlaying(false); setProg(0);
  }, [goTo, hiOf, loOf, openSurah]);

  const prev = useCallback(() => {
    const L = live.current;
    if (!L.data) return;
    const a = el();
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    goTo(Math.max(loOf(), L.i - 1), Boolean(L.playing));
  }, [el, goTo, loOf]);

  const pause = useCallback(() => { const a = el(); if (a) a.pause(); setPlaying(false); }, [el]);
  const play = useCallback(() => { if (live.current.data) playIndex(live.current.i); }, [playIndex]);
  const toggle = useCallback(() => { const a = el(); if (a && !a.paused && !a.ended) pause(); else play(); }, [el, pause, play]);
  const setRate = useCallback((r) => { setRateState(r); const a = el(); if (a) a.playbackRate = r; }, [el]);

  // First load, and a new load whenever the surah / reciter / translation setting changes.
  useEffect(() => {
    ranged.current = true;
    let dead = false;
    if (initial && initial.surah === surah && !translation === !(initial.ayahs[0] && initial.ayahs[0].tr)) { setData(initial); setCur(surah); setI(Math.max(0, from - 1)); setState('ready'); return undefined; }
    setState('loading');
    loadSurah(surah, reciter, translation).then((d) => { if (dead) return; if (!d) { setState('error'); return; } setData(d); setCur(surah); setI(Math.max(0, from - 1)); setState('ready'); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, reciter, translation, from]);

  // Audio events: next ayah when one ends; skip a file that cannot be played; keep the volume in step with the setting.
  useEffect(() => {
    const a = el();
    if (!a) return undefined;
    const ended = () => next(true);
    const failed = () => {
      errs.current += 1;
      if (errs.current >= 3) { setPlaying(false); setState('error'); return; }
      setTimeout(() => next(true), 300);
    };
    const onPause = () => { if (a.ended) return; setPlaying(false); };
    const onPlay = () => setPlaying(true);
    a.addEventListener('ended', ended); a.addEventListener('error', failed); a.addEventListener('pause', onPause); a.addEventListener('play', onPlay);
    return () => { a.removeEventListener('ended', ended); a.removeEventListener('error', failed); a.removeEventListener('pause', onPause); a.removeEventListener('play', onPlay); };
  }, [el, next]);
  useEffect(() => { const a = el(); if (a) a.volume = Math.min(1, Math.max(0, volume / 100)); }, [volume, el]);

  // Progress of the ayah being recited (about 14 times a second while playing).
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0; let last = 0;
    const tick = (t) => {
      const a = audio.current;
      if (a && a.duration > 0 && t - last > 70) { last = t; setProg(Math.min(1, a.currentTime / a.duration)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Lock-screen / headset buttons.
  useEffect(() => {
    try {
      if (!('mediaSession' in navigator)) return undefined;
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('nexttrack', radio ? null : () => next(true));
      navigator.mediaSession.setActionHandler('previoustrack', radio ? null : () => prev());
    } catch (_) { /* not supported */ }
    return undefined;
  }, [play, pause, next, prev, radio]);

  useEffect(() => () => { const a = audio.current; if (a) { a.pause(); a.removeAttribute('src'); } }, []);

  const ayah = data && data.ayahs[i] ? data.ayahs[i] : null;
  return { radio, state, data, i, ayah, playing, blocked, prog, rate, setRate, play, pause, toggle, next: () => next(true), prev, goTo, cur, lo: loOf(), hi: hiOf() };
}

// ---------------------------------------------------------------------------------------------------------------------
export default function QuranStage({ player, style = 'emerald', animation = 'glow', size = 'm', showArabic = true, showTranslation = true, variant = 'page', title = 'Tilawat-e-Quran', onClose = null, message = '' }) {
  const { radio, state, data, ayah, i, playing, blocked, prog, toggle, next, prev, rate, setRate, lo, hi } = player;
  const stageRef = useRef(null);
  const [full, setFull] = useState(false);
  const words = useMemo(() => (ayah ? wordShares(ayah.ar) : []), [ayah]);
  const active = playing ? words.reduce((k, w, n) => (prog >= w.start - 0.02 ? n : k), -1) : -1;
  const overall = data && hi > lo ? Math.min(1, ((i - (radio ? 0 : lo)) + prog) / (hi - (radio ? 0 : lo))) : 0;
  const info = data ? surahInfo(data.surah) : null;

  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    const e = stageRef.current;
    try { if (document.fullscreenElement) document.exitFullscreen(); else if (e && e.requestFullscreen) e.requestFullscreen(); } catch (_) { /* not allowed */ }
  };

  return (
    <div ref={stageRef} className={`mzq mzq-${variant}`} data-style={style} data-anim={animation} data-size={size} data-playing={playing ? '1' : '0'} data-radio={radio ? '1' : '0'}>
      <div className="mzq-bg" aria-hidden="true">
        <i className="mzq-orb o1" /><i className="mzq-orb o2" /><i className="mzq-orb o3" />
        <i className="mzq-rays" />
        <svg className="mzq-star" viewBox="0 0 200 200"><g fill="none" stroke="currentColor" strokeWidth="1"><rect x="40" y="40" width="120" height="120" /><rect x="40" y="40" width="120" height="120" transform="rotate(45 100 100)" /><circle cx="100" cy="100" r="62" /><circle cx="100" cy="100" r="38" /></g></svg>
        <svg className="mzq-star mzq-star2" viewBox="0 0 200 200"><g fill="none" stroke="currentColor" strokeWidth=".8"><polygon points="100,12 120,80 188,100 120,120 100,188 80,120 12,100 80,80" /><circle cx="100" cy="100" r="88" /><circle cx="100" cy="100" r="50" strokeDasharray="3 5" /></g></svg>
        <svg className="mzq-moon" viewBox="0 0 100 100"><path d="M62 10a40 40 0 1 0 28 68A34 34 0 0 1 62 10z" fill="currentColor" /></svg>
        {Array.from({ length: 22 }, (_, n) => <b key={n} className="mzq-twk" style={{ '--x': `${(n * 53 + 11) % 97}%`, '--y': `${(n * 31 + 7) % 62}%`, '--d': `${2.2 + (n % 6) * 0.7}s`, '--w': `${(n * 0.37) % 4}s` }} />)}
        {Array.from({ length: 14 }, (_, n) => <span key={n} className="mzq-dot" style={{ '--x': `${(n * 37 + 8) % 100}%`, '--d': `${6 + (n % 5) * 2.2}s`, '--s': `${2 + (n % 3)}px`, '--w': `${(n * 0.7) % 6}s` }} />)}
        {Array.from({ length: 5 }, (_, n) => <em key={n} className="mzq-lamp" style={{ '--x': `${12 + n * 19}%`, '--d': `${5 + n * 1.3}s`, '--w': `${n * 0.9}s` }} />)}
        <svg className="mzq-city" viewBox="0 0 400 90" preserveAspectRatio="none"><path fill="currentColor" d="M0 90V70h18V48l4-10 4 10v22h14V62q14-30 28 0v8h16V30l3-12 3 12v40h16V58q22-40 44 0v12h20V40l3-16 3 16v30h14V64q18-34 36 0v6h18V46l4-12 4 12v24h16V60q26-44 52 0v10h20V36l3-14 3 14v34h18V90z" /></svg>
      </div>

      <header className="mzq-head">
        <div className="min-w-0">
          <p className="mzq-kicker">{title}</p>
          <p className="mzq-surah">{data ? `${info.n}. ${data.name}` : 'Quran'}{data && ayah ? <span> · Ayah {ayah.n} / {data.ayahs.length}</span> : null}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={toggleFull} className="mzq-icon" aria-label={full ? 'Exit full screen' : 'Full screen'}>{full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          {onClose && <button type="button" onClick={onClose} className="mzq-icon" aria-label="Close"><X size={20} /></button>}
        </div>
      </header>

      <main className="mzq-body" aria-live="polite">
        {state === 'loading' && <div className="mzq-state"><span className="mzq-spin" aria-hidden="true" />Quran load ho raha hai...</div>}
        {state === 'error' && <div className="mzq-state">Quran abhi load nahi ho saka (internet ya service). Thori dair baad dobara koshish karein.</div>}
        {state === 'ready' && ayah && (
          <div key={`${data.surah}-${ayah.n}`} className="mzq-ayah">
            {ayah.bism && showArabic && <p lang="ar" dir="rtl" className="mzq-bism">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>}
            {showArabic && (
              <p lang="ar" dir="rtl" className="mzq-ar">
                {words.map((w, n) => <span key={n} className={`mzq-w ${active < 0 ? '' : n < active ? 'is-past' : n === active ? 'is-now' : 'is-next'}`}>{w.word}{' '}</span>)}
                <span className="mzq-end" aria-hidden="true">﴿{ayah.n}﴾</span>
              </p>
            )}
            {showTranslation && ayah.tr && <p className="mzq-tr" lang={/[؀-ۿ]/.test(ayah.tr) ? 'ur' : 'en'} dir={/[؀-ۿ]/.test(ayah.tr) ? 'rtl' : 'ltr'}>{ayah.tr}</p>}
          </div>
        )}
        {blocked && state === 'ready' && (
          <button type="button" onClick={toggle} className="mzq-tap"><Play size={20} /> Sunne ke liye tap karein</button>
        )}
      </main>

      <footer className="mzq-foot">
        <div className="mzq-bar" aria-hidden="true"><i style={{ width: `${overall * 100}%` }} /></div>
        {radio ? (
          <div className="mzq-live">
            <span className="mzq-livebadge"><i aria-hidden="true" />LIVE</span>
            <span className="mzq-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            {message && <span className="mzq-msg">{message}</span>}
          </div>
        ) : (
          <>
            <div className="mzq-ctl">
              <button type="button" onClick={prev} className="mzq-icon" aria-label="Previous ayah"><ChevronLeft size={22} /></button>
              <button type="button" onClick={toggle} className="mzq-play" aria-label={playing ? 'Pause' : 'Play'} disabled={state !== 'ready'}>
                <span className="mzq-ring" aria-hidden="true" style={{ '--p': `${prog * 360}deg` }} />
                {playing ? <Pause size={26} /> : <Play size={26} />}
              </button>
              <button type="button" onClick={next} className="mzq-icon" aria-label="Next ayah"><ChevronRight size={22} /></button>
            </div>
            <div className="mzq-meta">
              <span className="mzq-eq" aria-hidden="true"><i /><i /><i /><i /></span>
              <button type="button" className="mzq-chip" onClick={() => setRate(rate >= 1.25 ? 0.85 : rate >= 1 ? 1.25 : 1)} aria-label="Speed">{rate}x</button>
              {message && <span className="mzq-msg">{message}</span>}
            </div>
          </>
        )}
        <p className="mzq-credit">Text: Tanzil (Uthmani) · Recitation and translations: AlQuran Cloud / Islamic Network</p>
      </footer>
    </div>
  );
}
