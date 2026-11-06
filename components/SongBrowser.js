'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, Music2, Pause, Play, Search, X } from 'lucide-react';
import { artistSlug, clockTime, songImageSrc } from '@/lib/songs';
import { searchSongsDirect } from '@/lib/songsClient';
import { useMusic } from '@/components/MusicProvider';

// Mizanora v57 — the songs browser.
//
// v54 had its own <audio> here, which meant the music stopped the moment you opened another page.
// The audio now lives in MusicProvider (root layout), so pressing play once keeps the song going
// while the visitor browses movies, the Quran or the shop. This component is search + cards only;
// the controls are the global mini player.
export default function SongBrowser({ initialSongs = [], topics = [], initialQuery = '' }) {
  const music = useMusic();
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState(initialSongs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reqId = useRef(0);

  const runSearch = useCallback(async (query) => {
    const text = String(query || '').trim();
    const id = reqId.current + 1;
    reqId.current = id;
    setError('');
    setNotice('');
    if (!text) { setItems(initialSongs); setLoading(false); return; }
    setLoading(true);
    let found = [];
    let upstreamDown = false;
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(text)}&limit=30`, { cache: 'no-store' });
      const data = await res.json();
      if (reqId.current !== id) return; // a newer keystroke already won
      found = Array.isArray(data.items) ? data.items : [];
      upstreamDown = data.upstream === 'down' || !found.length;
    } catch {
      upstreamDown = true;
    }

    // Server could not reach a mirror (preview sandbox / outage): the browser tries the same
    // mirrors directly, because a visitor's own network sometimes works when the server's does not.
    if (upstreamDown) {
      try {
        const direct = await searchSongsDirect(text, 30);
        if (reqId.current !== id) return;
        if (direct.items.length) {
          found = direct.items;
          setNotice('Mirror se seedha load hua (browser).');
        }
      } catch { /* keep whatever the server gave us */ }
    }

    if (reqId.current !== id) return;
    setItems(found);
    setLoading(false);
    if (!found.length) setError('Kuch nahi mila. Naam check karein, ya thori dair baad Retry dabayein.');
  }, [initialSongs]);

  // Type-ahead: 450 ms after typing stops, search.
  useEffect(() => {
    if (!q.trim()) { setItems(initialSongs); return undefined; }
    const t = setTimeout(() => runSearch(q), 450);
    return () => clearTimeout(t);
  }, [q, runSearch, initialSongs]);

  const playOne = (song) => music.play(song, items);

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
        {items.map((s) => {
          const active = music.current && music.current.id === s.id;
          const thumb = songImageSrc(s);
          return (
            <li key={s.id} className={`group flex items-center gap-3 rounded-2xl border p-2.5 transition ${active ? 'border-gold bg-gold/5' : 'border-line bg-surface hover:border-gold'}`}>
              <button
                type="button"
                onClick={() => playOne(s)}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-raised"
                aria-label={`Play ${s.title}`}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-gold"><Music2 size={20} /></span>
                )}
                <span className={`absolute inset-0 grid place-items-center bg-black/45 transition ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {active && music.playing ? <Pause size={18} className="text-white" /> : <Play size={18} fill="currentColor" className="text-white" />}
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
          );
        })}
      </ul>

      {!items.length && !loading && !error && (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center text-sm text-dim">Koi song nahi mila.</p>
      )}

      {/* Hint for the controls — the actual player is the mini player, which survives navigation. */}
      <p className="mt-5 text-center text-[0.68rem] font-semibold text-faint">
        Play dabane ke baad music neeche mini player mein chalta rahega — aap doosre page par ja sakte hain, gaana nahi rukega.
      </p>
    </div>
  );
}
