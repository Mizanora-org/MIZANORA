'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, Camera, Cast, Check, ChevronLeft, ChevronRight, Clock3, Expand, Heart, Keyboard, LayoutGrid, List,
  LoaderCircle, Moon, Pause, PictureInPicture2, Play, Radio, RefreshCw, Rewind, Search, Settings, Share2,
  Shuffle, Tv, Volume1, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import {
  SLEEP_PRESETS, TV_QUALITY, audioLabel, channelHue, channelInitials, filterChannels, formatBitrate,
  latencyLabel, menuLevels, normaliseLevels, qualityLevel, resLabel, sleepClock, sortChannels, streamOrigin,
  subLabel, tvClock, tvStatusLabel, typedChannel,
} from '@/lib/liveTvUi';
import { RELAY_BUDGET, TV_THEMES, channelGroups, channelSlugs, channelSources, channelTarget, pickAd, relayHref, stepIndex, tvTheme, tvRelayAllowed } from '@/lib/liveTv';
import {
  AUTO_AUDIO_ORDER, ENGINE_LABEL, engineCanSwitch, engineChainLabel, engineLadder,
  levelText, modeIndex, normLang, preferredAudioIndex, trackSignature,
} from '@/lib/liveTvTracks';
import LiveBadge from './LiveBadge';

// v49 LIVE TV: the rebuilt player (Tamasha-style channel grid below a big custom screen).
// Everything streams in ONE player: .m3u8 (HLS), .mpd (DASH), .mp4/.webm (plain video),
// .mp3/.aac (audio) and YouTube live, through the signed relay whenever a host says no.
// New here: exact video-resolution capture (1080p/720p... with bitrate, not just "High"),
// real HLS + DASH audio-track and caption/subtitle picking, a stats panel (resolution,
// bandwidth, buffer, live latency, dropped frames) and a photo-capture button that saves
// the current picture. The FULL hls.js build is loaded (not light): embedded CEA-608
// captions and alternate audio live in it. Favourites, recents, auto-skip, backup streams,
// product ads and shareable /live/<channel> links all stay.
let hlsPromise = null;
let HlsCtor = null;
const loadHls = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (HlsCtor) return Promise.resolve(HlsCtor);
  if (!hlsPromise) {
    hlsPromise = import('hls.js')
      .then((m) => { HlsCtor = m.default || m.Hls || null; if (!HlsCtor) hlsPromise = null; return HlsCtor; })
      .catch(() => { hlsPromise = null; return null; }); // a later channel can retry the chunk
  }
  return hlsPromise;
};

let dashPromise = null;
let DashCtor = null;
const loadDash = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (DashCtor) return Promise.resolve(DashCtor);
  if (!dashPromise) {
    dashPromise = import('dashjs')
      .then((m) => { DashCtor = m.default || m.dashjs || null; if (!DashCtor) dashPromise = null; return DashCtor; })
      .catch(() => { dashPromise = null; return null; });
  }
  return dashPromise;
};

// dash.js v5: MediaPlayer is a factory function in some builds and an object in others.
// Ask both shapes politely instead of assuming one (the old single shape silently failed).
const createDash = (Dash) => {
  try {
    if (!Dash || !Dash.MediaPlayer) return null;
    const factory = typeof Dash.MediaPlayer === 'function' ? Dash.MediaPlayer() : Dash.MediaPlayer;
    if (factory && typeof factory.create === 'function') return factory.create();
    if (typeof Dash.MediaPlayer.create === 'function') return Dash.MediaPlayer.create();
  } catch (_) { /* not usable */ }
  return null;
};
const dashEvents = (Dash, player) => (Dash && Dash.MediaPlayer && Dash.MediaPlayer.events) || (player && player.events) || {};

// v29: a stream host that refused a direct connection once (CORS / mixed content / blocked) starts on the relay next time,
// so the visitor does not wait for a failed direct try on every channel switch.
const RELAY_KEY = 'mz_tv_relay_hosts';
const relayHosts = new Set();
const hostOf = (u) => { try { return new URL(String(u || '')).host; } catch (_) { return ''; } };
(() => { try { if (typeof sessionStorage !== 'undefined') JSON.parse(sessionStorage.getItem(RELAY_KEY) || '[]').slice(0, 200).forEach((h) => relayHosts.add(String(h))); } catch (_) { /* blocked */ } })();
const rememberRelay = (u) => { const h = hostOf(u); if (!h || relayHosts.has(h)) return; relayHosts.add(h); try { sessionStorage.setItem(RELAY_KEY, JSON.stringify([...relayHosts].slice(-200))); } catch (_) { /* blocked */ } };
const forgetRelays = (urls) => {
  urls.forEach((url) => relayHosts.delete(hostOf(url)));
  try { sessionStorage.setItem(RELAY_KEY, JSON.stringify([...relayHosts].slice(-200))); } catch (_) { /* blocked */ }
};
// Logos: https only on an https page. An http:// logo is tried as https first; if that fails the Tv icon stays.
const logoSrc = (u) => { const v = String(u || ''); return /^http:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : v; };

const pkr = (n) => `Rs ${Math.max(0, Number(n) || 0).toLocaleString('en-PK')}`;
const readList = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.slice(0, 200) : []; } catch (_) { return []; } };
const writeList = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ } };
const readPref = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (_) { return fallback; } };
const writePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* blocked */ } };
const SKIP_SECONDS = 3;
const STALL_MS = 10000;
const BUFFER_STUCK_MS = 12000; // playing, but frozen on the spinner this long -> recover, then relay, then give up
const MAX_AUTO_SKIPS = 6;
const PAGE_SIZE = 48;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ZAP_MS = 2400; // channel-switch OSD stays this long
const TYPE_MS = 1400; // how long the typed digits wait before the jump
const SHORTCUTS = [
  ['← / →', 'Pichla / agla channel'],
  ['↑ / ↓', 'Awaaz barhayein / kam karein'],
  ['0–9', 'Channel number likh kar jump'],
  ['Space / K', 'Play / pause'],
  ['M', 'Mute'],
  ['L', 'Live edge par wapas'],
  ['C', 'Photo capture'],
  ['P', 'Picture in picture'],
  ['F', 'Full screen'],
  ['R', 'Random channel'],
  ['S', 'Settings panel'],
  ['T', 'Sleep timer (15 min)'],
  ['/ or G', 'Channel search'],
  ['?', 'Yeh shortcuts list'],
];

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

