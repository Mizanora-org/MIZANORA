'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import OrderBill from './OrderBill';

export default function TrackClient() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [order, setOrder] = useState(null);

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setOrder(null);
    try {
      const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, phone }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not find the order.');
      setOrder(d.order);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={go} className="card space-y-4 no-print">
        <div><label htmlFor="oid" className="label">Order ID</label><input id="oid" className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="MZ-1A2B3C4D" autoCapitalize="characters" required /></div>
        <div><label htmlFor="oph" className="label">Mobile number used on the order</label><input id="oph" className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" required /></div>
        {err && <p role="alert" className="field-err">{err}</p>}
        <button className="btn-gold w-full" disabled={busy}>{busy ? <><Loader2 className="animate-spin" size={18} /> Checking...</> : 'Track my order'}</button>
      </form>
      {order && <OrderBill order={order} />}
    </div>
  );
}
