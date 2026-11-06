'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, Music2, TriangleAlert } from 'lucide-react';
import SongDetailPlayer from '@/components/SongDetailPlayer';
import { songByIdDirect } from '@/lib/songsClient';

// v55 — when the server could not load a song (mirror down, offline preview), the browser tries
// the mirror itself before showing an error. A song link a visitor shares must never dead-end.
export default function SongDirectLoader({ id, slug }) {
  const [song, setSong] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let alive = true;
    (async () => {
      // v56: our own resolver first (it holds the mirror list + a fresh token), then a direct
      // browser call to the mirrors if the server could not reach them.
      let found = null;
      try {
        const res = await fetch(`/api/songs/stream/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json();
        if (data && data.ok && data.song) found = data.song;
      } catch { /* server route unreachable — try the mirrors directly */ }
      if (!found) found = await songByIdDirect(id);
      if (!alive) return;
      if (found) { setSong(found); setState('ok'); } else { setState('error'); }
    })();
    return () => { alive = false; };
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-20 text-center">
        <LoaderCircle size={26} className="animate-spin text-gold" />
        <p className="text-sm font-semibold text-dim">Song load ho raha hai…</p>
        <p className="text-xs text-faint">Agar mirror slow hai to browser khud doosra mirror try karta hai.</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <TriangleAlert size={30} className="mx-auto text-amber-500" />
        <h1 className="mt-3 font-display text-2xl font-extrabold text-cream">Ye song abhi load nahi ho saka</h1>
        <p className="mt-2 text-sm leading-7 text-dim">
          Music catalogue jawab nahi de rahi (mirror down ya internet block). Aap dobara koshish kar sakte hain, ya
          Mizanora songs se koi doosra gaana chun sakte hain.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-white">Retry</button>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(slug.split('-').slice(0, 4).join(' '))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-4 py-2 text-sm font-bold text-dim hover:border-gold hover:text-gold"
          >
            YouTube par sunein
          </a>
          <Link href="/songs" className="rounded-full border border-line px-4 py-2 text-sm font-bold text-dim hover:border-gold hover:text-gold">Songs home</Link>
          <Link href={`/songs?q=${encodeURIComponent(slug.split('-').slice(0, 3).join(' '))}`} className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-sm font-bold text-dim hover:border-gold hover:text-gold">
            <Music2 size={14} /> Search this song
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-4">
        <SongDetailPlayer song={song} queue={[song]} />
      </section>
      <p className="mx-auto max-w-7xl px-3 pt-3 text-xs font-semibold text-faint sm:px-4">
        Loaded directly from the music mirror in your browser ·{' '}
        <Link href="/songs" className="font-extrabold text-gold hover:underline">all songs</Link>
      </p>
    </>
  );
}