function ChannelLogo({ channel, large = false, tile = false }) {
  const [bad, setBad] = useState(false);
  const src = channel?.logo ? logoSrc(channel.logo) : '';
  useEffect(() => { setBad(false); }, [src]);
  const cls = tile ? 'is-tile' : large ? 'is-large' : '';
  if (!src || bad) {
    return tile
      ? <span className="mztv-logo is-tile is-initials" aria-hidden="true">{channelInitials(channel?.name)}</span>
      : <span className={`mztv-logo ${cls}`} aria-hidden="true"><Tv size={large ? 30 : 17} /></span>;
  }
  return <img src={src} alt="" width={tile ? 96 : large ? 62 : 36} height={tile ? 96 : large ? 62 : 36} className={`mztv-logo has-img ${cls}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
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
  const [relayIndex, setRelayIndex] = useState(-1);
  const [relayReady, setRelayReady] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [theme, setTheme] = useState(() => tvTheme(cfg?.theme));
  const [retryKey, setRetryKey] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [toast, setToast] = useState('');
  const [muted, setMuted] = useState(true); // starts silent: browsers allow instant autoplay
  const [volume, setVolume] = useState(1);
  const [quality, setQuality] = useState('auto'); // saved mode: auto / high / balanced / save
  const [pinLevel, setPinLevel] = useState(null); // exact level pinned for THIS channel
  const [levels, setLevels] = useState([]); // normalised exact resolutions of this stream
  const [curLevel, setCurLevel] = useState(-1); // which level is on screen right now
  const [audios, setAudios] = useState([]); // audio tracks of this stream
  const [audioId, setAudioId] = useState(0);
  const [subs, setSubs] = useState([]); // caption / subtitle tracks
  const [subId, setSubId] = useState(-1); // -1 = off
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [setOpen, setSetOpen] = useState(false);
  const [setTab, setSetTab] = useState('quality');
  const [speed, setSpeed] = useState(1);
  const [statsOn, setStatsOn] = useState(false);
  const [snap, setSnap] = useState(null); // stats snapshot, refreshed every second
  const [behind, setBehind] = useState(0); // seconds behind the live edge
  const [bar, setBar] = useState({ t: 0, d: 0 }); // playback position (VOD seek bar)
  const [view, setView] = useState('grid');
  const [sortMode, setSortMode] = useState('default');
  const [isFs, setIsFs] = useState(false);
  // ---- v52: SIRAVEX-level extras -------------------------------------------------
  const [zap, setZap] = useState(null); // channel-switch OSD { no, name, group, logo }
  const [typing, setTyping] = useState(''); // digits typed for a direct channel jump
  const [hud, setHud] = useState(null); // gesture HUD { kind, value }
  const [helpOpen, setHelpOpen] = useState(false);
  const [sleepMins, setSleepMins] = useState(0); // 0 = off
  const [sleepLeft, setSleepLeft] = useState(0); // seconds
  const [dvr, setDvr] = useState(0); // seconds of timeshift available behind live
  const [canCast, setCanCast] = useState(false);
  // ---- v53: the track engine (quality / audio / captions on every playback engine) --------
  const [engineStep, setEngineStep] = useState(0); // which engine of the ladder is running
  const [engine, setEngine] = useState(''); // 'hls' | 'dash' | 'video' — the one that really played
  const [switching, setSwitching] = useState(''); // 'video' | 'audio' | 'sub' while a switch is pending
  const [audioLatched, setAudioLatched] = useState(false); // the visitor picked audio by hand

  const frame = useRef(null);
  const video = useRef(null);
  const hls = useRef(null);
  const dash = useRef(null);
  const dashReps = useRef([]);
  const dashAudios = useRef([]);
  const searchInput = useRef(null);
  const counter = useRef(1);
  const fails = useRef(0);
  const toastTimer = useRef(null);
  const uiTimer = useRef(null);
  const touch = useRef(null);
  const mutedRef = useRef(muted);
  const adRef = useRef(Boolean(ad));
  const qualityRef = useRef(quality);
  const pinRef = useRef(pinLevel);
  const statusRef = useRef(status);
  const prefsLoaded = useRef(false);
  const stuckStep = useRef(0);
  const sentinel = useRef(null);
  const warmed = useRef(new Set());
  const digits = useRef('');
  const typeTimer = useRef(null);
  const hudTimer = useRef(null);
  const pending = useRef({ video: null, audio: null, sub: null });
  const switchTimer = useRef(null);
  const driftFix = useRef(0);
  const audioManual = useRef(false);
  const audiosRef = useRef([]);
  // v60: how many times this tab has given up on a direct stream (relay budget, see lib/liveTv.js).
  const unlikelyDirectRef = useRef(0);

  const cur = chans[idx] || null;
  const curSlug = slugs[idx] || '';
  const pool = useMemo(() => chans.map((c, i) => ({ ...c, i, slug: slugs[i] })).filter((c) => !c.off), [chans, slugs]);
  const activeCount = pool.length;
  const activeNo = Math.max(1, pool.findIndex((c) => c.i === idx) + 1);
  const sources = useMemo(() => channelSources(cur), [cur]);
  const sourceUrl = sources[sourceIndex] || sources[0] || '';
  const base = useMemo(() => channelTarget(sourceUrl), [sourceUrl]);
  // v60: direct playback first. The relay is used only for an http stream (which the browser cannot
  // play on our https page), a channel the admin marked `proxy`, or a host this tab already learned
  // it cannot play — and never for more than RELAY_BUDGET forced attempts, so a broken channel cannot
  // burn the Hobby plan's origin-transfer allowance (see lib/liveTv.js).
  const relayWanted = relayIndex === idx || Boolean(relayReady && sourceUrl && relayHosts.has(hostOf(sourceUrl)));
  const viaRelay = tvRelayAllowed() && relayWanted && unlikelyDirectRef.current < RELAY_BUDGET;
  const target = useMemo(() => {
    if (!base || !sourceUrl) return null;
    if (base.kind !== 'youtube' && (base.proxy || viaRelay)) return { ...base, src: relayHref(sourceUrl), relayed: true };
    return base;
  }, [base, sourceUrl, viaRelay]);
  const ladder = useMemo(() => engineLadder(target?.kind), [target]);
  const activeEngine = ladder.length ? ladder[Math.min(engineStep, ladder.length - 1)] : '';
  const canSwitchPicture = engineCanSwitch(activeEngine, levels.length);
  const audioTrack = audios[audioId] || null;
  const youtubeSrc = target?.kind === 'youtube' ? `${target.src}&mute=1` : '';
  const statusLabel = tvStatusLabel(status, buffering, target?.kind);
  const filtered = useMemo(
    () => sortChannels(filterChannels(pool, { group, query: deferredQ, favs, recent }), group === 'Recent' ? 'default' : sortMode),
    [pool, group, deferredQ, favs, recent, sortMode],
  );
  const favCount = useMemo(() => pool.filter((c) => favs.includes(c.url)).length, [pool, favs]);
  const recentCount = useMemo(() => pool.filter((c) => recent.includes(c.url)).length, [pool, recent]);
  const canSkip = Boolean(ad) && adSeconds - left >= adSkipAfter;
  const levelCount = levels.length;
  const nowLevel = levels[curLevel] || null;

  const say = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  // Keep the custom control bar awake for a few seconds after the last touch / mouse move.
  const poke = useCallback(() => {
    setShowUi(true);
    if (uiTimer.current) clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => setShowUi(false), 3000);
  }, []);
  useEffect(() => { if (!isPlaying || setOpen || ad) { setShowUi(true); if (uiTimer.current) clearTimeout(uiTimer.current); } else poke(); }, [isPlaying, setOpen, ad, poke]);

  const clearTracks = useCallback(() => {
    setLevels([]); setCurLevel(-1); setPinLevel(null); pinRef.current = null;
    setAudios([]); setAudioId(0); setSubs([]); setSubId(-1); setSnap(null); setBehind(0);
    dashReps.current = []; dashAudios.current = [];
    pending.current = { video: null, audio: null, sub: null };
    audioManual.current = false;
    setAudioLatched(false);
    setSwitching('');
    setEngine('');
    if (switchTimer.current) clearTimeout(switchTimer.current);
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
    setRelayIndex(-1);
    setSourceIndex(0);
    setEngineStep(0);
    stuckStep.current = 0;
    clearTracks();
    digits.current = '';
    setTyping('');
    setIdx(to);
  }, [idx, chans, adsEnabled, adProducts, adSeconds, clearTracks]);

  const next = useCallback(() => go(stepIndex(chans, idx, 1)), [go, chans, idx]);
  const prev = useCallback(() => go(stepIndex(chans, idx, -1)), [go, chans, idx]);
  const random = useCallback(() => {
    const choices = pool.filter((c) => c.i !== idx).map((c) => c.i);
    if (choices.length) go(choices[Math.floor(Math.random() * choices.length)]);
  }, [pool, idx, go]);

  const retry = useCallback(() => {
    fails.current = 0;
    stuckStep.current = 0;
    setRelayIndex(-1);
    setSourceIndex(0);
    setEngineStep(0);
    setStatus('loading');
    setBuffering(false);
    setSkipIn(0);
    clearTracks();
    setRetryKey((n) => n + 1);
    if (cur) forgetRelays(channelSources(cur)); // Retry tries the primary directly, including after a reload
    say('Channel dobara load ho raha hai');
  }, [say, cur, clearTracks]);

  // Try each backup on the same channel before declaring it dead or auto-skipping.
  const advanceSource = useCallback(() => {
    if (sourceIndex + 1 >= sources.length) return false;
    setRelayIndex(-1);
    setSourceIndex(sourceIndex + 1);
    setEngineStep(0);
    setStatus('loading');
    setBuffering(false);
    clearTracks();
    stuckStep.current = 0;
    say(`Backup stream ${sourceIndex + 1} connect ho rahi hai`);
    return true;
  }, [sourceIndex, sources.length, say, clearTracks]);

  const chooseSource = useCallback((n) => {
    if (n < 0 || n >= sources.length || n === sourceIndex) return;
    setRelayIndex(-1); setSourceIndex(n); setEngineStep(0); setStatus('loading'); setBuffering(false);
    setSkipIn(0); fails.current = 0; stuckStep.current = 0;
    clearTracks();
  }, [sourceIndex, sources.length, clearTracks]);

  // ---- v53 track engine: quality / audio / captions, verified on WHICHEVER engine runs ------
  // A switch is only "done" when the engine confirms it. If it ignores us, we ask once more and
  // then tell the truth instead of leaving a tick on a picture that never changed.
  const armSwitch = useCallback((kind, label, retryFn) => {
    setSwitching(kind);
    pending.current[kind] = { at: Date.now(), label, retry: retryFn, tries: 0 };
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      const p = pending.current[kind];
      if (!p) return;
      if (p.tries >= 1) {
        pending.current[kind] = null;
        setSwitching('');
        say(`${label}: is stream ka player is switch ko nahi kar pa raha`);
        return;
      }
      p.tries += 1;
      try { p.retry(); } catch (_) { /* engine gone */ }
    }, 2500);
  }, [say]);

  const settleSwitch = useCallback((kind, message) => {
    if (!pending.current[kind]) return;
    pending.current[kind] = null;
    if (switchTimer.current) clearTimeout(switchTimer.current);
    setSwitching('');
    if (message) say(message);
  }, [say]);

  // Put an exact level (or the current mode) on the engine that is alive right now.
  const switchVideo = useCallback((n) => {
    const h = hls.current;
    if (h && h.levels && h.levels.length) {
      const pinned = n != null;
      // capLevelToPlayerSize silently caps a pinned 1080p down to the player's size - that is the
      // "quality does not track" bug. A manual pin always turns the cap off.
      try { h.autoLevelEnabled = !pinned; } catch (_) { /* hls.js computes it from currentLevel */ }
      try { h.capLevelToPlayerSize = !pinned; } catch (_) { /* older hls.js */ }
      try { if (h.config) h.config.capLevelToPlayerSize = !pinned; } catch (_) { /* older hls.js */ }
      try { h.autoLevelCapping = -1; } catch (_) { /* older hls.js */ }
      try { h.currentLevel = pinned ? n : modeIndex(h.levels, qualityRef.current); } catch (_) { /* ignore */ }
      if (pinned) {
        try { h.nextLevel = n; } catch (_) { /* ignore */ }
        try { h.loadLevel = n; } catch (_) { /* ignore */ }
      }
      return true;
    }
    const p = dash.current;
    const reps = dashReps.current;
    if (p && reps.length && typeof p.setRepresentationForTypeByIndex === 'function') {
      // The mode is resolved from the engine's own representation list (not React state), so this
      // callback stays stable and can be called from a stream effect without reloading the stream.
      const heights = reps.map((r) => ({ height: r.height, bitrate: r.bandwidth }));
      const idx = n != null ? n : modeIndex(heights, qualityRef.current);
      try {
        p.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: idx < 0 } }, buffer: { fastSwitchEnabled: true } } });
        if (idx >= 0 && reps[idx]) p.setRepresentationForTypeByIndex('video', reps[idx].index, true);
      } catch (_) { return false; }
      return true;
    }
    return false;
  }, []);

  const applyQuality = useCallback(() => switchVideo(pinRef.current), [switchVideo]);

  // Audio: hls.js tracks, dash.js tracks, or the browser's own audioTracks (Safari/Firefox).
  const switchAudio = useCallback((n) => {
    const h = hls.current;
    if (h && h.audioTracks && h.audioTracks.length > 1) {
      try { h.audioTrack = n; return 'hls'; } catch (_) { /* try next */ }
    }
    const p = dash.current;
    if (p && dashAudios.current[n] && typeof p.setCurrentTrack === 'function') {
      try { p.setCurrentTrack(dashAudios.current[n]); return 'dash'; } catch (_) { /* try next */ }
    }
    const v = video.current;
    if (v && v.audioTracks && v.audioTracks.length > 1) {
      try {
        for (let i = 0; i < v.audioTracks.length; i++) v.audioTracks[i].enabled = i === n;
        return 'video';
      } catch (_) { /* not supported */ }
    }
    return '';
  }, []);

  // A new stream starts on the language this visitor used on this host (Urdu first, then English).
  const autoPickAudio = useCallback((list) => {
    if (audioManual.current || !Array.isArray(list) || list.length < 2) return;
    const host = hostOf(sourceUrl);
    const saved = host ? readPref(`mz_tv_aud_${host}`, '') : '';
    const want = preferredAudioIndex(list, saved ? [saved, ...AUTO_AUDIO_ORDER] : AUTO_AUDIO_ORDER);
    if (want > 0) {
      setAudioId(want);
      switchAudio(want);
    }
  }, [sourceUrl, switchAudio]);

  const pickMode = useCallback((mode) => {
    setQuality(mode);
    qualityRef.current = mode;
    setPinLevel(null);
    pinRef.current = null;
    const host = hostOf(sourceUrl);
    if (host) writePref(`mz_tv_lvl_${host}`, 'auto'); // this host follows the network again
    const applied = switchVideo(null);
    const label = (TV_QUALITY.find(([v]) => v === mode) || [])[1] || mode;
    // Auto modes are the engine's own job: no confirmation is armed, so no false warning either.
    say(applied ? `Quality: ${label} — engine khud chun raha hai` : `Quality: ${label}`);
  }, [say, sourceUrl, switchVideo]);

  const pickLevel = useCallback((n) => {
    setPinLevel(n);
    pinRef.current = n;
    driftFix.current = 0;
    if (curLevel === n) { setSwitching(''); say(`Picture: ${levels[n] ? levels[n].label : levelText(levels[n])} pehle se chalu hai ✓`); return; }
    const host = hostOf(sourceUrl);
    if (host) writePref(`mz_tv_lvl_${host}`, n); // next time this host opens at the same picture
    setSwitching('video');
    armSwitch('video', 'Picture', () => switchVideo(n)); // armed first: an instant answer still counts
    const applied = switchVideo(n);
    const l = levels[n];
    if (!applied) {
      pending.current.video = null;
      setSwitching('');
      say('Is stream par picture switch nahi ho sakti — browser khud quality chun raha hai');
      return;
    }
    say(`Picture: ${l ? l.label : levelText(l)} — switch ho rahi hai`);
  }, [levels, curLevel, say, sourceUrl, switchVideo, armSwitch]);

  const pickAudio = useCallback((n) => {
    setAudioId(n);
    audioManual.current = true;
    setAudioLatched(true);
    const t = audios[n] || {};
    const host = hostOf(sourceUrl);
    const lang = normLang(t.lang);
    if (host && lang) writePref(`mz_tv_aud_${host}`, lang); // remembered per stream host
    setSwitching('audio');
    armSwitch('audio', 'Awaaz', () => switchAudio(n)); // armed first, so a fast engine is not missed
    const how = switchAudio(n);
    const label = audioLabel(t, n);
    if (!how) {
      pending.current.audio = null;
      setSwitching('');
      say('Is stream mein sirf ek awaaz hai');
      return;
    }
    if (how === 'video') { // the browser confirms at once
      pending.current.audio = null;
      setSwitching('');
      say(`Awaaz: ${label} ✓`);
      return;
    }
    say(`Awaaz badal rahe hain: ${label}`);
  }, [audios, say, sourceUrl, switchAudio, armSwitch]);

  const pickSub = useCallback((n) => {
    setSubId(n);
    const h = hls.current;
    if (h) { try { h.subtitleDisplay = n >= 0; h.subtitleTrack = n; } catch (_) { /* gone */ } }
    const p = dash.current;
    if (p && typeof p.setTextTrack === 'function') { try { p.setTextTrack(n); } catch (_) { /* ignore */ } }
    const v = video.current;
    if (v && v.textTracks) {
      for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = i === n ? 'showing' : 'hidden';
    }
    say(n < 0 ? 'Captions band' : `Captions: ${subLabel(subs[n] || {}, n)}`);
  }, [subs, say]);

  const playNow = useCallback(() => {
    const v = video.current;
    if (!v) return;
    setStatus((s) => (s === 'playing' ? s : 'loading'));
    v.muted = mutedRef.current || adRef.current;
    const p = v.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') setStatus('blocked'); });
  }, []);

  const togglePlay = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) playNow();
    else { try { v.pause(); } catch (_) { /* gone */ } }
  }, [playNow]);

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
      else if (el.requestFullscreen) {
        const p = el.requestFullscreen();
        if (p && p.then) p.then(() => { try { if (window.screen && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (_) { /* desktop */ } }).catch(() => {});
      } else if (video.current && video.current.webkitEnterFullscreen) video.current.webkitEnterFullscreen();
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

  // Save the picture that is on screen right now (the "capture" button).
  const capture = useCallback(() => {
    const v = video.current;
    if (!v || !v.videoWidth) { say('Abhi picture nahi aayi, capture nahi ho sakta'); return; }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { say('Is channel ki picture capture allow nahi (protected stream)'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mizanora-${curSlug || 'live-tv'}-${v.videoWidth}x${v.videoHeight}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        say(`Picture save ho gayi (${v.videoWidth}x${v.videoHeight})`);
      }, 'image/png');
    } catch (_) { say('Is channel ki picture capture allow nahi (protected stream)'); }
  }, [curSlug, say]);

  // ---- v52 actions -----------------------------------------------------------------
  // Timeshift: step back inside the DVR window a live stream publishes (no-op elsewhere).
  const skipBack = useCallback((sec = 30) => {
    const v = video.current;
    if (!v) return;
    let start = 0;
    try { if (v.seekable && v.seekable.length) start = v.seekable.start(0); } catch (_) { /* not seekable */ }
    const want = (Number(v.currentTime) || 0) - Math.abs(sec);
    if (want <= start + 0.3) { say('Is channel par itna peechay jaane ka buffer nahi hai'); return; }
    try { v.currentTime = want; say(`${Math.abs(sec)} second peechay`); } catch (_) { say('Timeshift is channel par available nahi'); }
  }, [say]);

  // Cast to a TV / Chromecast through the browser's Remote Playback API.
  const castTo = useCallback(async () => {
    const v = video.current;
    try {
      if (v && v.remote && typeof v.remote.prompt === 'function') {
        await v.remote.prompt();
        say('Cast device se connect ho rahe hain');
        return;
      }
      say('Is browser mein cast support nahi — Chrome ya Edge try karein');
    } catch (e) {
      if (!e || e.name !== 'NotAllowedError') say('Cast nahi ho saka');
    }
  }, [say]);

  const setSleep = useCallback((mins) => {
    const m = Number(mins) || 0;
    setSleepMins(m);
    setSleepLeft(m * 60);
    if (!m) say('Sleep timer band');
    else say(`Sleep timer: ${m} minute baad playback band ho jayega`);
  }, [say]);

  const bumpSleep = useCallback(() => {
    const next = sleepMins === 90 ? 0 : sleepMins === 0 ? 15 : sleepMins === 15 ? 30 : sleepMins === 30 ? 60 : 90;
    setSleep(next);
  }, [sleepMins, setSleep]);

  const setVol = useCallback((val) => {
    const v = video.current;
    const n = Math.min(1, Math.max(0, Number(val) || 0));
    setVolume(n);
    if (!v) return;
    v.volume = n;
    if (n > 0 && v.muted && !adRef.current) { v.muted = false; setMuted(false); mutedRef.current = false; }
    if (n === 0) { v.muted = true; setMuted(true); mutedRef.current = true; }
  }, []);

  const toggleMuted = useCallback(() => {
    const n = !muted;
    setMuted(n);
    mutedRef.current = n;
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

  // Warm a channel's host before the tap: DNS + connection ready means a faster first picture.
  const warmHost = useCallback((url) => {
    const origin = streamOrigin(url);
    if (!origin || warmed.current.has(origin) || typeof document === 'undefined') return;
    if (window.location.protocol === 'https:' && origin.startsWith('http://')) return;
    warmed.current.add(origin);
    const link = document.createElement('link');
    link.rel = 'preconnect'; link.href = origin; link.crossOrigin = '';
    document.head.appendChild(link);
  }, []);

  // Device preferences + warm the local HLS chunk as soon as the page opens.
  useEffect(() => {
    setFavs(readList('mz_tv_fav'));
    setRecent(readList('mz_tv_recent'));
    setAutoSkip(readPref('mz_tv_autoskip', true) !== false);
    const savedQuality = readPref('mz_tv_quality', 'auto');
    if (TV_QUALITY.some(([v]) => v === savedQuality)) setQuality(savedQuality);
    const savedTheme = readPref('mz_tv_theme', '');
    if (TV_THEMES.some(([v]) => v === savedTheme)) setTheme(savedTheme);
    setStatsOn(readPref('mz_tv_stats', false) === true);
    const savedView = readPref('mz_tv_view', 'grid');
    if (savedView === 'list' || savedView === 'grid') setView(savedView);
    prefsLoaded.current = true;
    setRelayReady(true);
    loadHls();
  }, []);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { adRef.current = Boolean(ad); }, [ad]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { audiosRef.current = audios; }, [audios]);
  useEffect(() => { qualityRef.current = quality; if (prefsLoaded.current) writePref('mz_tv_quality', quality); }, [quality]);
  useEffect(() => { if (prefsLoaded.current) writePref('mz_tv_stats', statsOn); }, [statsOn]);
  useEffect(() => { if (prefsLoaded.current) writePref('mz_tv_view', view); }, [view]);
  useEffect(() => {
    const v = video.current;
    if (v) { v.muted = muted || Boolean(ad); v.volume = volume; }
  }, [muted, ad, volume, target]);
  useEffect(() => { const v = video.current; if (v) v.playbackRate = speed; }, [speed, target]);

  // Open the connection to the current, next and previous stream hosts early.
  const preconnectOrigins = useMemo(() => {
    const nextIndex = stepIndex(chans, idx, 1);
    const prevIndex = stepIndex(chans, idx, -1);
    return [...new Set([sourceUrl, sources[sourceIndex + 1], chans[nextIndex]?.url, chans[prevIndex]?.url].map(streamOrigin).filter(Boolean))].join('|');
  }, [chans, idx, sourceUrl, sources, sourceIndex]);
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

  // Remember the channel, keep the address bar shareable, and tell the phone's lock screen what is on.
  useEffect(() => {
    if (!cur || !curSlug) return;
    setRecent((r) => {
      const v = [cur.url, ...r.filter((u) => u !== cur.url)].slice(0, 20);
      writeList('mz_tv_recent', v);
      return v;
    });
    writePref('mz_tv_last', cur.url); // next visit opens on this channel
    try {
      if (window.location.pathname !== `/live/${curSlug}`) window.history.replaceState(window.history.state, '', `/live/${curSlug}`);
    } catch (_) { /* history blocked */ }
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: cur.name,
          artist: cur.group || 'Mizanora Live TV',
          album: 'Mizanora Live TV',
          artwork: cur.logo ? [{ src: logoSrc(cur.logo), sizes: '256x256' }] : [],
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => next());
        navigator.mediaSession.setActionHandler('play', () => playNow());
        navigator.mediaSession.setActionHandler('pause', () => { try { video.current && video.current.pause(); } catch (_) { /* gone */ } });
      }
    } catch (_) { /* not supported */ }
  }, [idx, cur, curSlug, prev, next, playNow]);

  // Keep the phone awake while a channel is playing on screen (best effort).
  useEffect(() => {
    if (status !== 'playing' || !isPlaying || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null; let stop = false;
    const ask = () => { if (!stop && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {}); };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => { stop = true; document.removeEventListener('visibilitychange', ask); try { lock && lock.release(); } catch (_) { /* gone */ } };
  }, [status, isPlaying]);

  // Ad countdown. The stream can keep loading behind the ad, but stays muted until the ad ends.
  useEffect(() => {
    if (!ad) return undefined;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ad]);
  useEffect(() => { if (ad && left <= 0) setAd(null); }, [ad, left]);

  useEffect(() => {
    if (target?.kind === 'youtube') { setStatus('playing'); setBuffering(false); }
    else if (!target && cur && !advanceSource()) setStatus('failed');
  }, [target, cur, advanceSource]);

  // Native (Safari) track lists: read what the browser exposes once metadata lands.
  const readNativeTracks = useCallback(() => {
    const v = video.current;
    if (!v || hls.current || dash.current) return;
    try {
      if (v.audioTracks && v.audioTracks.length) {
        const list = Array.from(v.audioTracks).map((t, i) => ({ name: t.label || '', lang: t.language || '', default: Boolean(t.enabled), i }));
        setAudios(list);
        const on = list.findIndex((_, i) => v.audioTracks[i].enabled);
        if (on >= 0) setAudioId(on);
        autoPickAudio(list); // the browser's own list (Safari / Firefox)
      }
    } catch (_) { /* not Safari */ }
    try {
      if (v.textTracks && v.textTracks.length) {
        setSubs(Array.from(v.textTracks).map((t, i) => ({ name: t.label || '', lang: t.language || '', i })));
      }
    } catch (_) { /* ignore */ }
  }, [autoPickAudio]);

  // Load one stream. A direct failure switches to the signed relay once; a relay failure shows retry.
  useEffect(() => {
    const v = video.current;
    if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } hls.current = null; }
    if (dash.current) { try { dash.current.reset(); } catch (_) { /* gone */ } dash.current = null; }
    if (!relayReady || !v || !target || target.kind === 'youtube') return undefined;
    const engineNow = activeEngine; // hls | dash | video — this attempt only
    let engineLabel = engineNow; // what actually ended up playing (Safari plays HLS natively)
    if (!engineNow) { setStatus('failed'); return undefined; } // playlist / unsupported protocol
    let dead = false;
    let fallbackStarted = false;
    let failureHandled = false;
    const canRelay = !target.relayed;
    const useRelay = () => {
      if (!canRelay) return false;
      if (fallbackStarted) return true; // another error arrived before React switched the target
      fallbackStarted = true;
      rememberRelay(sourceUrl);
      unlikelyDirectRef.current += 1; // v60: a dead host must not spend the whole relay budget
      setEngineStep(0); // the relay is a fresh start: try the whole ladder again
      setRelayIndex(idx);
      setStatus('loading');
      return true;
    };
    const fail = () => {
      if (dead || failureHandled) return;
      failureHandled = true;
      setBuffering(false);
      // v53: before giving up on the link, try the next playback engine (HLS -> MP4, MP4 -> HLS,
      // DASH -> HLS -> MP4). Many "dead" channels are only a wrong container guess.
      const nextStep = engineStep + 1;
      if (nextStep < ladder.length) {
        setEngineStep(nextStep);
        setStatus('loading');
        return;
      }
      if (!useRelay() && !advanceSource()) setStatus('failed');
    };
    const ok = () => {
      if (dead) return;
      fails.current = 0;
      setBuffering(false);
      setStatus('playing');
      setEngine(engineLabel);
    };
    v.onplaying = ok;
    v.onerror = fail;
    v.onwaiting = () => { if (!dead) setBuffering(true); };
    v.onstalled = () => { if (!dead) setBuffering(true); };
    v.oncanplay = () => { if (!dead) setBuffering(false); };
    v.removeAttribute('src');
    v.load();
    setLevels([]);
    const stall = setTimeout(() => {
      if (dead || statusRef.current !== 'loading' || v.readyState >= 3) return;
      fail();
    }, STALL_MS);

    (async () => {
      if (engineNow === 'dash') {
        const Dash = await loadDash();
        if (dead) return;
        const player = Dash && createDash(Dash);
        if (player) {
          dash.current = player;
          const EV = dashEvents(Dash, player);
          let audioSig = '';
          const readDash = () => {
            if (dead) return;
            try {
              const reps = (player.getRepresentationsByType ? player.getRepresentationsByType('video') : []) || [];
              dashReps.current = reps.map((r, i) => ({ ...r, index: Number.isFinite(r.index) ? r.index : i }));
              setLevels(normaliseLevels(reps.map((r) => ({ height: r.height, width: r.width, bitrate: r.bandwidth || (r.bitrateInKbit || 0) * 1000, frameRate: r.frameRate }))));
              const curRep = player.getCurrentRepresentationForType ? player.getCurrentRepresentationForType('video') : null;
              if (curRep) {
                const at = reps.findIndex((r) => r.id === curRep.id || r.index === curRep.index);
                if (at >= 0) {
                  setCurLevel(at);
                  if (pending.current.video && (pinRef.current == null || pinRef.current === at)) {
                    settleSwitch('video', `Picture: ${resLabel(curRep.height)} chalu hai ✓`);
                  }
                }
              }
              const tracks = (player.getTracksFor ? player.getTracksFor('audio') : []) || [];
              dashAudios.current = tracks;
              const list = tracks.map((t, i) => ({ name: (t.roles && t.roles[0] && (t.roles[0].value || '')) || t.label || '', lang: t.lang || t.language || '', default: Boolean(t.isDefault), i }));
              const sig = trackSignature(list);
              if (sig !== audioSig) {
                audioSig = sig;
                setAudios(list);
                autoPickAudio(list);
              }
              const curAudio = player.getCurrentTrackFor ? player.getCurrentTrackFor('audio') : null;
              if (curAudio) {
                const at = tracks.findIndex((t) => t === curAudio || (t.id != null && t.id === curAudio.id));
                if (at >= 0) {
                  setAudioId(at);
                  if (pending.current.audio) settleSwitch('audio', `Awaaz: ${audioLabel(list[at] || {}, at)} chalu hai ✓`);
                }
              }
              const texts = (player.getTracksFor ? player.getTracksFor('text') : []) || [];
              setSubs(texts.map((t, i) => ({ name: t.label || '', lang: t.lang || t.language || '', i })));
              applyQuality();
            } catch (_) { /* the picture still plays */ }
          };
          try {
            player.updateSettings({ debug: { logLevel: 0 }, streaming: { abr: { autoSwitchBitrate: { video: true, audio: true } }, buffer: { fastSwitchEnabled: true } } });
          } catch (_) { /* defaults are fine */ }
          if (EV.STREAM_INITIALIZED) player.on(EV.STREAM_INITIALIZED, readDash);
          if (EV.REPRESENTATION_SWITCH) player.on(EV.REPRESENTATION_SWITCH, readDash);
          if (EV.ERROR) player.on(EV.ERROR, () => { if (!dead) fail(); });
          if (EV.BUFFER_EMPTY) player.on(EV.BUFFER_EMPTY, () => { if (!dead) setBuffering(true); });
          if (EV.BUFFER_LOADED) player.on(EV.BUFFER_LOADED, () => { if (!dead) setBuffering(false); });
          if (EV.PLAYBACK_PLAYING) player.on(EV.PLAYBACK_PLAYING, ok);
          if (EV.TRACK_CHANGE) player.on(EV.TRACK_CHANGE, () => { if (!dead) readDash(); });
          player.initialize(v, target.src, autoplay);
          return;
        }
        fail(); return;
      }

      if (engineNow === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await loadHls();
        if (dead) return;
        if (Hls && Hls.isSupported()) {
          // Fast first picture + a real live cushion: bandwidth test on the first fragment, a
          // connection-aware starting guess, 30 s ahead (60 s max), retries that stay bounded.
          const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
          const estimate = conn && conn.downlink ? Math.max(500000, Math.min(8000000, Math.round(conn.downlink * 700000))) : 1200000;
          const h = new Hls({
            enableWorker: true, lowLatencyMode: false, startFragPrefetch: true, testBandwidth: false, capLevelToPlayerSize: true,
            abrEwmaDefaultEstimate: estimate, abrEwmaFastLive: 2.5, abrEwmaSlowLive: 6, abrBandWidthFactor: 0.85, abrBandWidthUpFactor: 0.65, startLevel: -1,
            maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: 20, maxBufferHole: 0.5,
            liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 10, maxLiveSyncPlaybackRate: 1.08,
            nudgeOffset: 0.2, nudgeMaxRetry: 6,
            manifestLoadingTimeOut: 8000, manifestLoadingMaxRetry: 1, manifestLoadingRetryDelay: 600,
            levelLoadingTimeOut: 8000, levelLoadingMaxRetry: 3, levelLoadingRetryDelay: 600,
            fragLoadingTimeOut: 15000, fragLoadingMaxRetry: 4, fragLoadingRetryDelay: 500, fragLoadingMaxRetryTimeout: 6000,
          });
          hls.current = h;
          let netTries = 0;
          let mediaTries = 0;
          h.on(Hls.Events.MANIFEST_PARSED, () => {
            if (dead) return;
            setLevels(normaliseLevels(h.levels || []));
            applyQuality();
          });
          h.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
            if (dead || !data || !Number.isFinite(data.level)) return;
            setCurLevel(data.level);
            if (!levels.length && h.levels) setLevels(normaliseLevels(h.levels));
            const want = pinRef.current;
            // A pinned picture that drifted (the cap re-applied or ABR won) is nudged back twice.
            if (want != null && data.level !== want && driftFix.current < 2) {
              driftFix.current += 1;
              try { h.capLevelToPlayerSize = false; h.autoLevelCapping = -1; h.currentLevel = want; h.nextLevel = want; } catch (_) { /* gone */ }
            }
            // Confirm to the visitor only when the engine really landed on the asked level.
            if (pending.current.video && (want == null || data.level === want)) {
              const lvl = h.levels && h.levels[data.level];
              settleSwitch('video', `Picture: ${lvl ? resLabel(lvl.height) : levelText(lvl)} chalu hai ✓`);
            }
          });
          h.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
            if (dead) return;
            const list = ((data && data.audioTracks) || []).map((t, i) => ({ name: t.name || '', lang: t.lang || '', channels: t.attrs && t.attrs.CHANNELS, default: t.default === true || (t.attrs && String(t.attrs.DEFAULT).toUpperCase() === 'YES'), i }));
            setAudios(list);
            if (Number.isFinite(h.audioTrack) && h.audioTrack >= 0) setAudioId(h.audioTrack);
            autoPickAudio(list); // Urdu / remembered language first
          });
          h.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => {
            if (dead || !data || !Number.isFinite(data.id)) return;
            setAudioId(data.id);
            if (pending.current.audio) settleSwitch('audio', `Awaaz: ${audioLabel(audiosRef.current[data.id] || {}, data.id)} chalu hai ✓`);
          });
          h.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
            if (dead) return;
            setSubs(((data && data.subtitleTracks) || []).map((t, i) => ({ name: t.name || '', lang: t.lang || '', i })));
          });
          h.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_e, data) => { if (!dead && data && Number.isFinite(data.id)) setSubId(data.id); });
          h.on(Hls.Events.ERROR, (_event, data) => {
            if (dead || !data || !data.fatal) return;
            // The first playlist could not load directly (CORS / http / blocked): go straight to the relay.
            if (canRelay && /manifestLoadError|manifestLoadTimeOut|manifestParsingError/.test(String(data.details || ''))) { fail(); return; }
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
      engineLabel = 'video'; // the browser's own player
      v.src = target.src;
      if (autoplay) playNow(); else setStatus('ready');
    })();

    return () => {
      dead = true;
      clearTimeout(stall);
      if (dash.current) { try { dash.current.reset(); } catch (_) { /* gone */ } dash.current = null; }
      v.onplaying = null; v.onerror = null; v.onwaiting = null; v.onstalled = null; v.oncanplay = null;
      try { v.pause(); } catch (_) { /* gone */ }
    };
  }, [target, autoplay, retryKey, idx, playNow, advanceSource, sourceUrl, relayReady, applyQuality, activeEngine, engineStep, ladder.length, autoPickAudio, settleSwitch]);

  // A persistent spinner must be checked repeatedly: recover, then relay, then give up.
  useEffect(() => {
    if (status !== 'playing' || !buffering || !target || target.kind === 'youtube' || ad) return undefined;
    const t = setInterval(() => {
      const step = stuckStep.current; stuckStep.current += 1;
      const h = hls.current; const v = video.current;
      if (step === 0) {
        try { if (h) { h.stopLoad(); h.startLoad(-1); } if (v && h && Number.isFinite(h.liveSyncPosition)) v.currentTime = Math.max(0, h.liveSyncPosition - 0.4); if (v) v.play().catch(() => {}); } catch (_) { /* gone */ }
        say('Stream atak gayi thi — dobara jod rahe hain');
      } else if (step === 1 && !target.relayed) {
        rememberRelay(sourceUrl); setRelayIndex(idx); setStatus('loading'); setBuffering(false);
      } else { setBuffering(false); if (!advanceSource()) setStatus('failed'); }
    }, BUFFER_STUCK_MS);
    return () => clearInterval(t);
  }, [status, buffering, target, ad, idx, sourceUrl, say, advanceSource]);
  useEffect(() => { if (status === 'playing' && !buffering) stuckStep.current = 0; }, [status, buffering]);

  // Every second: how far behind live are we, where is the seek bar, and (when asked) the stats.
  useEffect(() => {
    if (!target || target.kind === 'youtube') return undefined;
    const t = setInterval(() => {
      const v = video.current;
      if (!v) return;
      setIsPlaying(!v.paused && !v.ended);
      setBar({ t: v.currentTime || 0, d: Number.isFinite(v.duration) ? v.duration : 0 });
      const h = hls.current;
      let late = h && Number.isFinite(h.latency) ? h.latency : null;
      if (late == null && v.seekable && v.seekable.length) late = v.seekable.end(v.seekable.length - 1) - v.currentTime;
      if (late != null && Number.isFinite(late)) setBehind(Math.max(0, late));
      let room = 0;
      try {
        if (v.seekable && v.seekable.length) {
          const start = v.seekable.start(0);
          room = Math.max(0, (Number(v.currentTime) || 0) - start);
        }
      } catch (_) { /* not seekable */ }
      setDvr(room);
      if (statsOn) {
        let buffered = 0;
        try { if (v.buffered && v.buffered.length) buffered = Math.max(0, v.buffered.end(v.buffered.length - 1) - v.currentTime); } catch (_) { /* ignore */ }
        const q = typeof v.getVideoPlaybackQuality === 'function' ? v.getVideoPlaybackQuality() : null;
        const lvl = (h && h.levels && h.levels[h.currentLevel]) || null;
        setSnap({
          res: v.videoWidth ? `${v.videoWidth}x${v.videoHeight} (${resLabel(v.videoHeight)})` : '-',
          level: nowLevel ? nowLevel.label : (lvl ? `${resLabel(lvl.height)} · ${formatBitrate(lvl.bitrate)}` : '-'),
          bw: h && h.bandwidthEstimate ? formatBitrate(h.bandwidthEstimate) : '',
          buffer: buffered ? `${buffered.toFixed(0)}s` : '0s',
          latency: late != null ? latencyLabel(late) : '-',
          dropped: q ? `${q.droppedVideoFrames}/${q.totalVideoFrames}` : '-',
          codec: lvl ? [lvl.videoCodec, lvl.audioCodec].filter(Boolean).join(' + ') : '',
          audio: audios[audioId] ? audioLabel(audios[audioId], audioId) : 'Default',
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [target, statsOn, nowLevel, audios, audioId]);

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

  // The guide loads more tiles by itself as the visitor scrolls (the button below is the fallback).
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE_SIZE);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, view]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === 'Escape') {
        setSetOpen(false); setHelpOpen(false);
        digits.current = ''; setTyping('');
        return;
      }
      // 0-9: type a channel number, the jump happens on its own after a short pause.
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        digits.current = `${digits.current}${e.key}`.slice(-3);
        setTyping(digits.current);
        if (typeTimer.current) clearTimeout(typeTimer.current);
        typeTimer.current = setTimeout(() => {
          const want = digits.current;
          const at = typedChannel(want, chans.length);
          digits.current = '';
          setTyping('');
          if (at >= 0) go(at);
          else say(`Channel ${Number(want)} maujood nahi (1-${chans.length})`);
        }, TYPE_MS);
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVol(volume + 0.1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVol(volume - 0.1); }
      else if (e.key === '/') { e.preventDefault(); searchInput.current && searchInput.current.focus(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === '?') { e.preventDefault(); setHelpOpen((o) => !o); }
      else {
        const k = String(e.key).toLowerCase();
        if (k === 'f') fullscreen();
        else if (k === 'r') random();
        else if (k === 'm') toggleMuted();
        else if (k === 'l') jumpToLive();
        else if (k === 'k' || k === 'n') togglePlay();
        else if (k === 'c') capture();
        else if (k === 'p') pip();
        else if (k === 't') bumpSleep();
        else if (k === 'g') searchInput.current && searchInput.current.focus();
        else if (k === 's') setSetOpen((to) => !to);
        else if (k === 'b') prev();
        else if (k === ']') next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, fullscreen, random, toggleMuted, jumpToLive, togglePlay, capture, setVol, volume, say, chans.length, go, pip, bumpSleep]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (uiTimer.current) clearTimeout(uiTimer.current);
    if (typeTimer.current) clearTimeout(typeTimer.current);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } }
    if (dash.current) { try { dash.current.reset(); } catch (_) { /* gone */ } dash.current = null; }
  }, []);

  // ---- v52 effects: resume, zap OSD, sleep timer, cast, remembered picture -----------
  // "Last channel" resume happens AFTER hydration (server and browser must render the same
  // first channel, so the jump cannot live in useState).
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    if (initialSlug || !chans.length) return;
    const last = readPref('mz_tv_last', '');
    if (!last) return;
    const j = chans.findIndex((c) => c && c.url === last);
    if (j < 0 || j === idx || chans[j].off) return;
    setSourceIndex(0);
    setRelayIndex(-1);
    setStatus('loading');
    clearTracks();
    setIdx(j);
    say(`Pichla channel khol rahe hain: ${chans[j].name}`);
  }, [chans, initialSlug, idx, say, clearTracks]);

  // A SIRAVEX-style banner every time the channel changes: big number, logo, name.
  useEffect(() => {
    if (!cur) return undefined;
    setZap({ no: idx + 1, name: cur.name, group: cur.group || 'Live', logo: cur.logo || '', hue: channelHue(cur.name) });
    const t = setTimeout(() => setZap(null), ZAP_MS);
    return () => clearTimeout(t);
  }, [idx, cur]);

  // Sleep timer: one interval, a quiet warning at 60 s, then the picture stops.
  useEffect(() => {
    if (!sleepMins) return undefined;
    const t = setInterval(() => setSleepLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sleepMins]);
  useEffect(() => {
    if (!sleepMins) return;
    if (sleepLeft === 60) say('Sleep timer: 1 minute baqi hai');
    if (sleepLeft <= 0) {
      setSleepMins(0);
      const v = video.current;
      try { if (v) v.pause(); } catch (_) { /* gone */ }
      say('Sleep timer: playback band. Good night!');
    }
  }, [sleepLeft, sleepMins, say]);

  // Does this browser expose Remote Playback (Chromecast / TV)?
  useEffect(() => {
    const v = video.current;
    setCanCast(Boolean(v && v.remote && typeof v.remote.prompt === 'function'));
  }, [target, status]);

  // A stream host keeps the picture the visitor chose last time (1080p stays 1080p).
  useEffect(() => {
    if (!levels.length) return;
    const host = hostOf(sourceUrl);
    if (!host) return;
    const saved = readPref(`mz_tv_lvl_${host}`, null);
    if (Number.isInteger(saved) && levels[saved]) {
      setPinLevel(saved);
      pinRef.current = saved;
      applyQuality();
    }
  }, [levels, sourceUrl, applyQuality]);

  // Phones: swipe left/right = channel, swipe up/down = volume, with a big HUD.
  const flashHud = useCallback((obj) => {
    setHud(obj);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), 1100);
  }, []);
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; poke(); };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s || !e.changedTouches[0]) return;
    if (e.target && e.target.closest && e.target.closest('.mztv-bar, .mztv-set, .mztv-ad, .mztv-gate, .mztv-failed, .mztv-help, button, input, select, a')) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 64 && Math.abs(dy) < 60) {
      flashHud({ kind: 'ch', value: dx < 0 ? 1 : -1 });
      if (dx < 0) next(); else prev();
      return;
    }
    if (Math.abs(dy) > 56 && Math.abs(dx) < 60) {
      const to = Math.min(1, Math.max(0, volume + (-dy / 240)));
      setVol(to);
      flashHud({ kind: 'vol', value: to });
      return;
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) poke(); // a plain tap just wakes the bar
  };

  if (!cur) return <div className="mztv-empty">Abhi koi active channel nahi hai.</div>;

  const isFav = favs.includes(cur.url);
  const visible = filtered.slice(0, shown);
  const isVod = target && (target.kind === 'video' || target.kind === 'audio') && bar.d > 0;
  const chip = (name, label, count) => (
    <button key={name} type="button" onClick={() => { setGroup(name); setShown(PAGE_SIZE); }} aria-pressed={group === name} className={`mztv-chip ${group === name ? 'is-on' : ''}`}>
      {label || name}{count != null && <span>{count}</span>}
    </button>
  );
  const ctl = 'mztv-ctl';
  const menuRow = (key, label, on, onClick, hint) => (
    <button key={key} type="button" className={`mztv-set-row ${on ? 'is-on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="mztv-set-label">{label}{hint ? <small>{hint}</small> : null}</span>
      {on && <Check size={15} aria-hidden="true" />}
    </button>
  );

  return (
    <div className="mztv-shell" data-theme={theme}>
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
          {nowLevel && <span className="mztv-badge is-q">{resLabel(nowLevel.height)}</span>}
          {engine && <span className="mztv-badge is-quiet">{ENGINE_LABEL[engine] || engine}</span>}
          {audios.length > 1 && <span className="mztv-badge" title="Awaaz">{audioLabel(audioTrack || {}, audioId).toUpperCase()}</span>}
          <span className={`mztv-badge is-status is-${status}`}><i aria-hidden="true" />{statusLabel}</span>
          <span className="mztv-badge is-quiet"><Activity size={12} aria-hidden="true" />{levelCount ? `${levelCount} LEVELS` : 'ADAPTIVE'}</span>
          {sleepMins > 0 && <span className="mztv-badge is-sleep" title="Sleep timer"><Moon size={12} aria-hidden="true" />{sleepClock(sleepLeft)}</span>}
          <TvClock />
        </div>
      </header>

      <div className="mztv-stage">
        <div
          ref={frame}
          className={`mztv-screen ${showUi ? 'is-ui' : 'is-quiet'}`}
          style={{ aspectRatio: '16 / 9', '--h': channelHue(cur.name) }}
          onMouseMove={poke}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {target?.kind === 'youtube' && (
            <iframe key={youtubeSrc} src={youtubeSrc} title={cur.name} className="mztv-video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          )}
          {target && target.kind !== 'youtube' && (
            <video
              ref={video}
              className="mztv-video"
              playsInline
              preload="auto"
              poster={cur.logo ? logoSrc(cur.logo) : undefined}
              aria-label={`${cur.name} live stream`}
              onClick={togglePlay}
              onDoubleClick={fullscreen}
              onLoadedMetadata={readNativeTracks}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onVolumeChange={() => { const v = video.current; if (v) { setVolume(v.volume); setMuted(Boolean(adRef.current) ? mutedRef.current : v.muted); } }}
            />
          )}
          {!target && <div className="mztv-screen-message"><p>Is channel ka link theek nahi hai.</p><button type="button" onClick={next} className="mztv-inline-btn">Agla channel</button></div>}
          {target && !engineLadder(target.kind).length && (
            <div className="mztv-screen-message">
              <p>
                {target.kind === 'playlist'
                  ? 'Ye playlist (.m3u) ka link hai — player ko seedha stream ka link chahiye.'
                  : `Is link ka protocol (${String(target.scheme || target.kind).toUpperCase()}) kisi browser mein nahi chalta.`}
              </p>
              <p className="mztv-hint">HLS (.m3u8), DASH (.mpd) ya MP4 (.mp4) link dein — player usay chala dega.</p>
              <button type="button" onClick={next} className="mztv-inline-btn">Agla channel</button>
            </div>
          )}
          {target?.kind === 'audio' && (
            <div className="mztv-audio-art" aria-hidden="true">
              <ChannelLogo channel={cur} large />
              <b>{cur.name}</b>
              <span className={`mztv-eq ${isPlaying ? 'is-on' : ''}`}><i /><i /><i /><i /><i /></span>
              <small>Sirf awaaz (audio channel)</small>
            </div>
          )}

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
          <LiveBadge
            state={status === 'playing' && isPlaying ? 'live' : status === 'failed' ? 'warn' : status === 'playing' ? 'idle' : 'soon'}
            label={status === 'playing' ? (isPlaying ? 'LIVE' : 'PAUSED') : status === 'failed' ? 'RETRY' : 'CONNECTING'}
            className="mztv-live-tag"
          />
          {/* channel-switch OSD (SIRAVEX-style zap banner) */}
          {zap && !ad && (
            <div className="mztv-zap" style={{ '--h': zap.hue }} role="status" aria-live="polite">
              <span className="mztv-zap-no">{String(zap.no).padStart(2, '0')}</span>
              <span className="mztv-zap-copy">
                <b>{zap.name}</b>
                <small>{zap.group} · CH {zap.no}/{activeCount}</small>
              </span>
            </div>
          )}
          {typing && (
            <div className="mztv-zap is-typing" role="status" aria-live="polite">
              <span className="mztv-zap-no">{typing}</span>
              <span className="mztv-zap-copy"><b>Channel {typing}</b><small>Enter ka intezar — ya thora rukein</small></span>
            </div>
          )}
          {hud && (
            <div className={`mztv-hud is-${hud.kind}`} role="status" aria-live="polite">
              {hud.kind === 'vol' ? <Volume2 size={26} aria-hidden="true" /> : <Tv size={26} aria-hidden="true" />}
              <b>{hud.kind === 'vol' ? `${Math.round(hud.value * 100)}%` : hud.value > 0 ? 'Agla channel' : 'Pichla channel'}</b>
              {hud.kind === 'vol' && <span className="mztv-hud-bar"><i style={{ width: `${Math.round(hud.value * 100)}%` }} /></span>}
            </div>
          )}

          {target && status === 'failed' && !ad && (
            <div className="mztv-failed">
              <p className="mztv-failed-title">Ye channel abhi nahi chal raha.</p>
              <p>{skipIn > 0 ? `Agla channel ${skipIn} second mein khud lag jayega.` : 'Stream band ho sakti hai ya dusri website par chalne se mana kar rahi hai.'}</p>
              <p className="mztv-failed-engine">Engine: {engineChainLabel(target.kind, engineStep)}{target.relayed ? ' · RELAY' : ''}</p>
              <div className="mztv-failed-actions">
                <button type="button" onClick={retry} className="mztv-inline-btn is-solid"><RefreshCw size={15} /> Retry</button>
                <button type="button" onClick={() => { setEngineStep(0); retry(); }} className="mztv-inline-btn"><Activity size={15} /> Engine dobara</button>
                <button type="button" onClick={next} className="mztv-inline-btn">Agla channel</button>
                <button type="button" onClick={random} className="mztv-inline-btn">Random</button>
              </div>
            </div>
          )}
          {status === 'playing' && buffering && !ad && <div className="mztv-buffer" role="status" aria-label="Buffering"><LoaderCircle size={20} className="mztv-spin" /></div>}

          {statsOn && snap && target && target.kind !== 'youtube' && (
            <div className="mztv-stats" role="status" aria-label="Stream stats">
              <b>Stream capture</b>
              <span>Resolution <em>{snap.res}</em></span>
              <span>Quality <em>{snap.level}</em></span>
              {snap.bw && <span>Speed (andaza) <em>{snap.bw}</em></span>}
              <span>Buffer <em>{snap.buffer} aage</em></span>
              <span>Live se peeche <em>{snap.latency}</em></span>
              <span>Dropped frames <em>{snap.dropped}</em></span>
              {snap.codec && <span>Codec <em>{snap.codec}</em></span>}
              <span>Awaaz <em>{snap.audio}</em></span>
              <span>Engine <em>{ENGINE_LABEL[engine] || engine || ENGINE_LABEL[target.kind] || '-'}</em></span>
              <span>Rasta <em>{target.relayed ? 'Relay' : 'Direct'} · {target.kind.toUpperCase()}</em></span>
            </div>
          )}

          {/* ------- custom control bar ------- */}
          {target && target.kind !== 'youtube' && !ad && (
            <div className="mztv-bar" aria-label="Player controls">
              {isVod && (
                <input
                  type="range" className="mztv-seek" min={0} max={bar.d || 0} step={0.1} value={Math.min(bar.t, bar.d || 0)}
                  aria-label="Seek"
                  onChange={(e) => { const v = video.current; if (v) v.currentTime = Number(e.target.value); }}
                />
              )}
              <div className="mztv-bar-row">
                <button type="button" onClick={togglePlay} className={`${ctl} is-main`} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
                </button>
                <button type="button" onClick={prev} className={ctl} aria-label="Previous channel"><ChevronLeft size={20} /></button>
                <button type="button" onClick={next} className={ctl} aria-label="Next channel"><ChevronRight size={20} /></button>
                <div className="mztv-vol">
                  <button type="button" onClick={toggleMuted} className={ctl} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
                    {muted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input type="range" className="mztv-vol-range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume" onChange={(e) => setVol(e.target.value)} />
                </div>
                {!isVod && status === 'playing' && dvr > 8 && (
                  <button type="button" onClick={() => skipBack(30)} className={`${ctl} is-opt`} aria-label="30 second peechay" title="Timeshift: 30s peechay">
                    <Rewind size={17} /><span className="mztv-ctl-lab">30s</span>
                  </button>
                )}
                {!isVod && status === 'playing' && (
                  <button type="button" onClick={jumpToLive} className={`mztv-live-edge ${behind <= 2.5 ? 'is-edge' : ''}`} aria-label="Jump to live">
                    <Radio size={12} /> {latencyLabel(behind)}
                  </button>
                )}
                <span className="mztv-bar-name"><b>{cur.name}</b><small>{cur.group || 'Live'}</small></span>
                <span className="mztv-bar-gap" />
                {switching && <span className="mztv-bar-q is-switch"><LoaderCircle size={11} className="mztv-spin" aria-hidden="true" /> Switch</span>}
                {nowLevel && <span className="mztv-bar-q">{nowLevel.label}</span>}
                {audios.length > 1 && <span className="mztv-bar-q is-audio" title="Awaaz">{audioLabel(audioTrack || {}, audioId)}</span>}
                <button type="button" onClick={capture} className={`${ctl} is-opt`} aria-label="Capture photo of this picture"><Camera size={17} /></button>
                <button type="button" onClick={() => { setSetOpen((o) => !o); poke(); }} className={`${ctl} ${setOpen ? 'is-on' : ''}`} aria-label="Settings (quality, audio, captions)" aria-expanded={setOpen}><Settings size={18} /></button>
                {canCast && (
                  <button type="button" onClick={castTo} className={`${ctl} is-opt`} aria-label="Cast to TV" title="Cast to TV / Chromecast"><Cast size={17} /></button>
                )}
                <button type="button" onClick={pip} className={`${ctl} is-opt`} aria-label="Picture in picture"><PictureInPicture2 size={17} /></button>
                <button type="button" onClick={fullscreen} className={ctl} aria-label={isFs ? 'Exit full screen' : 'Full screen'}>{isFs ? <X size={18} /> : <Expand size={18} />}</button>
              </div>
            </div>
          )}

          {/* ------- settings: quality capture, audio tracks, captions ------- */}
          {setOpen && target && target.kind !== 'youtube' && (
            <div className="mztv-set" role="dialog" aria-label="Player settings">
              <div className="mztv-set-head">
                <b>Settings</b>
                <button type="button" onClick={() => setSetOpen(false)} aria-label="Close settings"><X size={16} /></button>
              </div>
              <div className="mztv-set-tabs" role="tablist" aria-label="Setting kind">
                {[['quality', 'Quality'], ['audio', 'Awaaz'], ['subs', 'Captions'], ['more', 'More']].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={setTab === id} className={setTab === id ? 'is-on' : ''} onClick={() => setSetTab(id)}>{label}</button>
                ))}
              </div>
              <div className="mztv-set-body">
                {setTab === 'quality' && (
                  <>
                    {TV_QUALITY.map(([v, label]) => menuRow(v, label, pinLevel == null && quality === v, () => pickMode(v),
                      v === 'auto' ? 'Net ke mutabiq sab se tez' : v === 'save' ? 'Kam data' : v === 'high' ? 'Sab se saaf' : 'Darmiyaan'))}
                    {switching === 'video' && <p className="mztv-set-hint"><LoaderCircle size={11} className="mztv-spin" /> Switch ho rahi hai — engine ka intezar...</p>}
                    {menuLevels(levels).length > 0 && <p className="mztv-set-hint">Is channel ki asal resolutions:{pinLevel != null ? ' (aap ka pin is host par yaad rahega)' : ''}</p>}
                    {menuLevels(levels).map((l) => menuRow(`lvl-${l.i}`, l.label, pinLevel === l.i, () => pickLevel(l.i), curLevel === l.i ? `Ab chal rahi hai (${ENGINE_LABEL[engine] || engine})` : ''))}
                    {!levels.length && <p className="mztv-set-hint">Is stream ki resolutions browser khud chunta hai (ek hi quality ya native HLS).</p>}
                    {levels.length > 0 && !canSwitchPicture && <p className="mztv-set-hint">Ye stream browser ke apne player par hai — quality wahan se control hoti hai.</p>}
                  </>
                )}
                {setTab === 'audio' && (
                  audios.length > 1
                    ? (
                      <>
                        {switching === 'audio' && <p className="mztv-set-hint"><LoaderCircle size={11} className="mztv-spin" /> Awaaz switch ho rahi hai...</p>}
                        {audios.map((t, n) => menuRow(`a-${n}`, audioLabel(t, n), audioId === n, () => pickAudio(n), audioTrack && normLang(audioTrack.lang) === normLang(t.lang) && audioId !== n ? 'Isi zubaan ka doosra track' : ''))}
                        <p className="mztv-set-hint">Aap ki chuni hui zubaan is host par yaad rahegi{audioLatched ? ' (manual)' : ''}.</p>
                      </>
                    )
                    : <p className="mztv-set-hint">Is channel mein ek hi awaaz hai. Jin streams mein zyada zubaanain hoti hain (Urdu/English/Arabic), un ki list yahan aati hai — player unhein hls.js, dash.js ya browser se switch karta hai.</p>
                )}
                {setTab === 'subs' && (
                  <>
                    {menuRow('sub-off', 'Band (Off)', subId === -1, () => pickSub(-1))}
                    {subs.map((t, n) => menuRow(`s-${n}`, subLabel(t, n), subId === n, () => pickSub(n)))}
                    {!subs.length && <p className="mztv-set-hint">Is channel ke saath captions nahi bheje gaye.</p>}
                  </>
                )}
                {setTab === 'more' && (
                  <>
                    <p className="mztv-set-hint">Raftaar (video streams ke liye):</p>
                    <div className="mztv-set-speeds">
                      {SPEEDS.map((s) => <button key={s} type="button" className={speed === s ? 'is-on' : ''} onClick={() => { setSpeed(s); say(`Raftaar ${s}x`); }}>{s}x</button>)}
                    </div>
                    <p className="mztv-set-hint">Sleep timer (so jane ke liye):</p>
                    <div className="mztv-set-speeds">
                      {SLEEP_PRESETS.map((m) => (
                        <button key={m} type="button" className={sleepMins === m ? 'is-on' : ''} onClick={() => setSleep(m)}>
                          {m ? `${m}m` : 'Off'}
                        </button>
                      ))}
                    </div>
                    {sleepMins > 0 && <p className="mztv-set-hint">Baqi: {sleepClock(sleepLeft)} — playback khud band ho jayega.</p>}
                    {menuRow('stats', 'Stream stats dikhayein', statsOn, () => setStatsOn(!statsOn), 'Resolution, speed, buffer')}
                    {menuRow('keys', 'Keyboard shortcuts', false, () => { setSetOpen(false); setHelpOpen(true); }, '? dabayein bhi')}
                    {menuRow('sleep15', 'Sleep timer 15 minute', sleepMins === 15, () => setSleep(15), 'T dabayein')}
                    {canCast && menuRow('cast', 'TV / Chromecast par bhejein', false, castTo, 'Browser ka cast')}
                    {dvr > 8 && menuRow('back30', '30 second peechay', false, () => skipBack(30), `Timeshift: ${sleepClock(dvr)} available`)}
                    {menuRow('skip', 'Dead channel khud skip', autoSkip, toggleAutoSkip)}
                    {menuRow('cap', 'Photo capture karein', false, capture, 'Is lamhe ki tasveer save')}
                    {sources.length > 1 && (
                      <>
                        <p className="mztv-set-hint">Stream source:</p>
                        {sources.map((url, i) => menuRow(`src-${i}`, i === 0 ? 'Primary' : `Backup ${i}`, sourceIndex === i, () => chooseSource(i)))}
                      </>
                    )}
                    <label className="mztv-set-select">Theme
                      <select aria-label="Live TV theme" value={theme} onChange={(e) => { const v = tvTheme(e.target.value); setTheme(v); writePref('mz_tv_theme', v); }}>
                        {TV_THEMES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </label>
                    <p className="mztv-set-hint">Keys: ← → channel · 0-9 channel number · Space play · M awaaz · L live · P PiP · T sleep · C photo · F full screen · ? saari keys</p>
                  </>
                )}
              </div>
            </div>
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

        <div className="mztv-under">
          <div className="mztv-under-info">
            <ChannelLogo channel={cur} />
            <span><b>{cur.name}</b><small>{cur.group || 'Live channel'} · CH {activeNo} / {activeCount}{sources.length > 1 ? ` · Source ${sourceIndex + 1}/${sources.length}` : ''}</small></span>
          </div>
          <div className="mztv-under-actions">
            <button type="button" onClick={prev} className="mztv-pill-btn"><ChevronLeft size={16} /> Pichla</button>
            <button type="button" onClick={next} className="mztv-pill-btn is-solid">Agla <ChevronRight size={16} /></button>
            <button type="button" onClick={() => toggleFav(cur.url)} className={`mztv-pill-btn ${isFav ? 'is-fav' : ''}`} aria-pressed={isFav}><Heart size={15} fill={isFav ? 'currentColor' : 'none'} /> {isFav ? 'Pasandeeda' : 'Pasand karein'}</button>
            <button type="button" onClick={random} className="mztv-pill-btn" aria-label="Random channel"><Shuffle size={15} /> Random</button>
            <button type="button" onClick={share} className="mztv-pill-btn" aria-label="Share channel"><Share2 size={15} /> Share</button>
            {target && target.kind !== 'youtube' && <button type="button" onClick={retry} className="mztv-pill-btn" aria-label="Reload channel"><RefreshCw size={15} /> Reload</button>}
          </div>
        </div>
      </div>

      {helpOpen && (
        <div className="mztv-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
          <div className="mztv-help-card">
            <div className="mztv-help-head">
              <span><Keyboard size={18} aria-hidden="true" /><b>Keyboard shortcuts</b></span>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close shortcuts"><X size={18} /></button>
            </div>
            <ul>
              {SHORTCUTS.map(([k, label]) => (
                <li key={k}><kbd>{k}</kbd><span>{label}</span></li>
              ))}
            </ul>
            <p>Phone par: left/right swipe = channel, up/down swipe = awaaz, double-tap = full screen.</p>
          </div>
        </div>
      )}

      <section className="mztv-guide" aria-label="Channel guide">
        <div className="mztv-guide-head">
          <div><span>CHANNELS</span><h2>{activeCount} live channels</h2></div>
          <div className="mztv-guide-tools">
            <div className="mztv-search">
              <Search size={16} aria-hidden="true" />
              <input ref={searchInput} value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE_SIZE); }} onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) go(filtered[0].i); if (e.key === 'Escape') setQ(''); }} placeholder="Channel search karein..." aria-label="Search channels" />
              {q && <button type="button" onClick={() => { setQ(''); searchInput.current && searchInput.current.focus(); }} aria-label="Clear search"><X size={15} /></button>}
            </div>
            <label className="mztv-sort"><span className="mztv-sort-lab">Sort</span>
              <select aria-label="Sort channels" value={sortMode} onChange={(e) => { setSortMode(e.target.value); setShown(PAGE_SIZE); }}>
                <option value="default">Default</option>
                <option value="az">Naam A-Z</option>
                <option value="group">Group ke hisaab se</option>
              </select>
            </label>
            <div className="mztv-view-toggle" role="group" aria-label="Guide view">
              <button type="button" className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><LayoutGrid size={16} /></button>
              <button type="button" className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'}><List size={16} /></button>
            </div>
          </div>
        </div>
        <div className="mztv-chips">
          {chip('All', 'All', activeCount)}
          {favCount > 0 && chip('Favourites', '♥ Favourites', favCount)}
          {recentCount > 0 && chip('Recent', 'Recent', recentCount)}
          {groups.map((g) => chip(g.name, null, g.count))}
        </div>

        {visible.length ? (
          view === 'grid' ? (
            <ul className="mztv-tiles">
              {visible.map((c) => {
                const active = c.i === idx;
                const fav = favs.includes(c.url);
                return (
                  <li key={`${c.i}-${c.url}`} className={`mztv-tile ${active ? 'is-active' : ''}`} style={{ '--h': channelHue(c.name) }}>
                    <button
                      type="button"
                      onClick={() => go(c.i)}
                      onMouseEnter={() => warmHost(c.url)}
                      onTouchStart={() => warmHost(c.url)}
                      className="mztv-tile-main"
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className="mztv-tile-top">
                        <span className="mztv-tile-live"><i aria-hidden="true" />LIVE</span>
                        <span className="mztv-tile-no">CH {c.i + 1}</span>
                      </span>
                      <ChannelLogo channel={c} tile />
                      <span className="mztv-tile-play" aria-hidden="true">{active
                        ? <span className={`mztv-eq ${isPlaying ? 'is-on' : ''}`}><i /><i /><i /><i /></span>
                        : <Play size={17} fill="currentColor" />}</span>
                      <span className="mztv-tile-copy">
                        <b>{c.name}</b>
                        <small>{active ? (buffering ? 'Buffering...' : isPlaying ? 'Ab chal raha hai' : 'Ruka hua') : (c.group || 'Live')}</small>
                      </span>
                    </button>
                    <button type="button" onClick={() => toggleFav(c.url)} className={`mztv-tile-fav ${fav ? 'is-on' : ''}`} aria-label={fav ? `Remove ${c.name} from favourites` : `Add ${c.name} to favourites`} aria-pressed={fav}><Heart size={14} fill={fav ? 'currentColor' : 'none'} /></button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="mztv-rows">
              {visible.map((c) => {
                const active = c.i === idx;
                const fav = favs.includes(c.url);
                return (
                  <li key={`${c.i}-${c.url}`} className={`mztv-row ${active ? 'is-active' : ''}`}>
                    <button type="button" onClick={() => go(c.i)} onMouseEnter={() => warmHost(c.url)} className="mztv-row-main" aria-current={active ? 'true' : undefined}>
                      <span className="mztv-row-no">{String(c.i + 1).padStart(2, '0')}</span>
                      <ChannelLogo channel={c} />
                      <span className="mztv-row-copy"><b>{c.name}</b><small>{active ? (buffering ? 'Buffering...' : 'Playing now') : (c.group || 'Live')}</small></span>
                      <span className="mztv-row-live"><i aria-hidden="true" />LIVE</span>
                    </button>
                    <button type="button" onClick={() => toggleFav(c.url)} className={`mztv-row-fav ${fav ? 'is-on' : ''}`} aria-label={fav ? `Remove ${c.name} from favourites` : `Add ${c.name} to favourites`} aria-pressed={fav}><Heart size={14} fill={fav ? 'currentColor' : 'none'} /></button>
                  </li>
                );
              })}
            </ul>
          )
        ) : <p className="mztv-no-results">Koi channel nahi mila.{group !== 'All' ? ' Doosra group chunein.' : ''}</p>}

        <div ref={sentinel} aria-hidden="true" />
        {filtered.length > shown && <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="mztv-more">Aur channels ({filtered.length - shown})</button>}
        <p className="mztv-guide-foot"><Zap size={12} aria-hidden="true" /> Channel par hath rakhein ya tap karein — connection pehle se garam ho jata hai, picture foran aati hai.</p>
      </section>
      {cfg?.demo && <p className="mztv-demo-note">Demo mode: public test streams. Apne channels Admin &gt; Live TV mein add karein.</p>}
    </div>
  );
}
