'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';

// v36: /blog had 100+ cards on one page: slow to load, and impossible to browse.
// This keeps the page static (everything is decided in the browser) while showing
// 24 guides at a time, a live search box and the category shelves.

const PAGE = 24;

export default function BlogBrowser({ posts = [], categories = [] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false;
      if (!needle) return true;
      return `${p.title} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase().includes(needle);
    });
  }, [posts, q, cat]);

  const shown = filtered.slice(0, page * PAGE);
  const done = shown.length >= filtered.length;

  const pick = (next) => { setCat(next); setPage(1); };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search the blog</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search the guides (size, cash on delivery, zakat…)"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-9 text-sm outline-none placeholder:text-faint focus:border-gold"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear the search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-cream">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </label>
        <p className="shrink-0 text-sm text-dim" aria-live="polite">
          <b className="text-cream">{filtered.length}</b> {filtered.length === 1 ? 'guide' : 'guides'}
        </p>
      </div>

      <nav aria-label="Blog categories" className="mb-7 flex flex-wrap gap-2">
        <button type="button" onClick={() => pick('all')} className={`mz-chip${cat === 'all' ? ' is-on' : ''}`}>All</button>
        {categories.map((c) => (
          <button key={c.slug} type="button" onClick={() => pick(c.slug)} className={`mz-chip${cat === c.slug ? ' is-on' : ''}`}>
            {c.label} <i>{c.count}</i>
          </button>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-8 text-center text-dim">
          Nothing matched “{q}”. Try a shorter word, or{' '}
          <button type="button" className="font-semibold text-gold underline" onClick={() => { setQ(''); pick('all'); }}>show every guide</button>.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <article key={p.slug} className="card flex flex-col">
              {p.image ? (
                <Link href={`/blog/${p.slug}`} className="mb-3 block overflow-hidden rounded-xl bg-raised" tabIndex={-1} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full object-cover" />
                </Link>
              ) : null}
              <span className="mz-tag">{p.categoryLabel || p.category}</span>
              <h2 className="mt-2 text-xl font-bold leading-snug"><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
              <p className="mt-2 flex-1 text-dim">{p.description}</p>
              <p className="mt-3 text-xs text-faint">{p.date} · {p.mins} min read</p>
              <Link href={`/blog/${p.slug}`} className="mt-2 inline-block text-sm font-semibold text-gold">Read the guide</Link>
            </article>
          ))}
        </div>
      )}

      {!done && (
        <div className="mt-8 text-center">
          <button type="button" onClick={() => setPage((n) => n + 1)} className="btn-ghost">
            Show {Math.min(PAGE, filtered.length - shown.length)} more
          </button>
        </div>
      )}
    </>
  );
}
