'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ChevronLeft, ChevronRight, Clock3, Expand, Heart, LoaderCircle, PictureInPicture2,
  Play, Radio, RefreshCw, Search, Share2, Shuffle, Tv, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import {
  TV_QUALITY, filterChannels, qualityLevel, streamOrigin, tvClock, tvStatusLabel,
} from '@/lib/liveTvUi';
import { channelGroups, channelSlugs, channelTarget, pickAd, relayHref, stepIndex } from '@/lib/liveTv';

// v28 LIVE TV: a broadcast-style player and guide. hls.js is a local, dynamically imported chunk (no
// third-party CDN), channel switching starts each stream exactly once, and the guide is filtered with
// useDeferredValue so typing stays smooth even with 800 channels. Favourites, recents, auto-skip, the
// signed relay, product ads and shareable /live/<channel> links all remain.
let hlsPromise = null;
let HlsCtor = null;
const loadHls = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (HlsCtor) return Promise.resolve(HlsCtor);
  if (!hlsPromise) {
    hlsPromise = import('hls.js/light')
      .then((m) => { HlsCtor = m.default || m.Hls || null; if (!HlsCtor) hlsPromise = null; return HlsCtor; })
      .catch(() => { hlsPromise = null; return null; }); // a later channel can retry the chunk
  }
  return hlsPromise;
};

const pkr = (n) => `Rs ${Math.max(0, Number(n) || 0).toLocaleString('en-PK')}`;
const readList = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.slice(0, 200) : []; } catch (_) { return []; } };
const writeList = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ } };
const readPref = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (_) { return fallback; } };
const writePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ } };
const SKIP_SECONDS = 3;
const STALL_MS = 10000;
const MAX_AUTO_SKIPS = 6;
const PAGE_SIZE = 36;

function TvClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(tvClock(new Date()));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);
  return <span className="mztv-clock"><Clock3 size={13} aria-hidden="true" />{time || '--:--'} PKT</span>;
}

