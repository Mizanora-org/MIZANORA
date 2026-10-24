'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Expand, Heart, PictureInPicture2, Share2, Shuffle, X, Search, Tv } from 'lucide-react';
import { preconnect, preload } from 'react-dom';
import { channelGroups, channelSlugs, channelTarget, pickAd, relayHref, stepIndex } from '@/lib/liveTv';

// The Live TV player (v25: a cinematic dark design). One channel at a time. Next / Previous / Random / pick from the grid; favourites and "recent" are
// kept on this device; a channel that does not play is skipped by itself after a few seconds (switch it off with "Auto-skip"). Every time the channel
// changes a product ad plays for the seconds the admin set. The address bar follows the channel (/live/<name>) so a channel can be shared.
// HLS (.m3u8): Safari plays it itself; other browsers get hls.js (loaded once, pinned version, from cdnjs).
const HLS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js';
let hlsPromise = null;
// v26 SPEED: hls.js is fetched as soon as the page opens (not when a channel is pressed), the connection to cdnjs is opened early, and
// a stream that fails directly is retried at once through the shop's relay (/api/tv/p), which also plays http:// streams.
const loadHls = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsPromise) hlsPromise = new Promise((res) => { const s = document.createElement('script'); s.src = HLS_SRC; s.async = true; s.onload = () => res(window.Hls || null); s.onerror = () => res(null); document.head.appendChild(s); });
  return hlsPromise;
};
const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`;
const readList = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.slice(0, 200) : []; } catch (_) { return []; } };
const writeList = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ } };
const SKIP_SECONDS = 3;
const STALL_MS = 10000; // a channel that has not started in 10 seconds is treated as failed (was 20)
const MAX_AUTO_SKIPS = 6;

export default function LiveTvPlayer({ cfg, ads, initialSlug = '' }) {
  const chans = cfg.channels;
  const slugs = useMemo(() => channelSlugs(chans), [chans]);
  const [idx, setIdx] = useState(() => { const i = initialSlug ? slugs.indexOf(initialSlug) : -1; return i >= 0 && !chans[i].off ? i : stepIndex(chans, -1, 1); });
  const [ad, setAd] = useState(() => (cfg.ads.enabled && cfg.ads.onStart ? pickAd(ads, 0) : null));
  const [left, setLeft] = useState(() => cfg.ads.seconds);
  const [status, setStatus] = useState('loading'); // loading | playing | failed | blocked
  const [group, setGroup] = useState('All');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(48);
  const [favs, setFavs] = useState([]);
  const [recent, setRecent] = useState([]);
  const [autoSkip, setAutoSkip] = useState(true);
  const [skipIn, setSkipIn] = useState(0);
  const [viaRelay, setViaRelay] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [toast, setToast] = useState('');
  const frame = useRef(null);
  const video = useRef(null);
  const hls = useRef(null);
  const counter = useRef(1);
  const fails = useRef(0);
  const first = useRef(true);
  const cur = chans[idx];
  const base = useMemo(() => (cur ? channelTarget(cur.url) : null), [cur]);
  // http streams and streams the browser could not open directly are played through the relay
  const target = useMemo(() => (base && base.kind !== 'youtube' && (base.proxy || viaRelay) ? { ...base, src: relayHref(cur.url), relayed: true } : base), [base, viaRelay, cur]);
  preconnect('https://cdnjs.cloudflare.com'); preload(HLS_SRC, { as: 'script' });
  const groups = useMemo(() => channelGroups(chans), [chans]);
  const activeCount = useMemo(() => chans.filter((c) => !c.off).length, [chans]);

  useEffect(() => { setFavs(readList('mz_tv_fav')); setRecent(readList('mz_tv_recent')); loadHls(); }, []);
  useEffect(() => { setViaRelay(false); }, [idx]);
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const go = useCallback((to, auto = false) => {
    if (to < 0 || to === idx) return;
    if (!auto) fails.current = 0;
    if (cfg.ads.enabled && ads.length && !auto) { setAd(pickAd(ads, counter.current)); counter.current += 1; setLeft(cfg.ads.seconds); }
    setStatus('loading'); setSkipIn(0); setIdx(to);
  }, [idx, cfg.ads.enabled, cfg.ads.seconds, ads]);
  const next = useCallback(() => go(stepIndex(chans, idx, 1)), [go, chans, idx]);
  const prev = useCallback(() => go(stepIndex(chans, idx, -1)), [go, chans, idx]);
  const random = () => { const ok = chans.map((c, i) => (c.off || i === idx ? -1 : i)).filter((i) => i >= 0); if (ok.length) go(ok[Math.floor(Math.random() * ok.length)]); };

  // remember the channel as "recent" and keep the address bar on the channel
  useEffect(() => {
    if (!cur) return;
    setRecent((r) => { const v = [cur.url, ...r.filter((u) => u !== cur.url)].slice(0, 20); writeList('mz_tv_recent', v); return v; });
    if (first.current) { first.current = false; if (!initialSlug) return; }
    try { window.history.replaceState(window.history.state, '', `/live/${slugs[idx]}`); } catch (_) { /* no history */ }
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ad countdown
  useEffect(() => {
    if (!ad) return undefined;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [ad]);
  useEffect(() => { if (ad && left <= 0) setAd(null); }, [ad, left]);

  // load the channel (not for YouTube: that is an iframe)
  useEffect(() => {
    const v = video.current;
    if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } hls.current = null; }
    if (!v || !target || target.kind === 'youtube') return undefined;
    let dead = false;
    const canRelay = !target.relayed; // not yet tried through the relay
    // first failure of a direct stream: try the relay before giving up
    const fail = () => { if (dead) return; if (canRelay) { setViaRelay(true); return; } setStatus('failed'); };
    const ok = () => { if (!dead) { fails.current = 0; setBuffering(false); setStatus('playing'); } };
    const start = () => { const p = v.play(); if (p && p.catch) p.catch((e) => { if (!dead) { if (e && e.name === 'NotAllowedError') setStatus('blocked'); else if (e && e.name !== 'AbortError') fail(); } }); };
    v.onplaying = ok; v.onerror = fail; v.onwaiting = () => { if (!dead) setBuffering(true); }; v.oncanplay = () => { if (!dead) setBuffering(false); };
    v.removeAttribute('src'); v.load();
    const stall = setTimeout(() => { if (!dead && v.paused && v.readyState < 3) setStatus((st) => { if (st !== 'loading') return st; if (canRelay) { setViaRelay(true); return 'loading'; } return 'failed'; }); }, STALL_MS);
    (async () => {
      if (target.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await loadHls();
        if (dead) return;
        if (Hls && Hls.isSupported()) {
          // tuned for a quick first picture: short timeouts, small first buffer, quality chosen for the player size, no endless retries
          const h = new Hls({
            enableWorker: true, lowLatencyMode: false, startFragPrefetch: true, capLevelToPlayerSize: true,
            abrEwmaDefaultEstimate: 1200000, maxBufferLength: 14, maxMaxBufferLength: 40, backBufferLength: 15, liveSyncDurationCount: 3,
            manifestLoadingTimeOut: 8000, manifestLoadingMaxRetry: 1, levelLoadingTimeOut: 8000, levelLoadingMaxRetry: 2, fragLoadingTimeOut: 12000, fragLoadingMaxRetry: 3,
          });
          hls.current = h; let netTries = 0; let mediaTries = 0;
          h.on(Hls.Events.ERROR, (_e, d) => {
            if (dead || !d || !d.fatal) return;
            if (d.type === 'networkError' && netTries < 2) { netTries += 1; try { h.startLoad(); } catch (_) { fail(); } }
            else if (d.type === 'mediaError' && mediaTries < 1) { mediaTries += 1; try { h.recoverMediaError(); } catch (_) { fail(); } }
            else fail();
          });
          h.loadSource(target.src); h.attachMedia(v);
          if (cfg.autoplay) start();
          return;
        }
      }
      v.src = target.src; if (cfg.autoplay) start();
    })();
    return () => { dead = true; clearTimeout(stall); v.onplaying = null; v.onerror = null; v.onwaiting = null; v.oncanplay = null; try { v.pause(); } catch (_) { /* gone */ } };
  }, [target, cfg.autoplay]);
  useEffect(() => () => { if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } } }, []);

  // a blocked start (browser wants a touch): the next touch plays
  useEffect(() => {
    if (status !== 'blocked') return undefined;
    const go2 = () => { const v = video.current; if (v) v.play().catch(() => {}); };
    const ev = ['pointerup', 'touchend', 'click', 'keydown'];
    ev.forEach((e) => document.addEventListener(e, go2, { once: true, passive: true }));
    return () => ev.forEach((e) => document.removeEventListener(e, go2));
  }, [status]);
  // YouTube is "playing" as soon as its frame is there
  useEffect(() => { if (target && target.kind === 'youtube') setStatus('playing'); }, [target]);

  // a channel that fails is skipped after a few seconds (at most 6 in a row, so a dead list does not spin forever)
  useEffect(() => {
    if (status !== 'failed' || !autoSkip || ad || fails.current >= MAX_AUTO_SKIPS) { setSkipIn(0); return undefined; }
    let s = SKIP_SECONDS; setSkipIn(s);
    const t = setInterval(() => { s -= 1; setSkipIn(s); if (s <= 0) { clearInterval(t); fails.current += 1; go(stepIndex(chans, idx, 1), true); } }, 1000);
    return () => clearInterval(t);
  }, [status, autoSkip, ad, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: arrows = previous / next, F = full screen, R = random
  useEffect(() => {
    const k = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'f' || e.key === 'F') fullscreen(); else if (e.key === 'r' || e.key === 'R') random();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const fullscreen = () => { const el = frame.current; if (!el) return; try { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); else if (video.current && video.current.webkitEnterFullscreen) video.current.webkitEnterFullscreen(); } catch (_) { /* not allowed */ } };
  const pip = async () => { const v = video.current; try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (v && document.pictureInPictureEnabled) await v.requestPictureInPicture(); else say('Picture in picture is not available for this channel.'); } catch (_) { say('Picture in picture is not available.'); } };
  const toggleFav = (url) => setFavs((f) => { const v = f.includes(url) ? f.filter((u) => u !== url) : [url, ...f].slice(0, 100); writeList('mz_tv_fav', v); return v; });
  const share = async () => {
    const url = `${window.location.origin}/live/${slugs[idx]}`;
    try { if (navigator.share) { await navigator.share({ title: `${cur.name} on Mizanora Live TV`, url }); return; } await navigator.clipboard.writeText(url); say('Channel link copied'); } catch (_) { /* cancelled */ }
  };

  if (!cur) return <p className="rounded-2xl bg-raised p-5 text-dim">Abhi koi channel nahi hai.</p>;
  const isFav = favs.includes(cur.url);
  const needle = q.trim().toLowerCase();
  const pool = chans.map((c, i) => ({ ...c, i })).filter((c) => !c.off);
  const filtered = pool.filter((c) => (group === 'All' || (group === 'Favourites' ? favs.includes(c.url) : group === 'Recent' ? recent.includes(c.url) : (c.group || 'Other') === group)) && (!needle || `${c.name} ${c.group}`.toLowerCase().includes(needle)));
  if (group === 'Recent') filtered.sort((a, b) => recent.indexOf(a.url) - recent.indexOf(b.url));
  const canSkip = ad && cfg.ads.seconds - left >= cfg.ads.skipAfter;
  const num = pool.findIndex((c) => c.i === idx) + 1;
  const chip = (name, label, count) => <button key={name} type="button" onClick={() => { setGroup(name); setShown(48); }} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${group === name ? 'border-[#F5B83D] bg-[#F5B83D] text-[#06402a]' : 'border-white/15 bg-white/5 text-white/85 hover:bg-white/10'}`}>{label || name}{count != null ? <span className="ml-1 opacity-70">{count}</span> : null}</button>;
  const ctl = 'grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-90';

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-[#07140f] via-[#0a2218] to-[#051009] p-3 text-white shadow-[0_30px_80px_-30px_rgba(6,64,42,.9)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold tracking-wider"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
          <div className="min-w-0"><p className="truncate text-lg font-extrabold leading-tight sm:text-xl">{cur.name}</p><p className="truncate text-xs text-white/60">{cur.group || 'Live channel'} · CH {num}/{activeCount}</p></div>
        </div>
        <Tv size={22} className="hidden shrink-0 text-[#F5B83D] sm:block" aria-hidden="true" />
      </div>

      <div ref={frame} className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10" style={{ aspectRatio: '16 / 9' }}>
        {target && target.kind === 'youtube' && <iframe key={target.src} src={target.src} title={cur.name} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
        {target && target.kind !== 'youtube' && <video ref={video} className="absolute inset-0 h-full w-full bg-black" controls playsInline preload="auto" poster={cur.logo || undefined} />}
        {!target && <p className="absolute inset-0 grid place-items-center p-4 text-center text-white/80">Is channel ka link theek nahi hai.</p>}
        {target && target.kind !== 'youtube' && status === 'loading' && !ad && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40"><div className="text-center">{cur.logo ? <img src={cur.logo} alt="" className="mx-auto mb-2 h-14 w-14 rounded-xl bg-white/90 object-contain p-1" /> : null}<div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-[#F5B83D]" /><p className="mt-2 text-sm text-white/80">Channel load ho raha hai...</p></div></div>
        )}
        {target && target.kind !== 'youtube' && status === 'playing' && buffering && !ad && <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-[#F5B83D]" aria-label="Buffering" />}
        {status === 'blocked' && !ad && <p className="pointer-events-none absolute inset-0 grid place-items-center bg-black/50 p-4 text-center font-bold text-white">Chalane ke liye screen ko chhoo dein</p>}
        {status === 'failed' && !ad && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 p-4 text-center text-white"><div>
            <p className="font-bold">Ye channel abhi nahi chal raha.</p>
            <p className="mt-1 text-sm text-white/70">{skipIn > 0 ? `Agla channel ${skipIn} second mein khud lag jayega.` : 'Ho sakta hai stream band ho ya dusri website par chalne se mana kare.'}</p>
            <div className="mt-3 flex justify-center gap-2"><button type="button" className="rounded-full bg-[#F5B83D] px-5 py-2 font-bold text-[#0B6B45]" onClick={next}>Agla channel</button><button type="button" className="rounded-full bg-white/15 px-5 py-2 font-bold" onClick={random}>Random</button></div>
          </div></div>
        )}
        {ad && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-gradient-to-br from-[#0B6B45] via-[#085a39] to-[#032a1b] p-4 text-white" role="dialog" aria-label="Advertisement">
            <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold tracking-wide">AD · {Math.max(0, left)}s</span>
            {canSkip && <button type="button" onClick={() => setAd(null)} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Skip <X size={12} /></button>}
            <div className="flex w-full max-w-md items-center gap-4">
              {ad.image ? <img src={ad.image} alt={ad.name} className="h-28 w-28 shrink-0 rounded-2xl bg-white object-cover shadow-xl sm:h-36 sm:w-36" /> : null}
              <div className="min-w-0 text-left">
                <p className="line-clamp-2 text-lg font-extrabold">{ad.name}</p>
                <p className="mt-1 text-xl font-extrabold text-[#F5B83D]">{pkr(ad.price)} {ad.comparePrice ? <s className="ml-1 text-sm font-semibold text-white/60">{pkr(ad.comparePrice)}</s> : null}</p>
                <Link href={`/product/${ad.slug}`} className="mt-3 inline-block rounded-full bg-white px-5 py-2 text-sm font-extrabold text-[#0B6B45]">Abhi dekhein</Link>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15"><div className="h-full bg-[#F5B83D] transition-all duration-1000 ease-linear" style={{ width: `${Math.max(0, Math.min(100, (left / cfg.ads.seconds) * 100))}%` }} /></div>
          </div>
        )}
        {toast && <p className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-xs font-bold">{toast}</p>}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
        <button type="button" onClick={prev} className={ctl} aria-label="Previous channel"><ChevronLeft size={22} /></button>
        <button type="button" onClick={() => toggleFav(cur.url)} className={`${ctl} ${isFav ? '!bg-red-600/80' : ''}`} aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={isFav}><Heart size={19} fill={isFav ? 'currentColor' : 'none'} /></button>
        <button type="button" onClick={random} className={ctl} aria-label="Random channel"><Shuffle size={19} /></button>
        <button type="button" onClick={share} className={ctl} aria-label="Share channel"><Share2 size={19} /></button>
        {target && target.kind !== 'youtube' && <button type="button" onClick={pip} className={`${ctl} hidden sm:grid`} aria-label="Picture in picture"><PictureInPicture2 size={19} /></button>}
        <button type="button" onClick={fullscreen} className={ctl} aria-label="Full screen"><Expand size={19} /></button>
        <button type="button" onClick={next} className={ctl} aria-label="Next channel"><ChevronRight size={22} /></button>
      </div>
      <label className="mt-3 flex items-center justify-center gap-2 text-xs text-white/70"><input type="checkbox" className="h-4 w-4 accent-[#F5B83D]" checked={autoSkip} onChange={(e) => setAutoSkip(e.target.checked)} /> Auto-skip channels that do not play</label>

      <div className="relative mt-4">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
        <input className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/50 focus:border-[#F5B83D] focus:outline-none" value={q} onChange={(e) => { setQ(e.target.value); setShown(48); }} placeholder={`Search ${activeCount} channels`} aria-label="Search channels" />
      </div>
      <div className="no-sb mt-3 flex gap-2 overflow-x-auto pb-1">
        {chip('All', 'All', activeCount)}{favs.length > 0 && chip('Favourites', '♥ Favourites', favs.length)}{recent.length > 1 && chip('Recent', 'Recent')}
        {groups.map((g) => chip(g.name, null, g.count))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.slice(0, shown).map((c) => (
          <li key={c.url}><button type="button" onClick={() => go(c.i)} className={`flex h-full w-full items-center gap-2.5 rounded-2xl border p-2 text-left transition ${c.i === idx ? 'border-[#F5B83D] bg-[#F5B83D]/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
            {c.logo ? <img src={c.logo} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5" loading="lazy" referrerPolicy="no-referrer" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-bold text-white/70">TV</span>}
            <span className="min-w-0"><span className="block truncate text-sm font-bold">{c.name}</span><span className="block truncate text-[11px] text-white/55">{c.i === idx ? 'Playing now' : (c.group || 'Live')}</span></span>
          </button></li>
        ))}
      </ul>
      {!filtered.length && <p className="mt-3 rounded-2xl bg-white/5 p-4 text-sm text-white/70">Koi channel nahi mila.{group !== 'All' ? ' Doosra group chunein.' : ''}</p>}
      {filtered.length > shown && <button type="button" onClick={() => setShown(shown + 48)} className="mt-3 w-full rounded-full border border-white/15 bg-white/10 py-2.5 text-sm font-bold hover:bg-white/15">Aur channels dikhayein ({filtered.length - shown})</button>}
      <p className="mt-4 text-center text-[11px] text-white/40">Keys: ← → channel, F full screen, R random.</p>
    </div>
  );
}
