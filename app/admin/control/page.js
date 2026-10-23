'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { DEFAULT_HOURS, describeHours, shopOpenNow } from '@/lib/shopHours';

// Admin > Control: shut the website down, switch to HIGH ALERT, pause single features, and clean Firebase in a controlled way.
const FEATURES = [
  ['orders', 'New orders and promo codes'], ['assistant', 'AI voice assistant'], ['aiSearch', 'AI search helper'],
  ['imageReport', 'Broken-photo reports from visitors'], ['tracking', 'Order tracking by customers'], ['workers', 'Worker pages and tools'],
];
const MODES = {
  normal: { label: 'Normal', cls: 'bg-emerald-600', note: 'Everything works.' },
  saver: { label: 'HIGH ALERT (save reads)', cls: 'bg-amber-500', note: 'Shop stays online but never refreshes products from Firebase. Assistant, AI search and photo reports are off. Orders still work.' },
  down: { label: 'SHUT DOWN', cls: 'bg-red-600', note: 'Visitors see your reason. Every public function answers "closed". Nothing reads Firebase.' },
};

export default function Control() {
  const [st, setSt] = useState(null);
  const [mode, setMode] = useState('normal');
  const [reason, setReason] = useState('');
  const [backAt, setBackAt] = useState('');
  const [feat, setFeat] = useState({});
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [info, setInfo] = useState({ project: '', deletedToday: 0, env: false });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState('days');
  const [count, setCount] = useState(null);
  const [withCosts, setWithCosts] = useState(true);
  const [confirm, setConfirm] = useState('');
  const [limit, setLimit] = useState(5000);
  const [run, setRun] = useState(null);
  const [health, setHealth] = useState(null);
  const stop = useRef(false);

  const api = useCallback(async (body) => {
    const r = await fetch('/api/admin/site', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }, []);
  const load = useCallback(async () => {
    try {
      const j = await api({ action: 'get' });
      setSt(j.status); setMode(j.status.mode); setReason(j.status.reason); setBackAt(j.status.backAt); setFeat(j.status.features); setHours(j.status.hours || DEFAULT_HOURS);
      setInfo({ project: j.project, deletedToday: j.deletedToday, env: j.envOverride });
    } catch (e) { setMsg(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  const guard = async (key, fn) => { setBusy(key); setMsg(''); try { await fn(); } catch (e) { setMsg(e.message); } setBusy(''); };

  const apply = (m = mode) => guard('apply', async () => {
    if (m === 'down' && !window.confirm('Shut the website down now? Visitors will see your reason until you switch it back to Normal.')) return;
    const j = await api({ action: 'set', mode: m, reason, backAt, features: feat, hours });
    setSt(j.status); setMode(j.status.mode); setReason(j.status.reason);
    setMsg(m === 'down' ? 'The website is SHUT DOWN. Visitors now see your reason (the first page loads may take a minute to switch).' : m === 'saver' ? 'HIGH ALERT is on: no catalogue refreshes from Firebase.' : 'Saved. The shop is Normal.');
  });
  const panic = () => { setMode('down'); apply('down'); };

  const doCount = () => guard('count', async () => { const j = await api({ action: 'countRecent', amount, unit }); setCount(j.count); });
  const backup = () => guard('backup', async () => {
    const j = await api({ action: 'backupRecent', amount, unit });
    const url = URL.createObjectURL(new Blob([JSON.stringify(j.docs)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `products-backup-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setMsg(`Downloaded a backup of ${j.count} products (the newest 400 of the selection).`);
  });
  const del = (kind) => guard('del', async () => {
    if (confirm !== 'DELETE') { setMsg('Type DELETE in the box to confirm.'); return; }
    stop.current = false;
    let deleted = 0, writes = 0;
    setRun({ deleted, writes, running: true });
    while (!stop.current && deleted < limit) {
      const j = await api({ action: kind, amount, unit, withCosts, confirm });
      deleted += j.deleted; writes += j.writes;
      setRun({ deleted, writes, running: true });
      if (j.done) break;
    }
    setRun({ deleted, writes, running: false, stopped: stop.current });
    await revalidateSite();
    try { sessionStorage.removeItem('mz_admin_products'); } catch (_) { /* ignore */ }
    setConfirm(''); setCount(null); await load();
  });
  const checkHealth = () => guard('health', async () => { const r = await fetch('/api/health', { cache: 'no-store' }); setHealth(await r.json()); });
  const refreshShop = () => guard('refresh', async () => { if (!window.confirm('Refresh all shop data now? This re-reads the live products from Firebase once (about one read per live product).')) return; await revalidateSite(); setMsg('Shop data refresh requested.'); });

  const cur = st ? MODES[st.mode] : null;
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Control room</h1>
        <p className="mt-1 text-sm text-dim">Use this when Firebase reads or writes are running high. Everything here works only for you; visitors just see the result.</p>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}
      {info.env && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">The Vercel variable SITE_MODE is set, so it overrides the buttons below. Remove it in Vercel and redeploy to use them.</p>}

      {cur && <div className={`rounded-2xl p-4 text-white ${cur.cls}`}><p className="text-sm font-semibold uppercase tracking-wide">Website status now</p><p className="text-2xl font-extrabold">{cur.label}</p><p className="text-sm opacity-90">{cur.note}</p>{st.since > 0 && st.mode !== 'normal' && <p className="mt-1 text-xs opacity-80">Since {new Date(st.since).toLocaleString()}</p>}</div>}

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">1. Website mode</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(MODES).map(([k, m]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-xl border-2 p-3 text-left text-sm ${mode === k ? 'border-gold bg-gold/5' : 'border-line'}`}><b className="block">{m.label}</b><span className="text-xs text-dim">{m.note}</span></button>
          ))}
        </div>
        <label className="block text-sm"><span className="label">Reason visitors will see {mode === 'down' ? '' : '(used when shut down)'}</span>
          <textarea className="input" rows={3} maxLength={400} placeholder="Example: Our system is being upgraded. Orders already placed are safe. We will be back tonight." value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label className="block text-sm"><span className="label">Expected back (optional text)</span><input className="input" placeholder="Tomorrow 10 AM" value={backAt} onChange={(e) => setBackAt(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" disabled={busy === 'apply'} onClick={() => apply()}>{busy === 'apply' ? 'Saving...' : `Apply: ${MODES[mode].label}`}</button>
          <button type="button" className="rounded-full bg-red-600 px-5 py-3 text-sm font-extrabold text-white" disabled={busy === 'apply'} onClick={panic}>PANIC: SHUT DOWN NOW</button>
        </div>
        <p className="text-xs text-dim">If Firebase is so full that this page cannot save, set <b>SITE_MODE=down</b> and <b>SITE_DOWN_REASON</b> in Vercel &gt; Environment Variables and redeploy. That needs no Firebase at all.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">Shop hours (open / closed by the clock)</h2>
        <p className="text-xs text-dim">Outside these hours visitors see &quot;Shop is closed&quot; and the live Quran keeps playing. The shop opens again by itself. Pakistan time. Emergency shut-down above always wins.</p>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={hours.enabled} onChange={(e) => setHours((h) => ({ ...h, enabled: e.target.checked }))} /> Use shop hours</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="label">Opens at</span><input type="time" className="input" value={hours.open} onChange={(e) => setHours((h) => ({ ...h, open: e.target.value }))} /></label>
          <label className="block text-sm"><span className="label">Closes at</span><input type="time" className="input" value={hours.close} onChange={(e) => setHours((h) => ({ ...h, close: e.target.value }))} /></label>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((n, d) => { const on = !hours.days.length || hours.days.includes(d); return <button key={n} type="button" onClick={() => setHours((h) => { const cur = h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6]; const nx = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]; return { ...h, days: nx.length === 7 ? [] : nx }; })} className={`rounded-full border px-3 py-1 font-semibold ${on ? 'border-gold bg-gold/10' : 'border-line text-dim'}`}>{n}</button>; })}
        </div>
        <label className="block text-sm"><span className="label">Message while closed (optional)</span><input className="input" maxLength={200} placeholder="Dukaan subah 9 baje khulegi. Tab tak Quran sunein." value={hours.closedMessage} onChange={(e) => setHours((h) => ({ ...h, closedMessage: e.target.value }))} /></label>
        <p className="text-xs text-dim">{describeHours(hours)} Right now: <b>{shopOpenNow(hours).open ? 'OPEN' : 'CLOSED'}</b>. Press Apply above to save.</p>
        <button type="button" className="btn-ghost" disabled={busy === 'apply'} onClick={() => apply()}>Save shop hours</button>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-extrabold">2. Switch single features off</h2>
        <p className="text-xs text-dim">Untick a function to stop it for the public. The shop itself stays up. Press Apply above to save.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {FEATURES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={feat[k] !== false} onChange={(e) => setFeat((f) => ({ ...f, [k]: e.target.checked }))} /> {l}</label>)}
        </div>
        <button type="button" className="btn-ghost" disabled={busy === 'apply'} onClick={() => apply()}>Save switches</button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">3. Delete recently added products</h2>
        <p className="text-xs text-dim">Removes the products that were ADDED in the chosen time (by their creation time) and their saved cost and photo-error notes. Every delete is a write: the free plan allows 20,000 writes a day for everything together (each product here uses 3). Deleted today by this tool: <b>{info.deletedToday.toLocaleString()}</b> writes.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Added in the last <input type="number" min="1" className="input !w-20 !py-1.5" value={amount} onChange={(e) => { setAmount(Math.max(1, Number(e.target.value) || 1)); setCount(null); }} />
          <select className="input !w-28 !py-1.5" value={unit} onChange={(e) => { setUnit(e.target.value); setCount(null); }}><option value="hours">hours</option><option value="days">days</option></select>
          <button type="button" className="btn-ghost" disabled={busy === 'count'} onClick={doCount}>Count them</button>
          {count !== null && <b>{count.toLocaleString()} products{count * 3 > 20000 ? ' (more than one day of free writes: delete in several days)' : ''}</b>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={withCosts} onChange={(e) => setWithCosts(e.target.checked)} /> Also delete their saved supplier cost</label>
          <label className="flex items-center gap-1">Delete at most <input type="number" min="200" step="200" className="input !w-24 !py-1.5" value={limit} onChange={(e) => setLimit(Math.max(200, Number(e.target.value) || 200))} /> now</label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" disabled={busy === 'backup'} onClick={backup}>Download backup first (newest 400)</button>
          <input className="input !w-40 !py-1.5" placeholder="type DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button type="button" className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white" disabled={busy === 'del'} onClick={() => del('deleteRecent')}>Delete these products</button>
          {run && run.running && <button type="button" className="btn-ghost" onClick={() => { stop.current = true; }}>Stop</button>}
        </div>
        {run && <p className="text-sm text-dim">{run.running ? 'Deleting... ' : run.stopped ? 'Stopped. ' : 'Finished. '}{run.deleted.toLocaleString()} products removed, {run.writes.toLocaleString()} writes used.</p>}
        <div className="border-t border-line pt-3">
          <p className="text-xs text-dim">Hidden products (switched off, for example because of broken photos):</p>
          <button type="button" className="mt-1 rounded-full bg-red-600/90 px-4 py-2 text-sm font-bold text-white" disabled={busy === 'del'} onClick={() => del('deleteHidden')}>Delete all hidden products</button>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-extrabold">4. Firebase tools</h2>
        <div className="flex flex-wrap gap-2">
          {info.project && <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://console.firebase.google.com/project/${info.project}/firestore/usage`}>Open Firebase usage (reads / writes)</a>}
          <button type="button" className="btn-ghost" disabled={busy === 'health'} onClick={checkHealth}>Test Firebase now</button>
          <button type="button" className="btn-ghost" disabled={busy === 'refresh'} onClick={refreshShop}>Refresh shop data</button>
        </div>
        {health && <p className="rounded-xl bg-raised p-3 text-sm">{health.ordersCanBeSaved ? 'Orders can be saved.' : `ORDERS ARE FAILING: ${health.ordersProblem || 'unknown'}`} Products live on the shop: {(health.totalProducts ?? health.productsVisibleOnSite ?? 0).toLocaleString()}.</p>}
        <p className="text-xs text-dim">The free (Spark) quota resets every day around midnight Pacific time. If reads keep hitting 50,000, move old products to the archive (Admin &gt; Archive) and use HIGH ALERT while you fix it.</p>
      </section>
    </div>
  );
}
