'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clock3, Copy, Pause, Play, Share2, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import { AYAH_SEC, channelStatus, segmentAt, segmentsFrom, pktClock, tickerLines, cleanChannel } from '@/lib/liveChannel';
import { describeWindows, wordShares } from '@/lib/quran';
import { hijriNow } from '@/lib/hijri';

// THE LIVE CHANNEL SCREEN (v27). A TV channel inside the shop:
//   * top bar like a real channel: shimmering MIZANORA logo, LIVE pill, and a ticking PAKISTAN clock (Asia/Karachi)
//   * the stage: live Quran tilawat with word glow, a hadith reading, or a product ad (image + AI voiceover)
//   * under it the lower-third bar with the progress of the current part, an EPG strip (Now / Next / Later) and a ticker
// The PROGRAM POSITION IS COMPUTED FROM THE WALL CLOCK (lib/liveChannel.js), so every visitor sees the same ayah at the
// same second - it is a broadcast, not a playlist. The server answer (/api/live/channel) is only needed for the text of
// the hadith and the product details, so a poll every 20 seconds is plenty.

export default function LiveChannel() {
  const [state, setState] = useState(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [surahs, setSurahs] = useState({}); // surah -> { name, ayahs:[{ n, ar, tr }] }
  const [copied, setCopied] = useState(false);
  const audio = useRef(null);
  const warm = useRef(null);  // v29: a silent second player that downloads the NEXT ayah while this one is playing (no gap between ayat)
  const spoken = useRef(0); // the startMs of the last part we spoke with the browser voice (never speak it twice)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/live/channel');
      const j = await r.json();
      if (j && j.ok) { setState(j); setErr(''); }
      else setErr(j && j.error ? j.error : 'Channel ka data nahi mil raha.');
    } catch (e) {
      setErr('Internet ya server abhi jawab nahi de raha. Thori dair baad dobara koshish karein.');
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cfg = state && state.cfg ? state.cfg : null;
  const ch = (state && state.channel) || { title: 'Mizanora Quran & Hadith Live', slogan: '', theme: 'emerald', showClock: true, ticker: [] };
  const status = useMemo(() => (cfg ? channelStatus(cfg, now) : { onAir: false, why: 'loading' }), [cfg, now]);
  const seg = useMemo(() => (cfg ? segmentAt(cfg, now) : null), [cfg, now]);
  const upcoming = useMemo(() => (cfg ? segmentsFrom(cfg, seg ? seg.endMs : now, 2) : []), [cfg, seg, now]);
  const clock = pktClock(now);
  const hijri = hijriNow(new Date(now));
  const onAir = status.onAir;

  // The ayah being recited RIGHT NOW inside the tilawat block (the wall clock is the shared pointer).
  const ayahIdx = seg && seg.kind === 'quran' ? Math.min(seg.ayat.length - 1, Math.max(0, Math.floor(((now - seg.startMs) / 1000) / AYAH_SEC))) : 0;
  const ayah = seg && seg.kind === 'quran' ? seg.ayat[ayahIdx] : null;

  // Arabic + translation of the surah on screen (the text API is cached for a day by the CDN).
  useEffect(() => {
    if (!seg || seg.kind !== 'quran' || surahs[seg.surah]) return;
    let live = true;
    fetch(`/api/quran?s=${seg.surah}&t=${seg.translation || ''}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live || !j || !j.ok || !Array.isArray(j.ayahs)) return;
        setSurahs((m) => ({ ...m, [seg.surah]: { name: j.name || seg.surahName, ayahs: j.ayahs.map((a) => ({ n: a.n, ar: a.ar, bism: a.bism, tr: a.tr })) } }));
      })
      .catch(() => { /* the voice keeps playing even without the text */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg && seg.surah, seg && seg.translation]);

  // ---- sound: the ayah files one after another (joined at the wall-clock position), the voiceovers whole ----
  const ayahSrc = ayah ? ayah.au : '';
  useEffect(() => {
    const a = audio.current;
    if (!a || !started || !onAir || !seg) return;
    if (seg.kind === 'quran') {
      const skip = Math.max(0, (now - seg.startMs) / 1000 - ayahIdx * AYAH_SEC);
      if (a.dataset.src !== ayahSrc) {
        a.dataset.src = ayahSrc;
        a.src = ayahSrc;
        a.onloadedmetadata = () => { try { a.currentTime = Math.min(skip, Math.max(0, (a.duration || AYAH_SEC) - 0.3)); } catch (_) { /* ignore */ } };
        // v29: one automatic retry if the audio file did not load (a blip must not leave the channel silent for 8 seconds)
        let retried = false;
        a.onerror = () => { if (retried) return; retried = true; setTimeout(() => { try { a.src = ayahSrc; a.play().catch(() => { /* ignore */ }); } catch (_) { /* ignore */ } }, 800); };
        a.play().catch(() => { /* the gate already asked the browser for sound */ });
      }
      return;
    }
    // hadith / ad: the stored AI voiceover, or the visitor's own browser voice as a live fallback
    const voice = state && state.current && state.current.startMs === seg.startMs ? state.current.voiceUrl : '';
    if (voice) {
      if (a.dataset.src !== voice) {
        a.dataset.src = voice;
        a.src = voice;
        a.onloadedmetadata = null;
        a.play().catch(() => { /* ignore */ });
      }
      return;
    }
    a.pause();
    if (spoken.current === seg.startMs || muted) return;
    spoken.current = seg.startMs;
    try {
      const text = seg.kind === 'hadith'
        ? (state && state.current && state.current.startMs === seg.startMs && state.current.text) || `Hadees: ${seg.book}, riwayat number ${seg.section}.`
        : `Mizanora Market se ${(state && state.ads && state.ads.find((x) => x.slug === seg.slug) && state.ads.find((x) => x.slug === seg.slug).name) || 'hamari khaas product'} — abhi order karein.`;
      const u = new SpeechSynthesisUtterance(text.slice(0, 420));
      u.rate = 1; u.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (_) { /* no speech synthesis: the channel stays visual */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, onAir, seg && seg.startMs, ayahIdx, ayahSrc, muted, state]);

  // v29: warm up the next ayah so it starts instantly when the clock moves on.
  const nextAu = seg && seg.kind === 'quran' && seg.ayat[ayahIdx + 1] ? seg.ayat[ayahIdx + 1].au : '';
  useEffect(() => {
    if (!started || !onAir || !nextAu || typeof Audio === 'undefined') return;
    if (!warm.current) { warm.current = new Audio(); warm.current.preload = 'auto'; warm.current.muted = true; }
    if (warm.current.dataset.src !== nextAu) { warm.current.dataset.src = nextAu; warm.current.src = nextAu; try { warm.current.load(); } catch (_) { /* ignore */ } }
  }, [started, onAir, nextAu]);
  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch (_) { /* ignore */ } if (warm.current) { warm.current.removeAttribute('src'); warm.current = null; } }, []);
  useEffect(() => {
    const a = audio.current;
    if (a) { a.volume = 0.9; a.muted = muted; }
    if (muted) { try { window.speechSynthesis.cancel(); } catch (_) { /* ignore */ } }
  }, [muted]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (!started) { a.pause(); try { window.speechSynthesis.cancel(); } catch (_) { /* ignore */ } }
    else if (a.src) a.play().catch(() => { /* ignore */ });
  }, [started]);

  const goLive = () => {
    setStarted(true);
    const a = audio.current;
    if (a && a.src) a.play().catch(() => { /* ignore */ });
  };

  // ---- pieces of the screen -------------------------------------------------------------------------------------
  const segVoice = state && seg && state.current && state.current.startMs === seg.startMs ? state.current.voiceUrl : '';
  const ad = seg && seg.kind === 'ad' && state ? (state.ads || []).find((x) => x.slug === seg.slug) : null;
  const text = surahs[seg && seg.surah] ? surahs[seg.surah].ayahs.find((x) => x.n === (ayah && ayah.ayah)) : null;
  const words = text ? wordShares(text.ar) : [];
  const inAyah = ayah ? Math.min(1, Math.max(0, ((now - seg.startMs) / 1000 - ayahIdx * AYAH_SEC) / AYAH_SEC)) : 0;

  const label = (s) => {
    if (!s) return '';
    if (s.kind === 'quran') return `Tilawat: ${s.surahName} ${s.surah}:${s.ayat[0].ayah}`;
    if (s.kind === 'hadith') return `Hadees: ${s.book} #${s.section}`;
    const p = state && (state.ads || []).find((x) => x.slug === s.slug);
    return `Ad: ${(p && p.name) || s.slug}`;
  };

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://mizanora.com/live-channel';
    try {
      if (navigator.share) { await navigator.share({ title: ch.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* ignore */ }
  };

  return (
    <div className="mzc" data-theme={ch.theme} data-playing={started && onAir && !muted ? '1' : '0'}>
      <div className="mzc-bg" aria-hidden="true">
        <i className="mzc-orb o1" style={{ width: 380, height: 380, left: '-6%', top: '6%', animationDelay: '0s' }} />
        <i className="mzc-orb o2" style={{ width: 300, height: 300, right: '-4%', top: '30%', animationDelay: '2.5s' }} />
        <i className="mzc-orb o3" style={{ width: 240, height: 240, left: '30%', bottom: '-6%', animationDelay: '4.5s' }} />
        <svg className="mzc-star" viewBox="0 0 200 200">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="40" y="40" width="120" height="120" /><rect x="40" y="40" width="120" height="120" transform="rotate(45 100 100)" />
            <circle cx="100" cy="100" r="62" /><circle cx="100" cy="100" r="38" />
          </g>
        </svg>
        {Array.from({ length: 22 }, (_, n) => (
          <b key={n} className="mzc-twk" style={{ '--x': `${(n * 53 + 11) % 97}%`, '--y': `${(n * 31 + 7) % 88}%`, '--d': `${2.4 + (n % 6) * 0.8}s`, '--w': `${(n * 0.41) % 4}s` }} />
        ))}
        {Array.from({ length: 5 }, (_, n) => <em key={n} className="mzc-lamp" style={{ '--x': `${10 + n * 20}%`, '--w': `${n * 1.1}s` }} />)}
      </div>

      <header className="mzc-top">
        <div className="mzc-brand">
          <div className="mzc-logo" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <path d="M62 10a40 40 0 1 0 28 68A34 34 0 0 1 62 10z" fill="currentColor" />
              <path d="M78 20l3.4 8 8.6.8-6.5 5.7 2 8.5-7.5-4.5-7.5 4.5 2-8.5-6.5-5.7 8.6-.8z" fill="currentColor" />
            </svg>
          </div>
          <div className="mzc-name">MIZANORA<small>QURAN &amp; HADITH CHANNEL</small></div>
          <span className={`mzc-live ${onAir ? '' : 'is-off'}`}><i aria-hidden="true" />{onAir ? 'LIVE' : 'OFF AIR'}</span>
        </div>
        {ch.showClock && (
          <div className="mzc-clock" aria-label="Pakistan time">
            <b suppressHydrationWarning>{clock.time}</b>
            <small>{clock.day} · {clock.date} · {clock.tz}</small>
            {hijri && <em>{hijri.text} (taqreeban)</em>}
          </div>
        )}
        <button type="button" onClick={() => setMuted((m) => !m)} className="mzc-slot" style={{ padding: '8px 10px', cursor: 'pointer', border: 0 }} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      <section className="mzc-stage" aria-label="Live broadcast stage">
        <section className="mzc-screen">
          <div className="mzc-body">
            {err && !state && (
              <div className="mzc-off">
                <h2>Channel load nahi ho raha</h2>
                <p>{err}</p>
                <button type="button" onClick={load} className="mzc-cta"><span className="go">Dobara koshish karein</span></button>
              </div>
            )}

            {state && !onAir && (
              <div className="mzc-off">
                <div className="mzc-kicker">OFF AIR</div>
                <h2>{ch.title}</h2>
                <p>
                  Channel abhi band hai.
                  {cfg && cfg.mode === 'schedule' ? ` Pakistan time ke mutabiq agla program: ${describeWindows(cleanChannel(cfg).windows)}.` : ''}
                  {' '}Jaise hi program shuru hoga yehi screen live ho jayegi.
                </p>
                <div className="mzc-cta" style={{ justifyContent: 'center' }}>
                  <Link href="/quran" className="go"><BookOpen size={17} /> Quran parhne ke liye</Link>
                  <Link href="/islamic" className="ghost">Islamic reminders</Link>
                </div>
              </div>
            )}

            {state && onAir && seg && (
              seg.kind === 'quran' ? (
                <div className="mzc-card" key={`q-${seg.startMs}-${ayahIdx}`}>
                  <div className="mzc-kicker">LIVE TILAWAT-E-QURAN</div>
                  <h2 className="mzc-title">{seg.surahName} · {seg.surah}:{ayah ? ayah.ayah : 1}</h2>
                  {text && text.bism && <p className="mzc-ar" style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>}
                  {text && (
                    <p lang="ar" dir="rtl" className="mzc-ar">
                      {words.map((w, i) => (
                        <span key={i} className={`mzc-w ${inAyah >= w.start && (words[i + 1] ? inAyah < words[i + 1].start : true) ? 'is-now' : inAyah >= w.start ? 'is-past' : ''}`}>{w.word}{' '}</span>
                      ))}
                    </p>
                  )}
                  {!text && <p className="mzc-tr">Tilawat live chal rahi hai — Arabic text load ho raha hai…</p>}
                  {text && text.tr && <p className="mzc-tr" lang={seg.translation && seg.translation.startsWith('ur') ? 'ur' : 'en'}>{text.tr}</p>}
                  <p style={{ marginTop: 14 }}><span className="mzc-chip">Reciter: {seg.reciter.replace('ar.', '')}</span></p>
                </div>
              ) : seg.kind === 'hadith' ? (
                <div className="mzc-card mzc-hadith" key={`h-${seg.startMs}`}>
                  <div className="mzc-kicker">LIVE HADEES</div>
                  <h2 className="mzc-title">{(state.current && state.current.startMs === seg.startMs && state.current.title) || 'Hadith ki tilawat'}</h2>
                  <div className="mzc-quote">
                    <p>
                      {(state.current && state.current.startMs === seg.startMs && state.current.text) || 'Hadith ka text load ho raha hai…'}
                    </p>
                    <p className="by">
                      {seg.book} · riwayat #{seg.section}
                      {state.current && state.current.startMs === seg.startMs && state.current.grades && state.current.grades[0] ? ` · ${state.current.grades[0].grade}` : ''}
                    </p>
                  </div>
                  <p style={{ marginTop: 14 }}><span className="mzc-chip"><BookOpen size={13} /> {seg.lang === 'urd' ? 'Urdu tarjuma' : seg.lang === 'eng' ? 'English' : 'Arabic'}</span></p>
                </div>
              ) : (
                <div className="mzc-card mzc-ad" key={`a-${seg.startMs}`}>
                  <div className="mzc-ad-photo">
                    {ad && ad.image ? <img src={ad.image} alt={ad.name || 'Mizanora product'} /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', opacity: 0.6 }}><ShoppingBag size={42} /></div>}
                    <span className="mzc-ad-tag">MIZANORA AD</span>
                  </div>
                  <div>
                    <div className="mzc-kicker">SPECIAL OFFER</div>
                    <h2 className="mzc-title">{ad ? ad.name : 'Mizanora ki khaas product'}</h2>
                    {ad && (
                      <div className="mzc-price">
                        <b>Rs {Number(ad.price || 0).toLocaleString('en-PK')}</b>
                        {ad.comparePrice ? <s>Rs {Number(ad.comparePrice).toLocaleString('en-PK')}</s> : null}
                      </div>
                    )}
                    <p className="mzc-tr" style={{ marginLeft: 0 }}>
                      {segVoice ? 'AI voiceover live chal raha hai — product ki tafseel suniye.' : 'Mizanora Market — halal, behtareen aur munasib qeemat.'}
                    </p>
                    <div className="mzc-cta">
                      {ad && <Link href={`/product/${ad.slug}`} className="go"><ShoppingBag size={17} /> Product dekhein</Link>}
                      <Link href="/products" className="ghost">Saari products</Link>
                    </div>
                  </div>
                </div>
              )
            )}

            {state && onAir && !started && (
              <div role="button" tabIndex={0} className="mzc-gate" onClick={goLive} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goLive(); }}>
                <span className="ring" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <h2>{ch.title}</h2>
                <p>{ch.slogan || 'Live Quran ki tilawat, ahadees aur Mizanora products — Pakistan time ke sath.'}</p>
                <p><b>Tap karke live channel shuru karein</b> (awaaz ke liye ek baar tap zaroori hai)</p>
              </div>
            )}
          </div>

          <div className="mzc-prog"><i style={{ width: `${Math.round((seg ? ((now - seg.startMs) / (seg.endMs - seg.startMs)) : 0) * 100)}%` }} /></div>
          <footer className="mzc-lower">
            <span className="lab">{seg ? (seg.kind === 'quran' ? 'TILAWAT' : seg.kind === 'hadith' ? 'HADEES' : 'AD BREAK') : '...'}</span>
            <span className="txt">{seg ? label(seg) : 'Loading...'}</span>
            <span className={`mzc-eq ${started && !muted && onAir ? '' : 'is-still'}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
          </footer>
        </section>
      </section>

      <section className="mzc-epg" aria-label="Program schedule">
        <div className="mzc-slot" data-now="1">
          <div className="when">NOW · {seg ? pktClock(seg.startMs).hm : '--:--'}</div>
          <div className="what">{seg ? label(seg) : '...'}</div>
          <div className="sub">{seg ? `${Math.max(1, Math.round((seg.endMs - now) / 60000))} minute baqi` : ''}</div>
        </div>
        {upcoming.map((s, i) => (
          <div className="mzc-slot" key={s.startMs} style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
            <div className="when">{i === 0 ? 'NEXT' : 'LATER'} · {pktClock(s.startMs).hm}</div>
            <div className="what">{label(s)}</div>
            <div className="sub">{s.sec ? `${Math.round(s.sec / 60)} minute` : ''}</div>
          </div>
        ))}
      </section>

      <div className="mzc-ticker mq" aria-hidden="true">
        <div className="mq-track">
          {[0, 1].map((k) => (
            <span key={k}>
              {(ch.ticker && ch.ticker.length ? ch.ticker : tickerLines(cfg)).map((line, i) => (
                <span key={i}><b>◈</b> {line}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '0 14px 26px', flexWrap: 'wrap' }}>
        <button type="button" onClick={started ? () => setStarted(false) : goLive} className="mzc-cta">
          <span className="go">{started ? <><Pause size={16} /> Band karein</> : <><Play size={16} /> Channel shuru karein</>}</span>
        </button>
        <button type="button" onClick={share} className="mzc-cta">
          <span className="ghost">{copied ? <><Copy size={16} /> Link copy ho gaya</> : <><Share2 size={16} /> Share channel</>}</span>
        </button>
        <Link href="/products" className="mzc-cta"><span className="ghost"><ShoppingBag size={16} /> Shopping karein</span></Link>
      </div>

      <audio ref={audio} preload="auto" muted={muted} />
      <p style={{ textAlign: 'center', fontSize: '.66rem', opacity: 0.55, padding: '0 14px 20px' }}>
        <Clock3 size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> Pakistan Standard Time (UTC+5) — {clock.time} · Mizanora Live Channel
      </p>
    </div>
  );
}
