'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getWish } from '@/lib/wish';
import ProductCard from './ProductCard';

export default function WishlistClient({ products }) {
  const [ids, setIds] = useState(null);
  useEffect(() => {
    const sync = () => setIds(getWish());
    sync();
    window.addEventListener('mz-wish', sync);
    return () => window.removeEventListener('mz-wish', sync);
  }, []);
  const list = useMemo(() => (ids || []).map((id) => products.find((p) => p.id === id)).filter(Boolean), [ids, products]);
  if (ids === null) return <p className="text-dim">Loading...</p>;
  if (!list.length) {
    return (
      <div className="card text-center">
        <Heart className="mx-auto text-faint" size={40} />
        <p className="mt-3 text-lg font-semibold">Your wishlist is empty</p>
        <p className="text-sm text-dim">Tap the heart on any product to save it here.</p>
        <Link href="/products" className="btn-gold mt-4">Browse products</Link>
      </div>
    );
  }
  return <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}
