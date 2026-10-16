'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, PackageCheck, PhoneCall, Truck } from 'lucide-react';
import { SITE, waLink } from '@/lib/config';
import { formatPKR } from '@/lib/format';
import { purchase } from '@/lib/metaPixel';
import { sfx } from '@/lib/sound';
import { WhatsAppIcon } from './Icons';
import InstallButton from './InstallButton';
import OrderBill from './OrderBill';

export default function ThankYouClient() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  const [order, setOrder] = useState(null);

  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem('mz_last_order') || 'null');
      if (o && (!id || o.orderId === id)) setOrder(o);
    } catch (_) {}
  }, [id]);

  // Purchase event: once per order, only here, with the real order value in PKR and the order ID.
  useEffect(() => { if (order) { purchase(order); sfx.success(); } }, [order]);

  const orderId = order ? order.orderId : id;
  const lines = order ? order.items.map((i) => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty}`).join(', ') : '';
  const msg = order
    ? `Assalam o Alaikum, I placed order ${order.orderId} on Mizanora.\nName: ${order.customer.name}\nItems: ${lines}\nTotal to pay (COD): ${formatPKR(order.total)}\nCity: ${order.customer.city}\nI need help with this order.`
    : `Assalam o Alaikum, I placed order ${orderId} on Mizanora and need help.`;

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#073D28] via-[#0B6B45] to-[#0E8556] px-5 pb-8 pt-10 text-center text-white shadow-xl">
        {[8, 18, 30, 42, 55, 66, 78, 90].map((l, n) => (
          <span key={l} aria-hidden="true" className="mz-anim absolute top-0 h-2.5 w-1.5 rounded-sm" style={{ left: `${l}%`, background: ['#F29F05', '#fff', '#7be0b0', '#ffd479'][n % 4], animation: `mz-fall ${2.2 + (n % 3) * 0.5}s ease-in ${n * 0.12}s infinite` }} />
        ))}
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span className="mz-anim absolute inset-0 rounded-full bg-white/40" style={{ animation: 'mz-ring 1.8s ease-out infinite' }} aria-hidden="true" />
          <span className="mz-anim relative grid h-20 w-20 place-items-center rounded-full bg-white text-gold shadow-lg" style={{ animation: 'mz-pop .6s ease-out both' }}><BadgeCheck size={46} /></span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Order confirmed</h1>
        <p lang="ar" dir="rtl" className="font-arabic mt-2 text-2xl text-[#FFE9A8]">جَزَاكَ اللَّهُ خَيْرًا</p>
        <p className="mt-1 text-white/85">Thank you for shopping with Mizanora</p>
        {orderId && <p className="mx-auto mt-4 w-fit rounded-full bg-white/15 px-4 py-1.5 text-sm">Order ID <b className="ml-1 tracking-wider">{orderId}</b></p>}
        {order && <p className="mt-3 text-2xl font-extrabold text-saffron">{formatPKR(order.total)} <span className="text-sm font-semibold text-white/80">to pay on delivery</span></p>}
      </div>

      <ol className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {[[PhoneCall, 'We confirm', 'We call or message you to confirm the order.'], [PackageCheck, 'We pack and dispatch', 'Your parcel is handed to the courier.'], [Truck, 'You pay on delivery', 'Check the parcel, then pay the rider.']].map(([Icon, t, d], n) => (
          <li key={t} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-gold"><Icon size={20} /></span><span className="text-sm"><b className="block">{n + 1}. {t}</b><span className="text-dim">{d}</span></span></li>
        ))}
      </ol>

      <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-center text-dim">We will call or message <b className="text-cream">{order ? order.customer.phone : 'your number'}</b> to confirm your order. Please keep your phone nearby.</p>
      <a href={waLink(msg)} target="_blank" rel="noopener noreferrer" className="btn-wa mt-4 w-full">
        <WhatsAppIcon size={22} /> Chat with support about this order
      </a>
      <p className="mt-2 text-center text-xs text-faint">WhatsApp is for support only. Your order is already placed.</p>

      {order && <div className="mt-6"><OrderBill order={order} /></div>}

      <div className="card mt-6">
        <h2 className="text-2xl font-semibold">Order faster next time</h2>
        <p className="mt-1 text-sm text-dim">Install the Mizanora app. Create an account to save your addresses and see every order and bill in one place.</p>
        <InstallButton className="mt-3" full />
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/account" className="btn-ghost !py-2.5">My orders</Link>
          <Link href="/track" className="btn-ghost !py-2.5">Track order</Link>
          <Link href="/products" className="btn-ghost !py-2.5">Continue shopping</Link>
          <Link href="/connect" className="btn-ghost !py-2.5">Follow {SITE.name}</Link>
        </div>
      </div>
    </div>
  );
}