function ChannelLogo({ channel, large = false }) {
  if (!channel?.logo) return <span className={`mztv-logo ${large ? 'is-large' : ''}`} aria-hidden="true"><Tv size={large ? 30 : 17} /></span>;
  return <img src={channel.logo} alt="" className={`mztv-logo ${large ? 'is-large' : ''}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
}

export default function LiveTvPlayer({ cfg, ads, initialSlug = '' }) {
  const chans = useMemo(() => (Array.isArray(cfg?.channels) ? cfg.channels : []), [cfg]);
  const slugs = useMemo(() => channelSlugs(chans), [chans]);
  const groups = useMemo(() => channelGroups(chans), [chans]);
  const adProducts = useMemo(() => (Array.isArray(ads) ? ads : []), [ads]);
  const adsEnabled = cfg?.ads?.enabled === true;
  const adSeconds = Math.max(1, Number(cfg?.ads?.seconds) || 6);
  const adSkipAfter = Math.max(0, Number(cfg?.ads?.skipAfter) || 0);
  const autoplay = cfg?.autoplay !== false;

  const [idx, setIdx] = useState(() => {
    const i = initialSlug ? slugs.indexOf(initialSlug) : -1;
    return i >= 0 && !chans[i]?.off ? i : stepIndex(chans, -1, 1);
  });
  const [ad, setAd] = useState(() => (adsEnabled && cfg?.ads?.onStart !== false ? pickAd(adProducts, 0) : null));
  const [left, setLeft] = useState(adSeconds);
  const [status, setStatus] = useState('loading');
  const [group, setGroup] = useState('All');
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [favs, setFavs] = useState([]);
  const [recent, setRecent] = useState([]);
  const [autoSkip, setAutoSkip] = useState(true);
  const [skipIn, setSkipIn] = useState(0);
  // The INDEX of the channel using the relay. Changing channel resets it in the same batch as idx,
  // so the next channel never starts on the previous channel's relay and then restarts.
  const [relayIndex, setRelayIndex] = useState(-1);
  const [retryKey, setRetryKey] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [toast, setToast] = useState('');
  const [muted, setMuted] = useState(true); // starts silent: browsers allow instant autoplay
  const [quality, setQuality] = useState('auto');
  const [levelCount, setLevelCount] = useState(0);
  const [isFs, setIsFs] = useState(false);

  const frame = useRef(null);
  const video = useRef(null);
  const hls = useRef(null);
  const searchInput = useRef(null);
  const counter = useRef(1);
  const fails = useRef(0);
  const toastTimer = useRef(null);
  const mutedRef = useRef(muted);
  const adRef = useRef(Boolean(ad));
  const qualityRef = useRef(quality);
  const statusRef = useRef(status);
  const prefsLoaded = useRef(false);

  const cur = chans[idx] || null;
  const curSlug = slugs[idx] || '';
  const pool = useMemo(() => chans.map((c, i) => ({ ...c, i, slug: slugs[i] })).filter((c) => !c.off), [chans, slugs]);
  const activeCount = pool.length;
  const activeNo = Math.max(1, pool.findIndex((c) => c.i === idx) + 1);
  const base = useMemo(() => (cur ? channelTarget(cur.url) : null), [cur]);
  const viaRelay = relayIndex === idx;
  const target = useMemo(() => {
    if (!base || !cur) return null;
    if (base.kind !== 'youtube' && (base.proxy || viaRelay)) return { ...base, src: relayHref(cur.url), relayed: true };
    return base;
  }, [base, cur, viaRelay]);
  const youtubeSrc = target?.kind === 'youtube' ? `${target.src}&mute=1` : '';
  const statusLabel = tvStatusLabel(status, buffering, target?.kind);
  const filtered = useMemo(() => filterChannels(pool, { group, query: deferredQ, favs, recent }), [pool, group, deferredQ, favs, recent]);
  const favCount = useMemo(() => pool.filter((c) => favs.includes(c.url)).length, [pool, favs]);
  const recentCount = useMemo(() => pool.filter((c) => recent.includes(c.url)).length, [pool, recent]);
  const canSkip = Boolean(ad) && adSeconds - left >= adSkipAfter;

  const say = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const go = useCallback((to, auto = false) => {
    if (to < 0 || to === idx || !chans[to] || chans[to].off) return;
    if (!auto) fails.current = 0;
    if (adsEnabled && adProducts.length && !auto) {
      setAd(pickAd(adProducts, counter.current));
      counter.current += 1;
      setLeft(adSeconds);
    }
    setStatus('loading');
    setBuffering(false);
    setSkipIn(0);
    setLevelCount(0);
    setRelayIndex(-1);
    setIdx(to);
  }, [idx, chans, adsEnabled, adProducts, adSeconds]);

  const next = useCallback(() => go(stepIndex(chans, idx, 1)), [go, chans, idx]);
  const prev = useCallback(() => go(stepIndex(chans, idx, -1)), [go, chans, idx]);
  const random = useCallback(() => {
    const choices = pool.filter((c) => c.i !== idx).map((c) => c.i);
    if (choices.length) go(choices[Math.floor(Math.random() * choices.length)]);
  }, [pool, idx, go]);

  const retry = useCallback(() => {
    fails.current = 0;
    setRelayIndex(-1);
    setStatus('loading');
    setBuffering(false);
    setSkipIn(0);
    setLevelCount(0);
    setRetryKey((n) => n + 1);
    say('Channel dobara load ho raha hai');
  }, [say]);

  const playNow = useCallback(() => {
    const v = video.current;
    if (!v) return;
    setStatus((s) => (s === 'playing' ? s : 'loading'));
    v.muted = mutedRef.current || adRef.current;
    const p = v.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') setStatus('blocked'); });
  }, []);

  const jumpToLive = useCallback(() => {
    const v = video.current;
    const h = hls.current;
    if (!v) return;
    let edge = h && Number.isFinite(h.liveSyncPosition) ? h.liveSyncPosition : null;
    if (edge == null && !Number.isFinite(v.duration) && v.seekable && v.seekable.length) edge = v.seekable.end(v.seekable.length - 1);
    if (edge == null) { say('Stream pehle hi live edge par hai'); return; }
    try { v.currentTime = Math.max(0, edge - 0.4); say('Live edge par aa gaye'); } catch (_) { say('Live edge abhi available nahi'); }
  }, [say]);

  const fullscreen = useCallback(() => {
    const el = frame.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
      else if (video.current && video.current.webkitEnterFullscreen) video.current.webkitEnterFullscreen();
    } catch (_) { /* not allowed */ }
  }, []);

  const pip = useCallback(async () => {
    const v = video.current;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (v && document.pictureInPictureEnabled) await v.requestPictureInPicture();
      else say('Picture in picture is not available here');
    } catch (_) { say('Picture in picture is not available here'); }
  }, [say]);

  const toggleMuted = useCallback(() => {
    const n = !muted;
    setMuted(n);
    mutedRef.current = n;
    // Sound is intentionally NOT restored from localStorage: muted autoplay is reliable on phones.
    // One tap is enough to turn it on for this visit.
    if (target?.kind === 'youtube' && !n) say('YouTube ki awaaz player ke speaker se on karein');
    else say(n ? 'Awaaz band' : 'Awaaz chaloo');
  }, [muted, target, say]);

  const toggleAutoSkip = useCallback(() => {
    const n = !autoSkip;
    setAutoSkip(n);
    writePref('mz_tv_autoskip', n);
    say(n ? 'Dead channels khud skip honge' : 'Auto-skip band');
  }, [autoSkip, say]);

  const toggleFav = useCallback((url) => {
    setFavs((f) => {
      const v = f.includes(url) ? f.filter((u) => u !== url) : [url, ...f].slice(0, 100);
      writeList('mz_tv_fav', v);
      return v;
    });
  }, []);

  const share = useCallback(async () => {
    if (!cur || !curSlug || typeof window === 'undefined') return;
    const url = `${window.location.origin}/live/${curSlug}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title: `${cur.name} on Mizanora Live TV`, url }); return; }
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); say('Channel link copied'); return; }
      say(url);
    } catch (e) { if (!e || e.name !== 'AbortError') say('Link share nahi hua'); }
  }, [cur, curSlug, say]);

  // Device preferences + warm the local HLS chunk as soon as the page opens.
  useEffect(() => {
    setFavs(readList('mz_tv_fav'));
    setRecent(readList('mz_tv_recent'));
    setAutoSkip(readPref('mz_tv_autoskip', true) !== false);
    const savedQuality = readPref('mz_tv_quality', 'auto');
    if (TV_QUALITY.some(([v]) => v === savedQuality)) setQuality(savedQuality);
    prefsLoaded.current = true;
    loadHls();
  }, []);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { adRef.current = Boolean(ad); }, [ad]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    qualityRef.current = quality;
    if (prefsLoaded.current) writePref('mz_tv_quality', quality);
    const h = hls.current;
    if (h) h.currentLevel = qualityLevel(h.levels, quality);
  }, [quality]);
  useEffect(() => {
    const v = video.current;
    if (v) v.muted = muted || Boolean(ad);
  }, [muted, ad, target]);

  // Open the connection to the current AND next stream host early. No CDN script connection is needed now.
  const preconnectOrigins = useMemo(() => {
    const nextIndex = stepIndex(chans, idx, 1);
    return [...new Set([cur?.url, chans[nextIndex]?.url].map(streamOrigin).filter(Boolean))].join('|');
  }, [chans, idx, cur]);
  useEffect(() => {
    if (!preconnectOrigins || typeof document === 'undefined') return undefined;
    const secure = window.location.protocol === 'https:';
    const links = preconnectOrigins.split('|')
      .filter((origin) => !(secure && origin.startsWith('http://')))
      .map((origin) => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = '';
        document.head.appendChild(link);
        return link;
      });
    return () => links.forEach((link) => link.remove());
  }, [preconnectOrigins]);

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Remember the channel and keep the address bar shareable.
  useEffect(() => {
    if (!cur || !curSlug) return;
    setRecent((r) => {
      const v = [cur.url, ...r.filter((u) => u !== cur.url)].slice(0, 20);
      writeList('mz_tv_recent', v);
      return v;
    });
    try {
      if (window.location.pathname !== `/live/${curSlug}`) window.history.replaceState(window.history.state, '', `/live/${curSlug}`);
    } catch (_) { /* history blocked */ }
  }, [idx, cur, curSlug]);

  // Ad countdown. The stream can keep loading behind the ad, but stays muted until the ad ends.
  useEffect(() => {
    if (!ad) return undefined;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ad]);
  useEffect(() => { if (ad && left <= 0) setAd(null); }, [ad, left]);

  useEffect(() => {
    if (target?.kind === 'youtube') { setStatus('playing'); setBuffering(false); setLevelCount(0); }
    else if (!target && cur) setStatus('failed');
  }, [target, cur]);

  // Load one stream. A direct failure switches to the signed relay once; a relay failure shows retry.
  useEffect(() => {
    const v = video.current;
    if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } hls.current = null; }
    if (!v || !target || target.kind === 'youtube') return undefined;
    let dead = false;
    let fallbackStarted = false;
    const canRelay = !target.relayed;
    const useRelay = () => {
      if (!canRelay) return false;
      if (fallbackStarted) return true; // another error arrived before React switched the target
      fallbackStarted = true;
      setRelayIndex(idx);
      setStatus('loading');
      return true;
    };
    const fail = () => {
      if (dead) return;
      setBuffering(false);
      if (!useRelay()) setStatus('failed');
    };
    const ok = () => { if (!dead) { fails.current = 0; setBuffering(false); setStatus('playing'); } };
    v.onplaying = ok;
    v.onerror = fail;
    v.onwaiting = () => { if (!dead) setBuffering(true); };
    v.onstalled = () => { if (!dead) setBuffering(true); };
    v.oncanplay = () => { if (!dead) setBuffering(false); };
    v.removeAttribute('src');
    v.load();
    setLevelCount(0);
    const stall = setTimeout(() => {
      if (dead || statusRef.current !== 'loading' || !v.paused || v.readyState >= 3) return;
      if (!useRelay()) setStatus('failed');
    }, STALL_MS);

    (async () => {
      if (target.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await loadHls();
        if (dead) return;
        if (Hls && Hls.isSupported()) {
          // Short buffers and bounded retries = first picture quickly, no runaway requests.
          const h = new Hls({
            enableWorker: true, lowLatencyMode: false, startFragPrefetch: true, capLevelToPlayerSize: true,
            abrEwmaDefaultEstimate: 1200000, maxBufferLength: 12, maxMaxBufferLength: 30, backBufferLength: 12,
            liveSyncDurationCount: 3, manifestLoadingTimeOut: 8000, manifestLoadingMaxRetry: 1,
            levelLoadingTimeOut: 8000, levelLoadingMaxRetry: 2, fragLoadingTimeOut: 12000, fragLoadingMaxRetry: 3,
          });
          hls.current = h;
          let netTries = 0;
          let mediaTries = 0;
          h.on(Hls.Events.MANIFEST_PARSED, () => {
            if (dead) return;
            setLevelCount(h.levels ? h.levels.length : 0);
            h.currentLevel = qualityLevel(h.levels, qualityRef.current);
          });
          h.on(Hls.Events.ERROR, (_event, data) => {
            if (dead || !data || !data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netTries < 2) {
              netTries += 1;
              try { h.stopLoad(); h.startLoad(); } catch (_) { fail(); }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaTries < 1) {
              mediaTries += 1;
              try { h.recoverMediaError(); } catch (_) { fail(); }
            } else fail();
          });
          h.loadSource(target.src);
          h.attachMedia(v);
          if (autoplay) playNow(); else setStatus('ready');
          return;
        }
        // No HLS engine: let the relay be tried once before declaring no signal.
        fail();
        return;
      }
      v.src = target.src;
      if (autoplay) playNow(); else setStatus('ready');
    })();

    return () => {
      dead = true;
      clearTimeout(stall);
      v.onplaying = null; v.onerror = null; v.onwaiting = null; v.onstalled = null; v.oncanplay = null;
      try { v.pause(); } catch (_) { /* gone */ }
    };
  }, [target, autoplay, retryKey, idx, playNow]);

  // A browser that blocked autoplay waits for one real interaction.
  useEffect(() => {
    if (status !== 'blocked') return undefined;
    const events = ['pointerup', 'touchend', 'click', 'keydown'];
    const start = () => playNow();
    events.forEach((e) => document.addEventListener(e, start, { once: true, passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, start));
  }, [status, playNow]);

  // Auto-skip dead channels, but never spin forever and never while an ad is on screen.
  useEffect(() => {
    if (status !== 'failed' || !autoSkip || ad || fails.current >= MAX_AUTO_SKIPS) { setSkipIn(0); return undefined; }
    let s = SKIP_SECONDS;
    setSkipIn(s);
    const t = setInterval(() => {
      s -= 1;
      setSkipIn(s);
      if (s <= 0) { clearInterval(t); fails.current += 1; go(stepIndex(chans, idx, 1), true); }
    }, 1000);
    return () => clearInterval(t);
  }, [status, autoSkip, ad, idx, chans, go]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === '/') { e.preventDefault(); searchInput.current && searchInput.current.focus(); }
      else {
        const k = String(e.key).toLowerCase();
        if (k === 'f') fullscreen();
        else if (k === 'r') random();
        else if (k === 'm') toggleMuted();
        else if (k === 'l') jumpToLive();
        else if (k === '?') say('Keys: ← → channel, / search, M sound, L live, F full screen, R random');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, fullscreen, random, toggleMuted, jumpToLive, say]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } }
  }, []);

  if (!cur) return <div className="mztv-empty">Abhi koi active channel nahi hai.</div>;

  const isFav = favs.includes(cur.url);
  const visible = filtered.slice(0, shown);
  const chip = (name, label, count) => (
    <button key={name} type="button" onClick={() => { setGroup(name); setShown(PAGE_SIZE); }} aria-pressed={group === name} className={`mztv-chip ${group === name ? 'is-on' : ''}`}>
      {label || name}{count != null && <span>{count}</span>}
    </button>
  );
  const ctl = 'mztv-control';

  return (
    <div className="mztv-shell">
      <div className="mztv-aurora" aria-hidden="true" />
      <header className="mztv-topbar">
        <div className="mztv-brand">
          <span className="mztv-brand-mark"><Radio size={20} aria-hidden="true" /></span>
          <span><b>MIZANORA</b><small>LIVE TV</small></span>
        </div>
        <div className="mztv-now">
          <ChannelLogo channel={cur} />
          <span className="mztv-now-copy"><b>{cur.name}</b><small>{cur.group || 'Live channel'} · CH {activeNo}/{activeCount}</small></span>
        </div>
        <div className="mztv-badges">
          {cfg?.demo && <span className="mztv-badge is-demo">DEMO</span>}
          {target?.relayed && <span className="mztv-badge">RELAY</span>}
          <span className={`mztv-badge is-status is-${status}`}><i aria-hidden="true" />{statusLabel}</span>
          <span className="mztv-badge is-quiet"><Activity size={12} aria-hidden="true" />{levelCount ? `${levelCount} LEVELS` : 'ADAPTIVE'}</span>
          <TvClock />
        </div>
      </header>

      <div className="mztv-layout">
        <section className="mztv-primary" aria-label="Live video player">
          <div ref={frame} className="mztv-screen" style={{ aspectRatio: '16 / 9' }}>
            {target?.kind === 'youtube' && (
              <iframe key={youtubeSrc} src={youtubeSrc} title={cur.name} className="mztv-video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            )}
            {target && target.kind !== 'youtube' && (
              <video ref={video} className="mztv-video" controls playsInline preload="metadata" poster={cur.logo || undefined} aria-label={`${cur.name} live stream`} />
            )}
            {!target && <div className="mztv-screen-message"><p>Is channel ka link theek nahi hai.</p><button type="button" onClick={next} className="mztv-inline-btn">Agla channel</button></div>}

            {target && target.kind !== 'youtube' && status === 'loading' && !ad && (
              <div className="mztv-loading" aria-live="polite">
                <ChannelLogo channel={cur} large />
                <LoaderCircle size={34} className="mztv-spin" aria-hidden="true" />
                <p>Channel connect ho raha hai...</p>
              </div>
            )}
            {target && target.kind !== 'youtube' && (status === 'ready' || status === 'blocked') && !ad && (
              <div className="mztv-gate">
                <button type="button" onClick={playNow} aria-label="Play channel"><Play size={34} fill="currentColor" /></button>
                <p>Chalane ke liye play dabayein</p>
              </div>
            )}
            {target && status === 'failed' && !ad && (
              <div className="mztv-failed">
                <p className="mztv-failed-title">Ye channel abhi nahi chal raha.</p>
                <p>{skipIn > 0 ? `Agla channel ${skipIn} second mein khud lag jayega.` : 'Stream band ho sakti hai ya dusri website par chalne se mana kar rahi hai.'}</p>
                <div className="mztv-failed-actions">
                  <button type="button" onClick={retry} className="mztv-inline-btn is-solid"><RefreshCw size={15} /> Retry</button>
                  <button type="button" onClick={next} className="mztv-inline-btn">Agla channel</button>
                  <button type="button" onClick={random} className="mztv-inline-btn">Random</button>
                </div>
              </div>
            )}
            {status === 'playing' && buffering && !ad && <div className="mztv-buffer" role="status" aria-label="Buffering"><LoaderCircle size={20} className="mztv-spin" /></div>}
            {status === 'playing' && target && target.kind !== 'youtube' && !ad && (
              <button type="button" onClick={jumpToLive} className="mztv-live-edge"><Radio size={13} /> LIVE EDGE</button>
            )}
            {ad && (
              <div className="mztv-ad" role="dialog" aria-label="Advertisement">
                <span className="mztv-ad-time">AD · {Math.max(0, left)}s</span>
                {canSkip && <button type="button" onClick={() => setAd(null)} className="mztv-ad-skip">Skip <X size={13} /></button>}
                <div className="mztv-ad-body">
                  {ad.image && <img src={ad.image} alt={ad.name} className="mztv-ad-image" />}
                  <div className="mztv-ad-copy">
                    <span>SPONSORED</span>
                    <p>{ad.name}</p>
                    <b>{pkr(ad.price)} {ad.comparePrice ? <s>{pkr(ad.comparePrice)}</s> : null}</b>
                    <Link href={`/product/${ad.slug}`}>Abhi dekhein</Link>
                  </div>
                </div>
                <div className="mztv-ad-progress"><i style={{ width: `${Math.max(0, Math.min(100, (left / adSeconds) * 100))}%` }} /></div>
              </div>
            )}
            {toast && <p className="mztv-toast" role="status">{toast}</p>}
          </div>

          <div className="mztv-dock" aria-label="Player controls">
            <button type="button" onClick={prev} className={`${ctl} is-primary`} aria-label="Previous channel"><ChevronLeft size={23} /></button>
            <button type="button" onClick={next} className={`${ctl} is-primary`} aria-label="Next channel"><ChevronRight size={23} /></button>
            <span className="mztv-dock-sep" aria-hidden="true" />
            <button type="button" onClick={toggleMuted} className={ctl} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
            <button type="button" onClick={() => toggleFav(cur.url)} className={`${ctl} ${isFav ? 'is-fav' : ''}`} aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={isFav}><Heart size={19} fill={isFav ? 'currentColor' : 'none'} /></button>
            <button type="button" onClick={random} className={ctl} aria-label="Random channel"><Shuffle size={18} /></button>
            <button type="button" onClick={share} className={ctl} aria-label="Share channel"><Share2 size={18} /></button>
            {target && target.kind !== 'youtube' && <button type="button" onClick={pip} className={`${ctl} is-optional`} aria-label="Picture in picture"><PictureInPicture2 size={18} /></button>}
            <button type="button" onClick={fullscreen} className={ctl} aria-label={isFs ? 'Exit full screen' : 'Full screen'}>{isFs ? <X size={19} /> : <Expand size={19} />}</button>
          </div>

          <div className="mztv-options">
            <button type="button" onClick={toggleAutoSkip} className={`mztv-toggle ${autoSkip ? 'is-on' : ''}`} aria-pressed={autoSkip}><span aria-hidden="true" />Auto-skip dead channels</button>
            {levelCount > 0 ? (
              <label className="mztv-quality"><span>Quality</span><select value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Stream quality">{TV_QUALITY.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
            ) : <span className="mztv-adaptive"><Zap size={13} /> Adaptive playback</span>}
            <span className="mztv-keys">← → channel · / search · M sound · F full screen · R random · ? help</span>
          </div>
        </section>

        <aside className="mztv-guide" aria-label="Channel guide">
          <div className="mztv-guide-head">
            <div><span>CHANNEL GUIDE</span><h2>{activeCount} live channels</h2></div>
            <Tv size={21} aria-hidden="true" />
          </div>
          <div className="mztv-search">
            <Search size={17} aria-hidden="true" />
            <input ref={searchInput} value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE_SIZE); }} onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) go(filtered[0].i); if (e.key === 'Escape') setQ(''); }} placeholder="Search channels, groups..." aria-label="Search channels" />
            {q && <button type="button" onClick={() => { setQ(''); searchInput.current && searchInput.current.focus(); }} aria-label="Clear search"><X size={16} /></button>}
          </div>
          <div className="mztv-chips">
            {chip('All', 'All', activeCount)}
            {favCount > 0 && chip('Favourites', '♥ Favourites', favCount)}
            {recentCount > 0 && chip('Recent', 'Recent', recentCount)}
            {groups.map((g) => chip(g.name, null, g.count))}
          </div>
          <div className="mztv-list-wrap">
            {visible.length ? (
              <ul className="mztv-grid">
                {visible.map((c) => (
                  <li key={`${c.i}-${c.url}`} className="mztv-channel">
                    <button type="button" onClick={() => go(c.i)} className={`mztv-channel-main ${c.i === idx ? 'is-active' : ''}`} aria-current={c.i === idx ? 'true' : undefined}>
                      <span className="mztv-channel-no">{String(c.i + 1).padStart(2, '0')}</span>
                      <ChannelLogo channel={c} />
                      <span className="mztv-channel-copy"><b>{c.name}</b><small>{c.i === idx ? (buffering ? 'Buffering...' : 'Playing now') : (c.group || 'Live')}</small></span>
                    </button>
                    <button type="button" onClick={() => toggleFav(c.url)} className={`mztv-channel-fav ${favs.includes(c.url) ? 'is-on' : ''}`} aria-label={favs.includes(c.url) ? `Remove ${c.name} from favourites` : `Add ${c.name} to favourites`} aria-pressed={favs.includes(c.url)}><Heart size={14} fill={favs.includes(c.url) ? 'currentColor' : 'none'} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="mztv-no-results">Koi channel nahi mila.{group !== 'All' ? ' Doosra group chunein.' : ''}</p>}
            {filtered.length > shown && <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="mztv-more">Aur channels ({filtered.length - shown})</button>}
          </div>
        </aside>
      </div>
      {cfg?.demo && <p className="mztv-demo-note">Demo mode: public test streams. Apne channels Admin &gt; Live TV mein add karein.</p>}
    </div>
  );
}
