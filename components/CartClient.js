'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from './CartProvider';
import { SITE, shippingFor } from '@/lib/config';
import { formatPKR } from '@/lib/format';

export default function CartClient() {
  const { items, ready, setQty, remove, subtotal } = useCart();
  if (!ready) return <p className="text-dim">Loading your cart...</p>;
  if (!items.length) {
    return (
      <div className="card text-center">
        <p className="text-lg text-cream">Your cart is empty.</p>
        <Link href="/products" className="btn-gold mt-4">Browse products</Link>
      </div>
    );
  }
  const shipping = shippingFor(subtotal);
  const freeOver = SITE.freeShippingOver;
  const showBar = freeOver > 0 && SITE.shippingFee > 0;
  const left = Math.max(0, freeOver - subtotal);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
      {showBar && (
        <div className="card !p-3.5">
          <p className="text-sm font-semibold text-cream">{left > 0 ? <>Add <b className="text-gold">{formatPKR(left)}</b> more for <b>free delivery</b></> : <>You get <b className="text-gold">free delivery</b> on this order!</>}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-gradient-to-r from-gold to-saffron transition-all" style={{ width: `${Math.min(100, Math.round((subtotal / freeOver) * 100))}%` }} /></div>
        </div>
      )}
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.key} className="card flex gap-4 !p-3.5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-raised">
              {i.image && <Image src={i.image} alt={i.name} fill sizes="96px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/product/${i.slug}`} className="line-clamp-2 font-medium">{i.name}</Link>
              {i.size && <p className="text-sm text-dim">{i.size}</p>}
              <p className="mt-1 font-bold text-gold">{formatPKR(i.price)}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-xl border border-line">
                  <button aria-label="Decrease" className="p-2.5" onClick={() => setQty(i.key, i.qty - 1)}><Minus size={15} /></button>
                  <span className="w-7 text-center text-sm font-semibold">{i.qty}</span>
                  <button aria-label="Increase" className="p-2.5" onClick={() => setQty(i.key, i.qty + 1)}><Plus size={15} /></button>
                </div>
                <button aria-label={`Remove ${i.name}`} className="p-2.5 text-faint hover:text-red-400" onClick={() => remove(i.key)}><Trash2 size={18} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      </div>
      <aside className="card h-fit">
        <h2 className="mb-3 text-2xl font-semibold">Summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-dim">Subtotal</dt><dd>{formatPKR(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-dim">Delivery</dt><dd>{shipping > 0 ? formatPKR(shipping) : 'Free'}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total (pay on delivery)</dt><dd className="text-gold">{formatPKR(subtotal + shipping)}</dd></div>
        </dl>
        <Link href="/checkout" className="btn-gold mt-5 w-full">Checkout</Link>
      </aside>
    </div>
  );
}
