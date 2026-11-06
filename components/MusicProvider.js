'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Mizanora v57 — ONE audio element for the whole site.
//
// Before this, every songs screen had its own <audio>. Two consequences people complained about:
//   * navigation killed the music (the page unmounts, the element disappears),
//   * playing from /songs and opening a song page gave you two players fighting.
//
// Now a single <audio> lives in the root layout (it never unmounts), and every screen is just a set
// of buttons that talk to it. That is what "background play" actually means on the web: the sound
// keeps going while the visitor browses the shop, the Quran, a movie page — and on Android/iOS the
// lock-screen controls work too, through the Media Session API.
//
// The source chain is the v56 one: our own resolver (/api/songs/audio/<id>), then the byte proxy,
// then the raw CDN link. If all three fail we say so instead of pretending to play.

const Ctx = createContext(null);

const MediaMeta = typeof window !== 'undefined' ? window.MediaMetadata : null;

const sourcesFor = (song) => {
  if (!song) return [];
  // v58 order: the CDN files we already know about, proxied through our own domain (instant, range
  // requests work, no mirror round-trip) → our resolver (fresh token) → resolver proxy → raw link.
  // The resolver stays in the chain because a queue restored from localStorage can hold expired URLs.
  return [...new Set([
    ...(Array.isArray(song.audioSources) ? song.audioSources : []),
    song.playUrl,
    song.proxyUrl,
    song.stream,
  ].filter(Boolean))];
};

export function MusicProvider({ children }) {
  const audio = useRef(null);
  const chain = useRef({ song: null, list: [], i: 0 });
  const [current, setCurrent] = useState(null);
  const [queue, setQueue] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const index = useMemo(
    () => (current ? queue.findIndex((s) => s && s.id === current.id) : -1),
    [current, queue],
  );

  const attach = useCallback((song) => {
    const el = audio.current;
    if (!el || !song) return false;
    const list = sourcesFor(song);
    chain.current = { song, list, i: 0 };
    if (!list.length) {
      setError('Is song ka audio link maujood nahi.');
      setLoading(false);
      return false;
    }
    setError('');
    setLoading(true);
    el.src = list[0];
    el.load();
    return true;
  }, []);

  const play = useCallback((song, list) => {
    const el = audio.current;
    if (!el || !song) return;
    const nextQueue = Array.isArray(list) && list.length ? list : [song];
    setQueue(nextQueue);
    if (current && current.id === song.id && el.src) {
      if (el.paused) el.play().catch(() => setError('Play nahi hua — dobara dabayein.'));
      else el.pause();
      return;
    }
    setCurrent(song);
    setTime(0);
    setDur(Number(song.duration) || 0);
    if (attach(song)) el.play().catch(() => { setLoading(false); });
  }, [current, attach]);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (!current) return;
    if (el.paused) el.play().catch(() => setError('Play nahi hua — dobara dabayein.'));
    else el.pause();
  }, [current]);

  const step = useCallback((dir) => {
    if (!queue.length) return;
    const at = index < 0 ? 0 : index;
    const next = queue[(at + dir + queue.length) % queue.length];
    if (!next) return;
    setCurrent(next);
    setTime(0);
    setDur(Number(next.duration) || 0);
    if (attach(next)) {
      const el = audio.current;
      if (el) el.play().catch(() => {});
    }
  }, [queue, index, attach]);

  const seek = useCallback((to) => {
    const el = audio.current;
    if (!el) return;
    const t = Math.max(0, Math.min(Number(to) || 0, el.duration || dur || 0));
    el.currentTime = t;
    setTime(t);
  }, [dur]);

  const setVolume = useCallback((v) => {
    const el = audio.current;
    const value = Math.max(0, Math.min(1, Number(v) || 0));
    setVolumeState(value);
    setMutedState(value === 0);
    if (el) { el.volume = value; el.muted = value === 0; }
  }, []);

  const setMuted = useCallback((m) => {
    const el = audio.current;
    setMutedState(Boolean(m));
    if (el) el.muted = Boolean(m);
  }, []);

  const stop = useCallback(() => {
    const el = audio.current;
    if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
    setCurrent(null);
    setQueue([]);
    setPlaying(false);
    setTime(0);
    setDur(0);
    chain.current = { song: null, list: [], i: 0 };
  }, []);

  // Source chain: our route → proxy → raw CDN. Only after all three fail do we show an error.
  const onError = useCallback(() => {
    const el = audio.current;
    const c = chain.current;
    if (!el || !c.song) return;
    if (c.i + 1 < c.list.length) {
      c.i += 1;
      el.src = c.list[c.i];
      el.load();
      el.play().catch(() => {});
      return;
    }
    setPlaying(false);
    setLoading(false);
    setError('Music mirror jawab nahi de raha. Retry karein ya YouTube par sunein.');
  }, []);

  // Media Session: lock screen / notification controls + headset buttons.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !current) return;
    const rawArt = current.imageSrc || current.image || '';
    const art = rawArt
      ? [{ src: /^https?:/i.test(rawArt) ? rawArt : `${typeof location !== 'undefined' ? location.origin : ''}${rawArt}`, sizes: '512x512', type: 'image/jpeg' }]
      : [];
    try {
      if (MediaMeta) {
        navigator.mediaSession.metadata = new MediaMeta({
          title: current.title || 'Mizanora',
          artist: (current.artists || []).join(', ') || 'Mizanora Songs',
          album: current.album || 'Mizanora',
          artwork: art,
        });
      }
      navigator.mediaSession.setActionHandler('play', () => { const el = audio.current; if (el) el.play().catch(() => {}); });
      navigator.mediaSession.setActionHandler('pause', () => { const el = audio.current; if (el) el.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
      navigator.mediaSession.setActionHandler('seekto', (d) => { if (d && typeof d.seekTime === 'number') seek(d.seekTime); });
    } catch { /* older browsers */ }
  }, [current, step, seek]);

  // Remember the last song (not autoplay): the mini player can offer it again after a reload.
  useEffect(() => {
    if (!current) return;
    try {
      const slim = (s) => ({
        id: s.id, slug: s.slug, title: s.title, artists: s.artists, album: s.album,
        image: s.image, imageSrc: s.imageSrc, duration: s.duration,
        playUrl: s.playUrl, proxyUrl: s.proxyUrl, stream: s.stream, audioSources: s.audioSources,
      });
      localStorage.setItem('mz_last_song', JSON.stringify(slim(current)));
      localStorage.setItem('mz_last_queue', JSON.stringify((queue.length ? queue : [current]).slice(0, 30).map(slim)));
    } catch { /* private mode */ }
  }, [current, queue]);

  const value = useMemo(() => ({
    current, queue, index, playing, time, dur, volume, muted, loading, error,
    play, toggle, next: () => step(1), prev: () => step(-1), seek, setVolume, setMuted, stop,
    setQueue, setError, clearError: () => setError(''),
  }), [current, queue, index, playing, time, dur, volume, muted, loading, error, play, toggle, step, seek, setVolume, setMuted, stop]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => { setPlaying(true); setLoading(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || Number(current && current.duration) || 0)}
        onEnded={() => step(1)}
        onError={onError}
        className="hidden"
      />
    </Ctx.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // A component rendered outside the provider (tests, admin preview) gets a harmless stub.
    return {
      current: null, queue: [], playing: false, time: 0, dur: 0, volume: 1, muted: false,
      loading: false, error: '', play: () => {}, toggle: () => {}, next: () => {}, prev: () => {},
      seek: () => {}, setVolume: () => {}, setMuted: () => {}, stop: () => {}, clearError: () => {},
    };
  }
  return ctx;
}

export default MusicProvider;
