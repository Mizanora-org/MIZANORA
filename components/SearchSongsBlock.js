'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music2, Pause, Play } from 'lucide-react';
import { clockTime, songImageSrc } from '@/lib/songs';
import { searchSongsDirect } from '@/lib/songsClient';
import { useMusic } from '@/components/MusicProvider';

// Mizanora v55/v59 — songs in the site-wide search.
//
// The search page cannot race the music mirrors during render without slowing every query, so this
// block loads the matches right after the page. v59: it shows more results (12), uses the same-origin
// artwork proxy, and each row has a play button that starts the whole result list as a queue — the
// visitor does not have to open a song page just to hear a match.
export default function SearchSongsBlock({ query }) {
  const music = useMusic();
  const [items, setItems] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ok | empty

  useEffect(() => {
    const q = String(query || '').trim();
    if (q.length < 2) { setItems([]); setState('idle'); return undefined; }
    let alive = true;
    setState('loading');
    (async () => {
      let found = [];
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}&limit=20`, { cache: 'no-store' });
        const data = await res.json();
        found = Array.isArray(data.items) ? data.items : [];
        if (!found.length || data.upstream === 'down') {
          const direct = await searchSongsDirect(q, 20).catch(() => ({ items: [] }));
          if (direct.items.length) found = direct.items;
        }
      } catch {
        const direct = await searchSongsDirect(q, 20).catch(() => ({ items: [] }));
        found = direct.items || [];
      }
      if (!alive) return;
      setItems(found.slice(0, 12));
      setState(found.length ? 'ok' : 'empty');
    })();
    return () => { alive = false; };
  }, [query]);

  if (!query || query.trim().length < 2) return null;

  if (state === 'loading') {
    return (
      <section className="pt-6" aria-busy="true">
        <h2 className="font-display text-xl font-extrabold">Songs <span className="text-sm font-semibold text-faint">(searching…)</span></h2>
        <p className="mt-1 text-sm text-faint">Music mirrors se gaane dhoonde ja rahe hain…</p>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className="pt-6">
        <h2 className="font-display text-xl font-extrabold">Songs</h2>
        <p className="mt-1 text-sm text-dim">
          Is naam se koi gaana nahi mila.{' '}
          <Link href={`/songs?q=${encodeURIComponent(query)}`} className="font-bold text-gold underline">Songs section mein search karein →</Link>
        </p>
      </section>
    );
  }

  const playAll = () => {
    if (!items.length) return;
    const active = music.current && items.find((s) => s.id === music.current.id);
    if (active) { music.toggle(); return; }
    music.play(items[0], items);
  };

  return (
    <section className="pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Songs <span className="text-sm font-semibold text-faint">({items.length})</span></h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={playAll} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-white">
            <Play size={13} fill="currentColor" /> Play all
          </button>
          <Link href={`/songs?q=${encodeURIComponent(query)}`} className="text-xs font-extrabold text-gold hover:underline">All songs →</Link>
        </div>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((s) => {
          const active = music.current && music.current.id === s.id;
          const thumb = songImageSrc(s);
          return (
            <li key={s.id} className={`flex items-center gap-2.5 rounded-xl border p-2 ${active ? 'border-gold bg-gold/5' : 'border-line bg-surface'}`}>
              <button
                type="button"
                onClick={() => (active ? music.toggle() : music.play(s, items))}
                aria-label={`Play ${s.title}`}
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-raised"
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : <span className="grid h-full w-full place-items-center text-gold"><Music2 size={16} /></span>}
                <span className={`absolute inset-0 grid place-items-center bg-black/45 ${active ? '' : 'opacity-0 hover:opacity-100'}`}>
                  {active && music.playing ? <Pause size={14} className="text-white" fill="currentColor" /> : <Play size={14} className="text-white" fill="currentColor" />}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <Link href={`/songs/${s.slug}`} className="line-clamp-1 text-sm font-extrabold text-cream hover:text-gold">{s.title}</Link>
                <p className="line-clamp-1 text-[0.65rem] font-semibold text-dim">{(s.artists || []).join(', ') || 'Artist'}{s.album ? ` · ${s.album}` : ''}</p>
              </div>
              <span className="text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(s.duration)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
