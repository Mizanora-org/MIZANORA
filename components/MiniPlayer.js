'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useMusic } from '@/components/MusicProvider';
import { songImageSrc } from '@/lib/songs';

// Mizanora v57 — the mini player that follows you across the site.
//
// The audio itself lives in MusicProvider (root layout), so this bar is only controls + now-playing.
// Mobile: sits just above the bottom tab bar (safe-area aware). Desktop: a floating card in the
// bottom-left, like a desktop music app. Hidden on /admin and while nothing is playing.
export default function MiniPlayer() {
  const path = usePathname() || '/';
  const { current, playing, time, dur, volume, muted, loading, error, toggle, next, prev, seek, setVolume, setMuted, stop } = useMusic();

  // Keep the page clear of the bar: a body class adds bottom padding only while music is loaded.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const on = Boolean(current) && !path.startsWith('/admin');
    document.body.classList.toggle('mz-has-player', on);
    return () => document.body.classList.remove('mz-has-player');
  }, [current, path]);

  if (!current || path.startsWith('/admin')) return null;

  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;

  return (
    <div
      role="region"
      aria-label="Now playing"
      className="fixed inset-x-0 bottom-[calc(3.55rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-white/95 shadow-[0_-6px_20px_rgba(18,32,26,.12)] backdrop-blur-md md:inset-x-auto md:bottom-4 md:left-4 md:w-[22rem] md:rounded-2xl md:border md:shadow-2xl"
    >
      <div className="h-0.5 w-full bg-line">
        <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <Link href={current.slug ? `/songs/${current.slug}` : '/songs'} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-raised">
          {songImageSrc(current) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={songImageSrc(current)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-gold"><Music2 size={18} /></span>
          )}
          {loading && (
            <span className="absolute inset-0 grid place-items-center bg-black/45">
              <Loader2 size={16} className="animate-spin text-white" />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={current.slug ? `/songs/${current.slug}` : '/songs'} className="block truncate text-[0.78rem] font-extrabold text-cream hover:text-gold">
            {current.title}
          </Link>
          <p className="truncate text-[0.66rem] font-semibold text-faint">
            {error ? 'Mirror down — Retry' : (current.artists || []).join(', ') || 'Mizanora Songs'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={prev} aria-label="Previous song" className="rounded-full p-1.5 text-dim hover:bg-raised hover:text-gold"><SkipBack size={15} /></button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-9 w-9 place-items-center rounded-full bg-gold text-white shadow"
          >
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button type="button" onClick={next} aria-label="Next song" className="rounded-full p-1.5 text-dim hover:bg-raised hover:text-gold"><SkipForward size={15} /></button>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="hidden rounded-full p-1.5 text-dim hover:bg-raised hover:text-gold sm:block"
          >
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button type="button" onClick={stop} aria-label="Close player" className="rounded-full p-1.5 text-faint hover:bg-raised hover:text-cream"><X size={15} /></button>
        </div>
      </div>

      <div className="hidden items-center gap-2 px-2.5 pb-2 md:flex">
        <span className="w-9 text-right text-[0.6rem] font-bold tabular-nums text-faint">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={1}
          value={Math.min(time, dur || 0)}
          aria-label="Seek"
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 flex-1 accent-[#0B6B45]"
        />
        <span className="w-9 text-[0.6rem] font-bold tabular-nums text-faint">{fmt(dur)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label="Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-12 accent-[#0B6B45]"
        />
      </div>
    </div>
  );
}

function fmt(s) {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
