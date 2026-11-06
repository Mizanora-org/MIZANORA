'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Play, Trash2, X } from 'lucide-react';
import { clearList, readList, removeListItem } from '@/lib/movieList';

// v51 — "My List": the titles this browser saved for later.
export default function MyListShelf({ limit = 8, className = '' }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    setItems(readList());
  }, []);

  if (!items || items.length === 0) return null;
  const shown = items.slice(0, limit);

  const drop = (id) => setItems(removeListItem(id));
  const wipe = () => { clearList(); setItems([]); };

  return (
    <section className={`mx-auto max-w-7xl px-3 sm:px-4 ${className}`} aria-labelledby="my-list">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-gold">
            <Bookmark size={12} /> Saved on this device
          </p>
          <h2 id="my-list" className="font-display text-xl font-extrabold text-cream sm:text-2xl">My List</h2>
          <p className="text-sm text-dim">Jo titles aap ne baad mein dekhne ke liye save kiye — sirf aap ke browser mein.</p>
        </div>
        <button type="button" onClick={wipe} className="inline-flex items-center gap-1 text-xs font-bold text-faint hover:text-rose-600">
          <Trash2 size={12} /> Clear list
        </button>
      </div>

      <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
        {shown.map((m) => (
          <div key={m.id} className="group relative w-32 shrink-0 snap-start sm:w-36">
            <Link
              href={`/movies/${m.slug || m.id}#player`}
              prefetch={false}
              className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
            >
              <span className="relative block aspect-[2/3] w-full bg-raised">
                {m.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.poster} alt={m.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#0B6B45] to-[#13293d] font-display text-2xl font-extrabold text-white/80">
                    {String(m.title || 'MZ').slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-white shadow-lg">
                    <Play size={16} fill="currentColor" />
                  </span>
                </span>
              </span>
              <span className="block p-2">
                <span className="line-clamp-1 font-display text-xs font-extrabold text-cream group-hover:text-gold">{m.title}</span>
                <span className="mt-0.5 block text-[0.62rem] font-semibold text-dim">
                  {m.year || ''} {m.type === 'series' ? '· Series' : '· Movie'}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => drop(m.id)}
              aria-label={`Remove ${m.title} from My List`}
              title="Remove"
              className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white/80 opacity-0 transition hover:bg-rose-600 hover:text-white group-hover:opacity-100 focus:opacity-100"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
