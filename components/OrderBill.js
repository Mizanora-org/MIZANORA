'use client';
import { Printer } from 'lucide-react';
import { formatDate, formatPKR } from '@/lib/format';

const STEPS = ['Pending', 'Verified', 'Dispatched', 'Delivered'];

// A full bill: items, quantities, line totals, discount, delivery and the amount to pay on delivery.
export default function OrderBill({ order, showTimeline = true, printable = true }) {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Number(order.discount) || 0;
  const step = STEPS.indexOf(order.status);
  const cancelled = order.status === 'Cancelled' || order.status === 'Returned';
  const c = order.customer || {};
  return (
    <div className="card" id="bill">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Order bill</p>
          <h2 className="text-2xl font-extrabold">{order.orderId}</h2>
          <p className="text-sm text-dim">{formatDate(order.createdAtMs)} · Cash on delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${cancelled ? 'bg-red-100 text-red-700' : 'bg-gold/10 text-gold'}`}>{order.status || 'Pending'}</span>
          {printable && <button type="button" onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-dim hover:border-gold"><Printer size={14} /> Print / Save PDF</button>}
        </div>
      </div>

      {showTimeline && !cancelled && (
        <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-xs" aria-label="Order progress">
          {STEPS.map((s, n) => (
            <li key={s}>
              <span className={`mb-1 block h-1.5 rounded-full ${n <= step ? 'bg-gold' : 'bg-raised'}`} />
              <span className={n <= step ? 'font-bold text-gold' : 'text-faint'}>{s === 'Pending' ? 'Order placed' : s === 'Verified' ? 'Confirmed' : 'On the way'}</span>
            </li>
          ))}
        </ol>
      )}
      {order.trackingId && <p className="mt-3 text-sm text-dim">Courier tracking ID: <b className="text-cream">{order.trackingId}</b></p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="py-2 font-semibold">Item</th><th className="py-2 text-right font-semibold">Price</th><th className="py-2 text-right font-semibold">Qty</th><th className="py-2 text-right font-semibold">Total</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={`${i.id}${i.size}`} className="border-b border-line/60">
                <td className="py-2 pr-2">{i.name}{i.size ? <span className="text-faint"> ({i.size})</span> : null}</td>
                <td className="py-2 text-right">{formatPKR(i.price)}</td>
                <td className="py-2 text-right">{i.qty}</td>
                <td className="py-2 text-right font-semibold">{formatPKR(i.price * i.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto mt-3 max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-dim">Subtotal</dt><dd>{formatPKR(subtotal)}</dd></div>
        {discount > 0 && <div className="flex justify-between text-gold"><dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd>- {formatPKR(discount)}</dd></div>}
        <div className="flex justify-between"><dt className="text-dim">Delivery</dt><dd>{order.shipping > 0 ? formatPKR(order.shipping) : 'Free'}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><dt>Total to pay</dt><dd className="text-gold">{formatPKR(order.total)}</dd></div>
      </dl>

      <div className="mt-4 rounded-xl bg-raised p-3.5 text-sm text-dim">
        <p className="font-semibold text-cream">{c.name} · {c.phone}</p>
        <p>{c.address}, {c.city}, {c.province}</p>
        {c.landmark && <p>Landmark: {c.landmark}</p>}
        {c.notes && <p>Notes: {c.notes}</p>}
      </div>
    </div>
  );
}
