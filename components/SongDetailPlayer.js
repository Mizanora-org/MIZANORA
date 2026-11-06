'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { clockTime } from '@/lib/songs';

// v54 — the song page player: artwork, seek, volume and next/previous inside the queue.
export default function SongDetailPlayer({ song, queue = [] }) {
  const audio = useRef(null);
  const chain = useRef({ song: null, list: [], i: 0 });
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(Number(song && song.duration) || 0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(song);
  const [failed, setFailed] = useState(false);

  const attach = (target) => {
    const el = audio.current;
    if (!el || !target) return;
    const list = [target.playUrl, target.proxyUrl, target.stream].filter(Boolean);
    chain.current = { song: target, list: [...new Set(list)], i: 0 };
    if (!chain.current.list.length) { setFailed(true); return; }
    el.src = chain.current.list[0];
    el.load();
  };

  useEffect(() => {
    setCurrent(song);
    setTime(0);
    setDur(Number(song && song.duration) || 0);
    setFailed(false);
    attach(song);
  }, [song]);

  // v56: Mizanora route → upstream proxy → raw CDN link. Only after all three fail do we say so.
  const onAudioError = () => {
    const el = audio.current;
    const c = chain.current;
    if (el && c.song && c.i + 1 < c.list.length) {
      c.i += 1;
      el.src = c.list[c.i];
      el.load();
      el.play().catch(() => setPlaying(false));
      return;
    }
    setFailed(true);
    setReady(false);
  };

  const list = queue.length ? queue : song ? [song] : [];
  const at = Math.max(0, list.findIndex((s) => s && current && s.id === current.id));
  const go = (dir) => {
    if (list.length < 2) return;
    const next = list[(at + dir + list.length) % list.length];
    if (next) {
      setCurrent(next);
      setFailed(false);
      attach(next);
      const el = audio.current;
      if (el) el.play().catch(() => setPlaying(false));
    }
  };

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setFailed(true));
    else el.pause();
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        <div className="mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-2xl bg-raised shadow-lg sm:mx-0 sm:h-52 sm:w-52">
          {current && current.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.image}
              alt={current.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('mz-cover-dead'); }}
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-gold"><Music2 size={44} /></span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Now playing</p>
          <h2 className="mt-1 line-clamp-2 font-display text-2xl font-extrabold text-cream">{current && current.title}</h2>
          <p className="mt-1 text-sm font-semibold text-dim">{(current && current.artists || []).join(', ') || 'Unknown artist'}</p>
          <p className="mt-0.5 text-xs font-bold text-faint">
            {current && current.album ? `${current.album} · ` : ''}{current && current.year ? `${current.year} · ` : ''}{current && current.language ? current.language : ''}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className="w-10 text-right text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(time)}</span>
            <input
              type="range" min={0} max={dur || 0} step={1} value={Math.min(time, dur || 0)}
              aria-label="Seek song"
              onChange={(e) => { const el = audio.current; if (el) el.currentTime = Number(e.target.value); }}
              className="h-1.5 flex-1 accent-[#0B6B45]"
            />
            <span className="w-10 text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(dur)}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous song" className="rounded-full border border-line p-2.5 text-dim hover:border-gold hover:text-gold">
              <SkipBack size={17} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              className="grid h-12 w-12 place-items-center rounded-full bg-gold text-white shadow transition hover:brightness-95"
            >
              {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next song" className="rounded-full border border-line p-2.5 text-dim hover:border-gold hover:text-gold">
              <SkipForward size={17} />
            </button>
            <span className="mx-1 h-6 w-px bg-line" />
            <button
              type="button"
              onClick={() => { const el = audio.current; if (!el) return; const m = !muted; setMuted(m); el.muted = m; }}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="rounded-full border border-line p-2.5 text-dim hover:border-gold hover:text-gold"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
              aria-label="Volume"
              onChange={(e) => { const v = Number(e.target.value); setVol(v); setMuted(v === 0); const el = audio.current; if (el) { el.volume = v; el.muted = v === 0; } }}
              className="h-1.5 w-24 accent-[#0B6B45]"
            />
            {current && current.id !== (song && song.id) && (
              <Link href={`/songs/${current.slug}`} className="ml-auto text-xs font-extrabold text-gold hover:underline">
                Is song ka page
              </Link>
            )}
          </div>

          {failed && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              <p>Ye track abhi stream nahi ho raha — music mirror jawab nahi de raha.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFailed(false); attach(current); const el = audio.current; if (el) el.play().catch(() => {}); }}
                  className="rounded-full bg-amber-600 px-3 py-1 text-[0.68rem] font-extrabold text-white"
                >
                  Retry
                </button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${current?.title || ''} ${(current?.artists || []).join(' ')}`.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-amber-600/40 px-3 py-1 text-[0.68rem] font-extrabold text-amber-800"
                >
                  YouTube par sunein
                </a>
              </div>
            </div>
          )}
          {!current?.hasStream && <p className="mt-3 text-xs font-semibold text-faint">Is song ka audio link maujood nahi — neeche queue se doosra gaana chunein.</p>}
        </div>
      </div>

      <audio
        ref={audio}
        preload="metadata"
        onCanPlay={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || Number(current && current.duration) || 0)}
        onEnded={() => go(1)}
        onError={onAudioError}
      />
      <p className="border-t border-line px-5 py-2 text-[0.65rem] font-semibold text-faint">
        {ready ? 'Audio ready · 320kbps jahan available ho' : 'Audio load ho raha hai…'} · Music third-party catalogue se aata hai, personal listening ke liye.
      </p>
    </div>
  );
}
