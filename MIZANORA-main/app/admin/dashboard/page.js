'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { formatPKR } from '@/lib/format';
import { BarChart, LineChart, TopList } from '@/components/Charts';

// Admin > Dashboard: live visitors, traffic, sources, devices, funnel, orders and sales, top products and searches.
// All numbers come from the Realtime Database (separate free quota): the dashboard costs NO Firestore reads.
const pretty = (s) => String(s || '').replace(/[-_]+/g, ' ');
const ago = (s) => (s < 60 ? `${s}s` : `${Math.round(s / 60)}m`);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [lv, setLv] = useState(null);
  const [days, setDays] = useState(14);
  const [err, setErr] = useState('');
  const [setup, setSetup] = useState(false);
  const [back, setBack] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const visible = useRef(true);

  const call = useCallback(async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` }, body: JSON.stringify(body) });
    return r.json().catch(() => ({ ok: false }));
  }, []);

  const loadAll = useCallback(async () => {
    const j = await call('/api/admin/analytics', { days });
    if (j.setup) { setSetup(true); return; }
    if (!j.ok) { setErr(j.error || 'Could not load'); return; }
    setErr(''); setData(j);
  }, [call, days]);
  const loadLive = useCallback(async () => {
    const j = await call('/api/admin/analytics', { live: true });
    if (j.ok) { setLv(j); if (j.backupOrders) { const b = await call('/api/admin/backup-orders', { action: 'list' }); if (b.ok) setBack(b.orders); } else setBack([]); }
  }, [call]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    loadLive();
    const onVis = () => { visible.current = document.visibilityState === 'visible'; if (visible.current) loadLive(); };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => { if (visible.current) loadLive(); }, 20000);
    const t2 = setInterval(() => { if (visible.current) loadAll(); }, 120000);
    return () => { clearInterval(t); clearInterval(t2); document.removeEventListener('visibilitychange', onVis); };
  }, [loadLive, loadAll]);

  const act = async (kind, id) => {
    setBusy(id); setMsg('');
    const j = await call('/api/admin/backup-orders', { action: kind, id });
    setMsg(j.ok ? (kind === 'move' ? `${id} moved to the orders list.` : `${id} removed from the backup.`) : j.error || 'Failed');
    await loadLive(); setBusy('');
  };
  const cleanup = async () => { if (!window.confirm('Delete tracking numbers older than 90 days? (orders are not touched)')) return; const j = await call('/api/admin/analytics', { action: 'cleanup', keepDays: 90 }); setMsg(j.ok ? `Old counters removed: ${j.removed}.` : j.error || 'Failed'); };

  if (setup) return (
    <div className="card max-w-xl space-y-2">
      <h1 className="text-2xl font-extrabold">Set up the Realtime Database (2 minutes)</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Firebase Console &gt; Build &gt; <b>Realtime Database</b> &gt; Create database (start in locked mode).</li>
        <li>Open the <b>Rules</b> tab, paste the file <code>database.rules.json</code> from your project, Publish.</li>
        <li>If your database address is not <code>https://PROJECT-default-rtdb.firebaseio.com</code>, add it in Vercel as <code>FIREBASE_DATABASE_URL</code> and <code>NEXT_PUBLIC_FIREBASE_DATABASE_URL</code>. Redeploy.</li>
      </ol>
      <p className="text-xs text-dim">The shop works without it. With it you get live visitors, graphs, the order backup and a shut-down switch that works even when Firestore is full.</p>
    </div>
  );

  const t = data && data.today;
  const conv = t && t.uv ? ((t.orders / t.uv) * 100).toFixed(1) : '0.0';
  const aov = t && t.orders ? Math.round(t.sales / t.orders) : 0;
  const f = data && data.funnel;
  const Card = ({ title, children, className = '' }) => <section className={`card ${className}`}><h2 className="mb-2 text-base font-extrabold">{title}</h2>{children}</section>;
  const Kpi = ({ l, v, s }) => <div className="card !p-3"><p className="text-xs text-dim">{l}</p><p className="text-2xl font-extrabold text-gold">{v}</p>{s && <p className="text-[0.7rem] text-faint">{s}</p>}</div>;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <select className="input !w-auto !py-1.5" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 30, 60].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>
          <button type="button" className="btn-ghost !py-1.5" onClick={() => { loadAll(); loadLive(); }}>Refresh</button>
        </div>
      </div>
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}

      {back && back.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-3">
          <h2 className="text-base font-extrabold text-amber-900">{back.length} order(s) are waiting in the backup database</h2>
          <p className="text-xs text-amber-900/80">They were taken while Firestore&apos;s free quota was used up. They are safe. When Firestore works again press &quot;Move to orders&quot;. Call these customers if urgent.</p>
          <ul className="mt-2 space-y-1.5">
            {back.map((o) => (
              <li key={o.orderId} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-sm">
                <b>{o.orderId}</b><span className="min-w-0 flex-1 truncate">{o.customer && o.customer.name} · {o.customer && o.customer.phone} · {o.customer && o.customer.city} · {formatPKR(o.total)} · {(o.items || []).length} item(s)</span>
                <button type="button" className="btn-gold !px-3 !py-1 text-xs" disabled={busy === o.orderId} onClick={() => act('move', o.orderId)}>Move to orders</button>
                <button type="button" className="btn-ghost !px-3 !py-1 text-xs" disabled={busy === o.orderId} onClick={() => act('dismiss', o.orderId)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi l="Live now" v={lv ? lv.online : '...'} s="active in the last 90 s" />
        <Kpi l="Visitors today" v={t ? t.uv.toLocaleString('en-PK') : '...'} />
        <Kpi l="Page views today" v={t ? t.views.toLocaleString('en-PK') : '...'} />
        <Kpi l="Orders today" v={t ? t.orders : '...'} />
        <Kpi l="Sales today" v={t ? formatPKR(t.sales) : '...'} />
        <Kpi l="Conversion today" v={t ? `${conv}%` : '...'} s="orders / visitors" />
        <Kpi l="Avg. order today" v={t ? formatPKR(aov) : '...'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Live visitors (${lv ? lv.online : 0})`}>
          {lv && lv.online === 0 && <p className="text-sm text-dim">Nobody is on the site right now.</p>}
          {lv && lv.online > 0 && (
            <>
              <p className="mb-2 text-xs text-dim">Devices: {Object.entries(lv.devices).map(([k, v]) => `${{ m: 'mobile', t: 'tablet', d: 'desktop' }[k] || k} ${v}`).join(' · ')}</p>
              <p className="mb-1 text-xs font-bold">Pages being viewed</p>
              <TopList items={lv.pages.map((p) => ({ k: p.k, v: p.v }))} pretty={(k) => k || '/'} />
              <p className="mb-1 mt-3 text-xs font-bold">Visitors</p>
              <ul className="max-h-40 space-y-0.5 overflow-auto text-xs text-dim">{lv.visitors.map((v, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{v.p || '/'}</span><span>{ago(v.ago)} ago</span></li>)}</ul>
            </>
          )}
        </Card>
        <Card title="Live order feed">
          {!lv || lv.feed.length === 0 ? <p className="text-sm text-dim">No orders yet.</p> : (
            <ul className="space-y-1.5 text-sm">{lv.feed.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2"><span><b>{o.id}</b> · {o.city || 'Pakistan'} · {o.n} item(s){o.b ? ' · backup' : ''}</span><span className="font-bold text-gold">{formatPKR(o.total)} <span className="text-xs font-normal text-dim">{new Date(o.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span></li>)}</ul>
          )}
        </Card>
      </div>

      {data && (
        <>
          <Card title="Visitors and page views"><LineChart labels={data.series.map((s) => s.d)} lines={[{ name: 'Page views', values: data.series.map((s) => s.views) }, { name: 'Visitors', values: data.series.map((s) => s.uv) }]} /></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Orders per day"><BarChart color="#F2A007" bars={data.series.map((s) => ({ label: s.d.slice(8), value: s.orders }))} /><p className="text-xs text-dim">Total: {data.series.reduce((a, s) => a + s.orders, 0)} orders, {formatPKR(data.series.reduce((a, s) => a + s.sales, 0))}</p></Card>
            <Card title="Sales per day (Rs)"><BarChart bars={data.series.map((s) => ({ label: s.d.slice(8), value: s.sales }))} /></Card>
          </div>
          <Card title="Page views by hour (last 24 h, Pakistan time)"><BarChart color="#2563EB" bars={data.hours.map((h) => ({ label: h.h, value: h.v }))} /></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Shopping funnel">
              <TopList items={[{ k: 'Products viewed', v: f.view }, { k: 'Added to cart', v: f.cart }, { k: 'Started checkout', v: f.checkout }, { k: 'Orders placed', v: f.order }]} />
              <p className="mt-2 text-xs text-dim">{f.view ? `${((f.cart / f.view) * 100).toFixed(1)}% add to cart` : ''}{f.cart ? ` · ${((f.checkout / f.cart) * 100).toFixed(1)}% start checkout` : ''}{f.checkout ? ` · ${((f.order / f.checkout) * 100).toFixed(1)}% finish` : ''}. WhatsApp taps: {f.wa}. Wishlist adds: {f.wish}. Checkouts that never became orders: {Math.max(0, f.checkout - f.order)}.</p>
            </Card>
            <div className="space-y-4">
              <Card title="Where visitors come from"><TopList items={data.sources} color="#7C3AED" pretty={pretty} /></Card>
              <Card title="Devices"><TopList items={data.devices} color="#2563EB" pretty={pretty} /></Card>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Most viewed products (7 days)"><TopList items={data.topProducts} pretty={pretty} /></Card>
            <Card title="Most added to cart (7 days)"><TopList items={data.topCart} color="#F2A007" pretty={pretty} /></Card>
            <Card title="What people search for (7 days)"><TopList items={data.topSearches} pretty={pretty} /></Card>
            <Card title="Searches with NO result (stock these!)"><TopList items={data.noResult} color="#DC2626" pretty={pretty} empty="Every search found something." /></Card>
          </div>
          <div className="text-center"><button type="button" className="btn-ghost text-xs" onClick={cleanup}>Delete tracking data older than 90 days</button></div>
        </>
      )}
    </div>
  );
}
