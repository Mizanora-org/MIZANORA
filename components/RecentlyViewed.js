'use client';
import { useEffect, useState } from 'react';
import RemoteImg from './RemoteImg';
import Link from 'next/link';
import { getRecent } from '@/lib/recent';
import { getSearchIndex } from '@/lib/searchIndex';
import { formatPKR } from '@/lib/format';

export default function RecentlyViewed({ current = '' }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const ids = getRecent().filter((x) => x !== current).slice(0, 8);
    if (!ids.length) return;
    getSearchIndex().then((all) => setItems(ids.map((id) => all.find((p) => p.id === id)).filter(Boolean)));
  }, [current]);
  if (!items.length) return null;
  return (
    <section className="mx-auto mt-10 max-w-7xl px-0 sm:px-0" aria-labelledby="recent">
      <h2 id="recent" className="section-title mb-3">Recently viewed</h2>
      <div className="no-sb flex gap-3 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link key={p.id} href={`/product/${p.slug}`} className="w-32 shrink-0 sm:w-40">
            <span className="relative block aspect-square overflow-hidden rounded-xl border border-line bg-raised">{p.image && <RemoteImg src={p.image} alt={p.name} fill sizes="160px" className="object-cover" />}</span>
            <span className="mt-1 line-clamp-1 block text-sm font-semibold">{p.name}</span>
            <span className="text-sm font-bold text-gold">{formatPKR(p.price)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
