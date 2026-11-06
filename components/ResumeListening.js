'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Play, X } from 'lucide-react';
import { useMusic } from '@/components/MusicProvider';
import { songImageSrc } from '@/lib/songs';

// Mizanora v57 — "continue where you left off".
// The player never autoplays on load (browsers block that, and it is rude), so instead we show the
// last song the visitor played and let them resume with one tap. The queue is restored too, so
// next/previous keep working exactly as they did before the reload.
export default function ResumeListening() {
  const music = useMusic();
  const [last, setLast] = useState(null);
  const [queue, setQueue] = useState([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const song = JSON.parse(localStorage.getItem('mz_last_song') || 'null');
      const list = JSON.parse(localStorage.getItem('mz_last_queue') || 'null');
      if (song && song.id) setLast(song);
      if (Array.isArray(list) && list.length) setQueue(list.filter((s) => s && s.id));
    } catch { /* private mode / bad json */ }
  }, []);

  if (!last || hidden || music.current) return null;

  const resume = () => {
    const list = queue.some((s) => s.id === last.id) ? queue : [last, ...queue];
    music.play(last, list);
  };

  return (
    <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4" aria-label="Continue listening">
      <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-raised text-gold">
          {songImageSrc(last) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={songImageSrc(last)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : <History size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-extrabold uppercase tracking-wider text-gold">Wahan se jari rakhein</p>
          <Link href={last.slug ? `/songs/${last.slug}` : '/songs'} className="line-clamp-1 text-sm font-extrabold text-cream hover:text-gold">
            {last.title}
          </Link>
          <p className="line-clamp-1 text-[0.68rem] font-semibold text-dim">{(last.artists || []).join(', ') || 'Mizanora Songs'}</p>
        </div>
        <button type="button" onClick={resume} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 py-2 text-xs font-extrabold text-white">
          <Play size={14} fill="currentColor" /> Resume
        </button>
        <button type="button" onClick={() => setHidden(true)} aria-label="Hide" className="shrink-0 rounded-full p-1.5 text-faint hover:text-cream">
          <X size={15} />
        </button>
      </div>
    </section>
  );
}
