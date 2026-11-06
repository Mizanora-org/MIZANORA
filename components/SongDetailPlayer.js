'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { clockTime } from '@/lib/songs';
import { useMusic } from '@/components/MusicProvider';

// Mizanora v57 — the song page player.
//
// It no longer owns an <audio> element: the sound comes from the root MusicProvider, so opening this
// page while a song is already playing does not start a second stream, and leaving the page does not
// stop the music. Everything here is controls bound to that one player.
export default function SongDetailPlayer({ song, queue = [] }) {
  const music = useMusic();
  const active = Boolean(song && music.current && music.current.id === song.id);
  const shown = active ? music.current : song;
  const playing = active && music.playing;
  const time = active ? music.time : 0;
  const dur = active ? music.dur || Number(song?.duration) || 0 : Number(song?.duration) || 0;
  const failed = active && Boolean(music.error);

  // Opening the page of a song that is already in the queue keeps the queue as it is.
  const playThis = () => {
    if (active) music.toggle();
    else music.play(song, queue.length ? queue : [song]);
  };

  useEffect(() => { if (music.error) music.clearError(); /* a new page starts clean */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        <div className="mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-2xl bg-raised shadow-lg sm:mx-0 sm:h-52 sm:w-52">
          {shown && shown.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.image}
              alt={shown.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-gold"><Music2 size={44} /></span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-gold">{playing ? 'Now playing' : 'Ready to play'}</p>
          <h2 className="mt-1 line-clamp-2 font-display text-2xl font-extrabold text-cream">{shown && shown.title}</h2>
          <p className="mt-1 text-sm font-semibold text-dim">{(shown && shown.artists || []).join(', ') || 'Unknown artist'}</p>
          <p className="mt-0.5 text-xs font-bold text-faint">
            {shown && shown.album ? `${shown.album} · ` : ''}{shown && shown.year ? `${shown.year} · ` : ''}{shown && shown.language ? shown.language : ''}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className="w-10 text-right text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(time)}</span>
            <input
              type="range" min={0} max={dur || 0} step={1} value={Math.min(time, dur || 0)}
              aria-label="Seek song"
              disabled={!active}
              onChange={(e) => music.seek(Number(e.target.value))}
              className="h-1.5 flex-1 accent-[#0B6B45] disabled:opacity-40"
            />
            <span className="w-10 text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(dur)}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => music.prev()} aria-label="Previous song" className="rounded-full border border-line p-2.5 text-dim hover:border-gold hover:text-gold">
              <SkipBack size={17} />
            </button>
            <button
              type="button"
              onClick={playThis}
              aria-label={playing ? 'Pause' : 'Play'}
              className="grid h-12 w-12 place-items-center rounded-full bg-gold text-white shadow transition hover:brightness-95"
            >
              {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <button type="button" onClick={() => music.next()} aria-label="Next song" className="rounded-full border border-line p-2.5 text-dim hover:border-gold hover:text-gold">
              <SkipForward size={17} />
            </button>
            <span className="mx-1 h-6 w-px bg-line" />
            <button
              type="button"
              onClick={() => music.setMuted(!music.muted)}
              aria-label={music.muted ? 'Unmute' : 'Mute'}
              className="rounded-full border border-line p-2.5 text-dim hover:border-gold hover:text-gold"
            >
              {music.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05} value={music.muted ? 0 : music.volume}
              aria-label="Volume"
              onChange={(e) => music.setVolume(Number(e.target.value))}
              className="h-1.5 w-24 accent-[#0B6B45]"
            />
            {active && music.current && music.current.id !== (song && song.id) && (
              <Link href={`/songs/${music.current.slug}`} className="ml-auto text-xs font-extrabold text-gold hover:underline">
                Ab chal raha gaana
              </Link>
            )}
          </div>

          {failed && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              <p>{music.error}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { music.clearError(); music.play(song, queue.length ? queue : [song]); }}
                  className="rounded-full bg-amber-600 px-3 py-1 text-[0.68rem] font-extrabold text-white"
                >
                  Retry
                </button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${shown?.title || ''} ${(shown?.artists || []).join(' ')}`.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-amber-600/40 px-3 py-1 text-[0.68rem] font-extrabold text-amber-800"
                >
                  YouTube par sunein
                </a>
              </div>
            </div>
          )}

          {!active && !playing && (
            <p className="mt-3 text-[0.7rem] font-semibold text-faint">
              Play dabayein — gaana neeche mini player mein chalega aur page badalne par bhi nahi rukega.
            </p>
          )}
        </div>
      </div>

      <p className="border-t border-line px-5 py-2 text-[0.65rem] font-semibold text-faint">
        {playing ? 'Chal raha hai · 320kbps jahan available ho' : 'Audio load ho raha hai…'} · Music third-party catalogue se aata hai, personal listening ke liye.
      </p>
    </div>
  );
}
