'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getWish } from '@/lib/wish';
import ProductCard from './ProductCard';

// The wishlist page. The saved ids are read on this device; the cards come from /api/wishlist-cards, which finds the product
// wherever it lives (live products or catalogue files), so nothing saved ever "disappears".
export default function WishlistClient() {
  const [ids, setIds] = useState(null);
  const [cards, setCards] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sync = () => setIds(getWish());
    sync();
    window.addEventListener('mz-wish', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('mz-wish', sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => {
    if (!ids) return;
    const need = ids.filter((id) => !cards[id]);
    if (!need.length) return;
    let live = true;
    fetch(`/api/wishlist-cards?ids=${encodeURIComponent(need.join(','))}`)
      .then((r) => r.json())
      .then((j) => { if (live && j && j.ok) setCards((c) => ({ ...c, ...Object.fromEntries(j.products.map((p) => [p.id, p])) })); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [ids, cards]);

  if (ids === null) return <p className="text-dim">Loading...</p>;
  if (!ids.length) {
    return (
      <div className="card text-center">
        <Heart className="mx-auto text-faint" size={40} />
        <p className="mt-3 text-lg font-semibold">Your wishlist is empty</p>
        <p className="text-sm text-dim">Tap the heart on any product to save it here.</p>
        <Link href="/products" className="btn-gold mt-4">Browse products</Link>
      </div>
    );
  }
  const list = ids.map((id) => cards[id]).filter(Boolean);
  if (!list.length) return failed ? <p className="text-dim">Could not load your saved products. Check your internet and refresh.</p> : <p className="text-dim">Loading your saved products...</p>;
  return (
    <>
      <p className="mb-3 text-sm text-dim">{list.length} saved product{list.length > 1 ? 's' : ''}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </>
  );
}
