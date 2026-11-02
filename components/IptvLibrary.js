'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Film, Search, Star, Tv } from 'lucide-react';

// Public movies / series library — poster grid, search, group filter, sort.
// Asli stream URLs yahan kabhi nahi aate: sirf naam/poster/IMDb detail + player ka link.
export default function IptvLibrary({ kind = 'movies', items = [], groups = [], emptyNote = '' }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState('rating');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = items.filter((x) => (group === 'all' || (x.group || 'Other') === group)
      && (!term || `${x.name} ${x.group || ''} ${x.year || ''}`.toLowerCase().includes(term)));
    const sorted = [...rows];
    if (sort === 'rating') sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sort === 'new') sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
    else sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return sorted;
  }, [items, q, group, sort]);

  const base = kind === 'series' ? '/iptv/series' : '/iptv/movies';

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={kind === 'series' ? 'Series dhundein…' : 'Movie dhundein…'} />
        </div>
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="all">All categories ({items.length})</option>
          {groups.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.count})</option>)}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rating">Rating</option>
          <option value="new">Naye pehle</option>
          <option value="name">Naam (A–Z)</option>
        </select>
      </div>

      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.slice(0, 120).map((x) => (
            <Link key={x.id} href={`${base}/${x.id}`}
              className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-lg">
              <div className="relative aspect-[2/3] overflow-hidden bg-raised">
                {x.poster
                  ? <img src={x.poster} alt={x.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  : <div className="grid h-full place-items-center text-faint">{kind === 'series' ? <Tv size={26} /> : <Film size={26} />}</div>}
                {x.rating > 0 && (
                  <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                    <Star size={9} /> {x.rating}
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-bold text-cream">{x.name}</p>
                <p className="truncate text-[10px] text-faint">
                  {[x.year || '', x.seasons ? `${x.seasons} season${x.seasons > 1 ? 's' : ''}` : '', x.group || ''].filter(Boolean).join(' · ')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-raised px-3 py-6 text-center text-sm text-dim">
          {emptyNote || (kind === 'series' ? 'Abhi koi series library mein nahi.' : 'Abhi koi movie library mein nahi.')}
        </p>
      )}

      {list.length > 120 && <p className="text-[11px] text-faint">Pehli 120 dikh rahi hain — search se apni cheez dhoondein.</p>}
    </div>
  );
}
