'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3, Play, Trash2, X } from 'lucide-react';
import { clearRecent, clockLabel, progressPercent, readRecent, removeRecent } from '@/lib/movieProgress';

// v51 — the "Continue watching" shelf. Reading happens on the client only, because the list lives
// in this browser's localStorage (no accounts, no cookies, nothing sent to the server).
export default function ContinueWatching({ limit = 8, className = '' }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    setItems(readRecent());
  }, []);

  if (!items || items.length === 0) return null;
  const shown = items.slice(0, limit);

  const drop = (id) => setItems(removeRecent(id));
  const wipe = () => { clearRecent(); setItems([]); };

  return (
    <section className={`mx-auto max-w-7xl px-3 sm:px-4 ${className}`} aria-labelledby="continue-watching">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-gold">
            <Clock3 size={12} /> Your device · private
          </p>
          <h2 id="continue-watching" className="font-display text-xl font-extrabold text-cream sm:text-2xl">
            Continue Watching
          </h2>
          <p className="text-sm text-dim">Jahan chhorha tha wahin se — position sirf aap ke browser mein save hai.</p>
        </div>
        <button type="button" onClick={wipe} className="inline-flex items-center gap-1 text-xs font-bold text-faint hover:text-rose-600">
          <Trash2 size={12} /> Clear all
        </button>
      </div>

      <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
        {shown.map((m) => {
          const pct = progressPercent(m);
          return (
            <div
              key={m.id}
              className="group relative w-[70vw] max-w-[22rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:border-gold sm:w-[19rem]"
            >
              <Link href={`/movies/${m.slug || m.id}#player`} prefetch={false} className="flex items-center gap-3 p-2.5">
                <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-raised">
                  {m.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.poster} alt={m.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center font-display text-sm font-extrabold text-gold">
                      {String(m.title || 'MZ').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-display text-sm font-extrabold text-cream group-hover:text-gold">{m.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.66rem] font-semibold text-dim">
                    {m.year ? <span>{m.year}</span> : null}
                    <span>· {m.type === 'series' ? 'Series' : 'Movie'}</span>
                    {m.server ? <span className="truncate">· {m.server}</span> : null}
                  </span>
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-raised">
                    <span className="block h-full rounded-full bg-gold" style={{ width: `${pct || 4}%` }} />
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-1 text-[0.62rem] font-bold text-faint">
                    <span>{m.t > 0 ? `${clockLabel(m.t)}${m.d ? ` / ${clockLabel(m.d)}` : ''}` : 'Not started'}</span>
                    <span className="inline-flex items-center gap-0.5 text-gold">
                      <Play size={9} fill="currentColor" /> {pct > 0 ? `Resume ${pct}%` : 'Play'}
                    </span>
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => drop(m.id)}
                aria-label={`Remove ${m.title}`}
                title="Remove from this list"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1 text-white/80 opacity-0 transition hover:bg-rose-600 hover:text-white group-hover:opacity-100 focus:opacity-100"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
