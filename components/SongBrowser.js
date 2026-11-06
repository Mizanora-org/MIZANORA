'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Disc3, LoaderCircle, Music2, Pause, Play, Search, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { artistSlug, clockTime } from '@/lib/songs';
import { searchSongsDirect } from '@/lib/songsClient';

// v54 — the Songs browser: search anything, press play, keep listening while you scroll.
export default function SongBrowser({ initialSongs = [], topics = [], initialQuery = '' }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState(initialSongs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);

  const audio = useRef(null);
  const reqId = useRef(0);
  // v56: the audio source chain — Mizanora route → upstream proxy → raw CDN link.
  const chain = useRef({ song: null, list: [], i: 0 });

  const runSearch = useCallback(async (query) => {
    const text = String(query || '').trim();
    const id = reqId.current + 1;
    reqId.current = id;
    setError('');
    setNotice('');
    if (!text) { setItems(initialSongs); setLoading(false); return; }
    setLoading(true);
    let items = [];
    let upstreamDown = false;
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(text)}&limit=30`, { cache: 'no-store' });
      const data = await res.json();
      if (reqId.current !== id) return; // a newer keystroke already won
      items = Array.isArray(data.items) ? data.items : [];
      upstreamDown = data.upstream === 'down' || !items.length;
    } catch {
      upstreamDown = true;
    }

    // v55: the server could not reach a mirror (preview sandbox / outage) — the browser tries
    // the same mirrors directly before giving up, because a visit often works when the server does not.
    if (upstreamDown) {
      try {
        const direct = await searchSongsDirect(text, 30);
        if (reqId.current !== id) return;
        if (direct.items.length) {
          items = direct.items;
          setNotice('Mirror se seedha load hua (browser).');
        }
      } catch { /* keep whatever the server gave us */ }
    }

    if (reqId.current !== id) return;
    setItems(items);
    if (!items.length) setError('Kuch nahi mila. Naam check karein, ya thori dair baad Retry dabayein.');
    setLoading(false);
  }, [initialSongs]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 420);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  // Nothing came back from the server (offline preview / mirror down) — try the default seed once.
  useEffect(() => {
    if (initialSongs.length) return;
    const seed = topics[0] || 'Atif Aslam';
    let alive = true;
    (async () => {
      setLoading(true);
      const direct = await searchSongsDirect(seed, 24).catch(() => ({ items: [] }));
      if (!alive) return;
      if (direct.items.length) { setItems(direct.items); setNotice('Mirror se seedha load hua (browser).'); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [initialSongs.length, topics]);

  const attach = useCallback((song) => {
    const el = audio.current;
    if (!el || !song) return;
    const list = [song.playUrl, song.proxyUrl, song.stream].filter(Boolean);
    chain.current = { song, list: [...new Set(list)], i: 0 };
    if (!chain.current.list.length) {
      setError('Is song ka audio link maujood nahi — doosra gaana chunein.');
      return;
    }
    el.src = chain.current.list[0];
    el.load();
    el.play().catch(() => setPlaying(false));
  }, []);

  const play = useCallback((song) => {
    const el = audio.current;
    if (!el || !song) return;
    if (current && current.id === song.id) {
      if (el.paused) { el.play().catch(() => { setError('Play nahi hua — dobara dabayein.'); }); } else { el.pause(); }
      return;
    }
    setError('');
    setCurrent(song);
    attach(song);
  }, [current, attach]);

  // If our route cannot resolve the song (mirror down), try the proxy, then the raw CDN link.
  const onAudioError = useCallback(() => {
    const el = audio.current;
    const c = chain.current;
    if (!el || !c.song) return;
    if (c.i + 1 < c.list.length) {
      c.i += 1;
      el.src = c.list[c.i];
      el.load();
      el.play().catch(() => setPlaying(false));
      return;
    }
    setPlaying(false);
    setError('Ye song abhi play nahi ho raha — music mirror jawab nahi de raha. Retry karein ya YouTube par sunein.');
  }, []);

  const step = useCallback((dir) => {
    if (!current || !items.length) return;
    const at = items.findIndex((s) => s.id === current.id);
    const next = items[(at + dir + items.length) % items.length];
    if (next) play(next);
  }, [current, items, play]);

  const toggle = () => {
    const el = audio.current;
    if (!el || !current) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4">
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-line bg-raised px-4 py-2.5">
            <Search size={16} className="text-faint" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Song, artist ya film ka naam likhein — Atif Aslam, Coke Studio…"
              aria-label="Search songs"
              className="w-full bg-transparent text-sm font-semibold text-cream outline-none placeholder:text-faint"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-faint hover:text-gold">
                <X size={15} />
              </button>
            )}
          </label>
          {loading && <LoaderCircle size={18} className="animate-spin text-gold" aria-label="Searching" />}
        </div>

        {topics.length > 0 && (
          <div className="no-sb mt-3 flex gap-2 overflow-x-auto pb-1">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQ(t)}
                className="shrink-0 rounded-full border border-line bg-raised px-3 py-1.5 text-[0.7rem] font-extrabold text-dim transition hover:border-gold hover:text-gold"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {notice && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{notice}</p>}
      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => runSearch(q || topics[0] || 'Atif Aslam')} className="rounded-full bg-amber-800 px-3 py-1 text-xs font-extrabold text-white">Retry</button>
          <Link href="/admin/songs" className="rounded-full border border-amber-300 px-3 py-1 text-xs font-extrabold text-amber-900">Mirror status</Link>
        </div>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <li key={s.id} className={`group flex items-center gap-3 rounded-2xl border p-2.5 transition ${current && current.id === s.id ? 'border-gold bg-gold/5' : 'border-line bg-surface hover:border-gold'}`}>
            <button
              type="button"
              onClick={() => play(s)}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-raised"
              aria-label={`Play ${s.title}`}
            >
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-gold"><Music2 size={20} /></span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                {current && current.id === s.id && playing ? <Pause size={18} className="text-white" /> : <Play size={18} fill="currentColor" className="text-white" />}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <Link href={`/songs/${s.slug}`} className="line-clamp-1 font-display text-sm font-extrabold text-cream hover:text-gold">
                {s.title}
              </Link>
              <p className="line-clamp-1 text-[0.7rem] font-semibold text-dim">
                {s.artists && s.artists.length ? (
                  <Link href={`/songs/artist/${artistSlug(s.artists[0])}`} className="hover:text-gold">{s.artists.join(', ')}</Link>
                ) : 'Unknown artist'}
                {s.album ? ` · ${s.album}` : ''}
              </p>
              <p className="mt-0.5 text-[0.64rem] font-bold text-faint">
                {clockTime(s.duration)}{s.language ? ` · ${s.language}` : ''}{s.year ? ` · ${s.year}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {!items.length && !loading && !error && (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center text-sm text-dim">
          Koi song nahi mila.
        </p>
      )}

      {/* sticky player */}
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => step(1)}
        onError={onAudioError}
      />

      {current && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-4">
            {current.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : <span className="grid h-12 w-12 place-items-center rounded-lg bg-raised text-gold"><Disc3 size={20} /></span>}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-extrabold text-cream">{current.title}</p>
              <p className="line-clamp-1 text-[0.65rem] font-semibold text-dim">{(current.artists || []).join(', ')}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[0.6rem] font-bold tabular-nums text-faint">{clockTime(time)}</span>
                <input
                  type="range" min={0} max={dur || 0} step={1} value={Math.min(time, dur || 0)}
                  aria-label="Seek song"
                  onChange={(e) => { const el = audio.current; if (el) el.currentTime = Number(e.target.value); }}
                  className="h-1 flex-1 accent-[#0B6B45]"
                />
                <span className="text-[0.6rem] font-bold tabular-nums text-faint">{clockTime(dur)}</span>
              </div>
            </div>
            <button type="button" onClick={() => step(-1)} aria-label="Previous song" className="hidden rounded-full p-2 text-dim hover:text-gold sm:block"><SkipBack size={17} /></button>
            <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="grid h-10 w-10 place-items-center rounded-full bg-gold text-white">
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next song" className="rounded-full p-2 text-dim hover:text-gold"><SkipForward size={17} /></button>
            <button
              type="button"
              onClick={() => { const el = audio.current; if (!el) return; const m = !muted; setMuted(m); el.muted = m; }}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="hidden rounded-full p-2 text-dim hover:text-gold sm:block"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
              aria-label="Volume"
              onChange={(e) => { const v = Number(e.target.value); setVol(v); setMuted(v === 0); const el = audio.current; if (el) { el.volume = v; el.muted = v === 0; } }}
              className="hidden h-1 w-20 accent-[#0B6B45] lg:block"
            />
            <button
              type="button"
              onClick={() => { const el = audio.current; if (el) el.pause(); setCurrent(null); setPlaying(false); }}
              aria-label="Close player"
              className="rounded-full p-2 text-faint hover:text-rose-600"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
