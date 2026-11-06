'use client';
import { useEffect, useState } from 'react';
import { BookmarkCheck, BookmarkPlus } from 'lucide-react';
import { inList, toggleListItem } from '@/lib/movieList';

// Small heart/bookmark button on a movie page. The list lives in this browser only.
export default function MovieListButton({ movie, className = '' }) {
  const id = String((movie && (movie.imdbId || movie.slug)) || '').toLowerCase();
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSaved(id ? inList(id) : false);
    setReady(true);
  }, [id]);

  if (!id) return null;

  const toggle = () => {
    const { added } = toggleListItem({
      id,
      slug: movie.slug,
      title: movie.title,
      poster: movie.poster,
      year: movie.year,
      type: movie.type,
    });
    setSaved(added);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      title={saved ? 'My List se hatayein' : 'My List mein save karein'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
        saved
          ? 'border-gold bg-gold text-white'
          : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
      } ${ready ? '' : 'opacity-70'} ${className}`}
    >
      {saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
      {saved ? 'In My List' : 'My List'}
    </button>
  );
}
