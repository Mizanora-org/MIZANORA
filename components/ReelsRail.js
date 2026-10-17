'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Flame, Heart, Music, Pause, Play, Share2, ShoppingBag, Shuffle, Volume2, VolumeX, X } from 'lucide-react';
import { parseVideo } from '@/lib/video';
import { formatPKR } from '@/lib/format';

const LIKE_KEY = 'mz_reel_likes';
const MUSIC_KEY = 'mz_reel_music';
const readLikes = () => { try { return JSON.parse(localStorage.getItem(LIKE_KEY) || '[]'); } catch { return []; } };

// Fisher-Yates shuffle: every reel gets an equal chance to come first.
export function shuffleReels(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Does the reel's own video carry sound? Only a plain video file (.mp4) can be checked; YouTube / Facebook / Instagram / TikTok
// embeds are treated as "has sound" (so the Mizanora music never fights with a real soundtrack).
// Returns 'audio' | 'silent' | null (not known yet).
function probeVideo(el) {
  if (!el) return null;
  if (typeof el.mozHasAudio === 'boolean') return el.mozHasAudio ? 'audio' : 'silent';
  if (typeof el.webkitAudioDecodedByteCount === 'number') {
    if (el.webkitAudioDecodedByteCount > 0) return 'audio';
    return el.currentTime > 1.5 ? 'silent' : null;
  }
  if (el.audioTracks && typeof el.audioTracks.length === 'number' && el.readyState >= 1) return el.audioTracks.length ? 'audio' : 'silent';
  return el.currentTime > 1.5 ? 'audio' : null; // browser cannot tell: assume sound, so the music stays quiet
}

// ---------------------------------------------------------------------------------------------
// Poster: the picture shown for a reel before it plays (video thumbnail, else the product photo, else brand colours)
// ---------------------------------------------------------------------------------------------
function Poster({ reel, v, sizes = '240px', priority = false, className = '' }) {
  const src = v.thumb || reel.image;
  return src
    ? <Image src={src} alt="" fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />
    : <span className={`absolute inset-0 bg-gradient-to-br from-gold via-[#0A5A3A] to-[#06301F] ${className}`} />;
}

// ---------------------------------------------------------------------------------------------
// Full-screen, swipe-up feed (like Instagram / TikTok). Only the reel you are watching is loaded.
// Mizanora music: plays behind reels that have NO sound, and stays silent on reels that have their own sound.
// ---------------------------------------------------------------------------------------------
function Viewer({ reels, start, onClose, music }) {
  const [deck, setDeck] = useState(reels);          // this viewer's own order (the Shuffle button mixes it)
  const [active, setActive] = useState(start);
  const [muted, setMuted] = useState(false);        // sound on when the reel was opened by a tap; the browser may force mute (see effect)
  const [paused, setPaused] = useState(false);
  const [likes, setLikes] = useState([]);
  const [toast, setToast] = useState('');
  const [probe, setProbe] = useState({});           // reel id -> 'audio' | 'silent'
  const [brandOn, setBrandOn] = useState(true);
  const [brandPlaying, setBrandPlaying] = useState(false);
  const scroller = useRef(null);
  const slides = useRef([]);
  const media = useRef(null);                       // the live <iframe> or <video> of the active reel
  const bg = useRef(null);                          // the Mizanora music (one audio element for the whole viewer)
  const wantBg = useRef(false);

  const r = deck[active] || deck[0];
  const v = parseVideo(r.url);
  const sound = probe[r.id] || (v.type === 'file' ? 'pending' : 'audio');
  const musicWanted = Boolean(music && music.url) && brandOn && sound === 'silent';
  wantBg.current = musicWanted;

  useEffect(() => { setLikes(readLikes()); try { setBrandOn(localStorage.getItem(MUSIC_KEY) !== '0'); } catch (_) { /* ignore */ } }, []);

  // Lock the page behind, open on the tapped reel, close with Esc, move with the arrow keys.
  const goTo = useCallback((i) => {
    const n = Math.min(deck.length - 1, Math.max(0, i));
    const el = slides.current[n];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [deck.length]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = slides.current[start];
    if (first) first.scrollIntoView({ block: 'start' });
    return () => { document.body.style.overflow = prev; };
  }, [start]);
  // The reels have their own music: tell the app background music to step aside while a reel is open
  // (and to come back when the reel is closed).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mz-reels-viewer', { detail: { open: true } }));
    return () => window.dispatchEvent(new CustomEvent('mz-reels-viewer', { detail: { open: false } }));
  }, []);
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); goTo(active + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); goTo(active - 1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, goTo, onClose]);

  // Which reel is on screen?
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setActive(Number(e.target.dataset.i)); setPaused(false); } });
    }, { root: scroller.current, threshold: 0.65 });
    slides.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [deck.length]);

  // Shuffle inside the viewer: a new random order, starting from the first reel.
  const reshuffle = () => {
    setDeck(shuffleReels(reels));
    setActive(0);
    setTimeout(() => { if (scroller.current) scroller.current.scrollTo({ top: 0, behavior: 'smooth' }); }, 60);
    setToast('Naye random reels');
    setTimeout(() => setToast(''), 1600);
  };

  // ---- Reel sound: the browser may refuse sound without a tap; then the reel plays muted instead of stopping.
  useEffect(() => {
    const el = media.current;
    if (!el || v.type !== 'file') return;
    el.muted = muted;
    const p = el.play && el.play();
    if (p && p.catch) p.catch(() => { if (!el.muted) { el.muted = true; setMuted(true); el.play().catch(() => {}); } });
  }, [active, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Mizanora music element (created once, source changes when the admin changes the link).
  useEffect(() => {
    if (!music || !music.url || typeof Audio === 'undefined') return undefined;
    if (!bg.current) { bg.current = new Audio(); bg.current.loop = true; bg.current.preload = 'auto'; }
    const a = bg.current;
    if (a.getAttribute('data-src') !== music.url) { a.setAttribute('data-src', music.url); a.src = music.url; }
    a.volume = Math.min(1, Math.max(0, music.volume || 0));
    a.onplaying = () => setBrandPlaying(true);
    a.onpause = () => setBrandPlaying(false);
    return () => { a.pause(); };
  }, [music]);
  useEffect(() => {
    const a = bg.current;
    if (!a || !music || !music.url) return;
    if (musicWanted) { const p = a.play(); if (p && p.catch) p.catch(() => { /* blocked until the first tap: see below */ }); }
    else a.pause();
  }, [musicWanted]); // eslint-disable-line react-hooks/exhaustive-deps
  // Browsers block music that starts without a tap: the first tap anywhere starts it.
  useEffect(() => {
    const unlock = () => { const a = bg.current; if (a && a.paused && wantBg.current) a.play().catch(() => {}); };
    document.addEventListener('pointerdown', unlock, { passive: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);
  useEffect(() => () => { if (bg.current) bg.current.pause(); }, []);

  const onVideoTime = (e) => {
    if (probe[r.id]) return;
    const s = probeVideo(e.currentTarget);
    if (s) setProbe((p) => ({ ...p, [r.id]: s }));
  };
  const toggleBrand = () => {
    const n = !brandOn;
    setBrandOn(n);
    try { localStorage.setItem(MUSIC_KEY, n ? '1' : '0'); } catch (_) { /* ignore */ }
    setToast(n ? 'Mizanora music on' : 'Mizanora music off');
    setTimeout(() => setToast(''), 1400);
  };

  // Sound / pause for YouTube (iframe API) and for direct video files.
  const yt = (func) => { try { media.current && media.current.contentWindow && media.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'); } catch (_) {} };
  useEffect(() => { if (v.type === 'youtube') yt(muted ? 'mute' : 'unMute'); }, [muted, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const togglePlay = () => {
    if (v.type === 'youtube') { yt(paused ? 'playVideo' : 'pauseVideo'); setPaused((p) => !p); }
    else if (v.type === 'file' && media.current) { const was = media.current.paused; if (was) media.current.play().catch(() => {}); else media.current.pause(); setPaused(!was); }
  };
  const canControl = v.type === 'youtube' || v.type === 'file';

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 1800); };
  const toggleLike = () => {
    const next = likes.includes(r.id) ? likes.filter((x) => x !== r.id) : [...likes, r.id];
    setLikes(next);
    try { localStorage.setItem(LIKE_KEY, JSON.stringify(next)); } catch (_) {}
  };
  const share = async () => {
    const url = `${window.location.origin}${r.href}`;
    try { if (navigator.share) { await navigator.share({ title: r.title, url }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(url); flash('Link copied'); } catch (_) { flash(url); }
  };

  const btn = 'grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white transition active:scale-90';
  const hasMusic = Boolean(music && music.url);
  const chip = sound === 'silent' && hasMusic && brandOn ? `${music.title} chal raha hai`
    : sound === 'audio' ? 'Reel ki apni awaaz' : '';

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white" role="dialog" aria-modal="true" aria-label="Reels">
      <div ref={scroller} className="no-sb h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {deck.map((reel, i) => {
          const rv = parseVideo(reel.url);
          const live = i === active;
          const liked = likes.includes(reel.id);
          return (
            <section key={reel.id} ref={(el) => { slides.current[i] = el; }} data-i={i} className="relative h-dvh snap-start snap-always overflow-hidden" aria-label={reel.title}>
              {/* blurred backdrop so wide screens never show plain black */}
              {live && <div className="absolute inset-0 scale-110 opacity-40 blur-2xl" aria-hidden="true"><Poster reel={reel} v={rv} sizes="20vw" /></div>}

              {/* the 9:16 frame (full-screen on phones, a phone-shaped column on big screens) */}
              <div className="relative mx-auto h-full overflow-hidden bg-black md:rounded-3xl md:shadow-[0_0_80px_-10px_rgba(11,107,69,.7)]" style={{ width: 'min(100vw, calc(100dvh * 9 / 16))' }}>
                {live ? (
                  <>
                    {rv.type === 'file' && (
                      <video ref={media} key={reel.id} src={rv.src} autoPlay loop muted={muted} playsInline onClick={togglePlay} onTimeUpdate={onVideoTime} onLoadedMetadata={onVideoTime} className="h-full w-full bg-black object-contain" />
                    )}
                    {rv.type !== 'file' && (
                      <div className={rv.vertical ? 'h-full w-full' : 'absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2'}>
                        <iframe
                          ref={media} key={reel.id} title={reel.title}
                          src={rv.type === 'youtube'
                            ? `${rv.src}&mute=1&loop=1&playlist=${rv.id}&controls=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`
                            : rv.src}
                          onLoad={() => { if (rv.type === 'youtube' && !muted) setTimeout(() => yt('unMute'), 400); }}
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" />
                      </div>
                    )}
                    {rv.type === 'youtube' && <button type="button" aria-label={paused ? 'Play' : 'Pause'} onClick={togglePlay} className="absolute inset-x-0 top-14 bottom-44 z-[5]">{paused && <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-black/50 text-white"><Play size={36} fill="currentColor" /></span>}</button>}
                  </>
                ) : (
                  <>
                    <Poster reel={reel} v={rv} sizes="(max-width:768px) 100vw, 420px" />
                    <span className="absolute inset-0 grid place-items-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-white/85 text-gold"><Play size={28} fill="currentColor" /></span></span>
                  </>
                )}

                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/70 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

                {/* top bar */}
                <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <button type="button" onClick={onClose} aria-label="Close reels" className={btn}><X size={22} /></button>
                  <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-bold">{i + 1} / {deck.length}</span>
                  <button type="button" onClick={reshuffle} aria-label="Shuffle reels" className={btn}><Shuffle size={19} /></button>
                </div>
                {live && chip && (
                  <div className="absolute inset-x-0 top-16 z-20 flex justify-center px-3">
                    <span className="flex max-w-[85%] items-center gap-1.5 truncate rounded-full bg-black/60 px-3 py-1 text-[0.7rem] font-semibold"><Music size={12} className={brandPlaying ? 'animate-pulse text-saffron' : 'text-white/70'} /> <span className="truncate">{chip}</span></span>
                  </div>
                )}

                {/* right-hand actions */}
                <div className="absolute bottom-40 right-3 z-20 flex flex-col items-center gap-4">
                  <button type="button" onClick={toggleLike} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} className={`${btn} ${liked ? '!bg-red-500' : ''}`}><Heart size={22} fill={liked ? 'currentColor' : 'none'} /></button>
                  <button type="button" onClick={share} aria-label="Share" className={btn}><Share2 size={20} /></button>
                  {live && canControl && <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Turn sound on' : 'Mute'} className={btn}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>}
                  {live && canControl && <button type="button" onClick={togglePlay} aria-label={paused ? 'Play' : 'Pause'} className={btn}>{paused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>}
                  {live && hasMusic && <button type="button" onClick={toggleBrand} aria-label={brandOn ? 'Turn Mizanora music off' : 'Turn Mizanora music on'} aria-pressed={brandOn} className={`${btn} ${brandOn ? '!bg-saffron/90 !text-[#2B1B00]' : ''}`}><Music size={20} /></button>}
                  <a href={reel.url} target="_blank" rel="noopener noreferrer" aria-label="Open the original video" className={btn}><ExternalLink size={18} /></a>
                </div>

                {/* product + shop button */}
                <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pr-16">
                  <p className="line-clamp-2 text-base font-bold leading-snug drop-shadow">{reel.title}</p>
                  <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-black/45 p-2">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/20">{reel.image && <Image src={reel.image} alt="" fill sizes="48px" className="object-cover" />}</span>
                    <span className="min-w-0 flex-1">
                      {reel.price > 0 && <span className="block text-lg font-extrabold leading-none text-saffron">{formatPKR(reel.price)}</span>}
                      <span className="block text-[0.7rem] text-white/80">Cash on delivery</span>
                    </span>
                    <Link href={reel.href} onClick={onClose} className="btn-sun !px-5 !py-3"><ShoppingBag size={18} /> Shop now</Link>
                  </div>
                  {live && i === 0 && deck.length > 1 && <p className="mt-2 flex animate-bounce items-center justify-center gap-1 text-xs text-white/80"><ChevronUp size={14} /> Swipe up for the next reel</p>}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* desktop arrows */}
      <div className="absolute right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous reel" className={`${btn} disabled:opacity-30`}><ChevronUp size={24} /></button>
        <button type="button" onClick={() => goTo(active + 1)} disabled={active === deck.length - 1} aria-label="Next reel" className={`${btn} disabled:opacity-30`}><ChevronDown size={24} /></button>
      </div>
      {toast && <p role="status" className="absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#12201A] shadow-xl">{toast}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// One vertical (9:16) card
// ---------------------------------------------------------------------------------------------
function Card({ reel, index, onOpen, grid }) {
  const v = parseVideo(reel.url);
  return (
    <button type="button" onClick={onOpen} aria-label={`Watch reel: ${reel.title}`}
      className={`group relative aspect-[9/16] snap-start overflow-hidden rounded-3xl bg-[#06301F] text-left text-white shadow-[0_10px_30px_-12px_rgba(6,48,31,.7)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-12px_rgba(11,107,69,.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${grid ? 'w-full' : 'w-[10.5rem] shrink-0 sm:w-52'}`}>
      <Poster reel={reel} v={v} sizes="(max-width:640px) 45vw, 220px" priority={index < 2} className="transition duration-500 group-hover:scale-110" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

      <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[0.65rem] font-bold">
        {index === 0 ? <><Flame size={12} className="text-saffron" /> Trending</> : v.label}
      </span>

      <span className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 rounded-full bg-white/60 opacity-0 transition group-hover:animate-[mz-ring_1.4s_ease-out_infinite]" />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white/95 text-gold shadow-xl transition group-hover:scale-110"><Play size={24} fill="currentColor" className="ml-0.5" /></span>
      </span>

      <span className="absolute inset-x-2.5 bottom-2.5">
        <span className="line-clamp-2 block text-sm font-bold leading-tight drop-shadow">{reel.title}</span>
        <span className="mt-2 flex items-center justify-between gap-1">
          {reel.price > 0 ? <span className="text-sm font-extrabold text-saffron">{formatPKR(reel.price)}</span> : <span />}
          <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-3 py-1.5 text-[0.7rem] font-extrabold text-[#2B1B00]"><ShoppingBag size={12} /> Shop</span>
        </span>
      </span>
    </button>
  );
}

// A row (home page) or grid of vertical video cards. Tap one to watch full screen and shop from it.
// shuffle = true: random order on every visit; "Naye random reels" (or the Reels tab tapped again) mixes them again.
// autoOpen = true: the full-screen reels open straight away (the /reels page). Closing shows the grid.
// music = { url, title, volume } from the admin (Mizanora background music).
export default function ReelsRail({ reels, grid = false, shuffle = false, autoOpen = false, music = null }) {
  const [open, setOpen] = useState(-1);
  const row = useRef(null);
  const usable = useMemo(() => reels.filter((r) => parseVideo(r.url)), [reels]);
  // The first render uses the normal order (same on server and phone); the random order is applied right after mounting.
  const [order, setOrder] = useState(usable);
  const reshuffle = useCallback(() => setOrder(shuffleReels(usable)), [usable]);
  useEffect(() => { setOrder(shuffle ? shuffleReels(usable) : usable); }, [usable, shuffle]);
  useEffect(() => {
    if (!shuffle) return undefined;
    window.addEventListener('mz-reels-shuffle', reshuffle);
    return () => window.removeEventListener('mz-reels-shuffle', reshuffle);
  }, [shuffle, reshuffle]);
  useEffect(() => { if (autoOpen && usable.length) setOpen(0); }, [autoOpen, usable.length]);
  const list = order.length ? order : usable;
  if (!usable.length) return null;
  const scrollBy = (d) => row.current && row.current.scrollBy({ left: d * 440, behavior: 'smooth' });
  return (
    <>
      {grid ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-[#06301F] via-gold to-[#0E8556] p-4 text-white shadow-lg sm:p-5">
            <div>
              <p className="flex items-center gap-2 text-lg font-extrabold sm:text-xl"><Flame className="text-saffron" size={22} /> {usable.length} reels to watch and shop</p>
              <p className="text-sm text-white/80">Swipe like Instagram. Tap Shop now on anything you love.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shuffle && <button type="button" onClick={reshuffle} className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 px-4 py-2.5 text-sm font-extrabold text-white active:scale-95"><Shuffle size={16} /> Naye random reels</button>}
              <button type="button" onClick={() => setOpen(0)} className="btn-sun"><Play size={18} fill="currentColor" /> Start watching</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {list.map((r, n) => <Card key={r.id} reel={r} index={n} grid onOpen={() => setOpen(n)} />)}
          </div>
        </>
      ) : (
        <div className="relative">
          <div ref={row} className="no-sb -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-3 pt-1 sm:mx-0 sm:px-0">
            {list.map((r, n) => <Card key={r.id} reel={r} index={n} onOpen={() => setOpen(n)} />)}
          </div>
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll reels left" className="absolute -left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white shadow-lg md:grid"><ChevronLeft size={22} /></button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll reels right" className="absolute -right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white shadow-lg md:grid"><ChevronRight size={22} /></button>
        </div>
      )}
      {open >= 0 && <Viewer reels={list} start={open} music={music} onClose={() => setOpen(-1)} />}
    </>
  );
}
