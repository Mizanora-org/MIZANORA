'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music2 } from 'lucide-react';
import { clockTime } from '@/lib/songs';
import { searchSongsDirect } from '@/lib/songsClient';

// v55 — songs in the site-wide search. The server search page cannot race the music mirrors during
// render without slowing every query, so this small block loads the matches afterwards.
export default function SearchSongsBlock({ query }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ok | empty

  useEffect(() => {
    const q = String(query || '').trim();
    if (q.length < 2) { setItems([]); setState('idle'); return; }
    let alive = true;
    setState('loading');
    (async () => {
      let found = [];
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}&limit=12`, { cache: 'no-store' });
        const data = await res.json();
        found = Array.isArray(data.items) ? data.items : [];
        if (!found.length || data.upstream === 'down') {
          const direct = await searchSongsDirect(q, 12).catch(() => ({ items: [] }));
          if (direct.items.length) found = direct.items;
        }
      } catch {
        const direct = await searchSongsDirect(q, 12).catch(() => ({ items: [] }));
        found = direct.items || [];
      }
      if (!alive) return;
      setItems(found.slice(0, 6));
      setState(found.length ? 'ok' : 'empty');
    })();
    return () => { alive = false; };
  }, [query]);

  if (!query || query.trim().length < 2) return null;
  if (state === 'loading') {
    return (
      <section className="pt-6" aria-busy="true">
        <h2 className="font-display text-lg font-extrabold">Songs</h2>
        <p className="mt-1 text-sm text-faint">Music mirrors se gaane dhoonde ja rahe hain…</p>
      </section>
    );
  }
  if (state !== 'ok') return null;

  return (
    <section className="pt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold">Songs ({items.length})</h2>
        <Link href={`/songs?q=${encodeURIComponent(query)}`} className="text-xs font-extrabold text-gold hover:underline">All songs →</Link>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2">
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg object-cover" />
            ) : <span className="grid h-10 w-10 place-items-center rounded-lg bg-raised text-gold"><Music2 size={16} /></span>}
            <div className="min-w-0 flex-1">
              <Link href={`/songs/${s.slug}`} className="line-clamp-1 text-sm font-extrabold text-cream hover:text-gold">{s.title}</Link>
              <p className="line-clamp-1 text-[0.65rem] font-semibold text-dim">{(s.artists || []).join(', ') || 'Artist'}</p>
            </div>
            <span className="text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(s.duration)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
