'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { useCart } from './CartProvider';

// Shows returning customers a one-tap "order again" card (reads their last order from this device).
export default function ReorderBanner() {
  const { add } = useCart();
  const [order, setOrder] = useState(null);
  useEffect(() => {
    try { const o = JSON.parse(localStorage.getItem('mz_last_order') || 'null'); if (o && o.items && o.items.length) setOrder(o); } catch (_) {}
  }, []);
  if (!order) return null;
  const first = order.customer && order.customer.name ? order.customer.name.split(' ')[0] : '';
  const names = order.items.map((i) => i.name).join(', ');
  return (
    <section className="mx-auto mt-6 max-w-6xl px-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-bronze bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-dim"><b className="text-cream">Welcome back{first ? `, ${first}` : ''}!</b> Want to order <span className="text-cream">{names}</span> again?</p>
        <Link href="/checkout" className="btn-gold !py-2.5 whitespace-nowrap"
          onClick={() => order.items.forEach((i) => add({ id: i.id, slug: i.slug, name: i.name, price: i.price, images: i.image ? [i.image] : [] }, { size: i.size || '', qty: i.qty }))}>
          <RotateCcw size={16} /> Order again
        </Link>
      </div>
    </section>
  );
}
