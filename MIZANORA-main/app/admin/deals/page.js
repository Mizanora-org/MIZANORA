'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Copy, ExternalLink, Flame } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { DEALS_DEFAULT, DEALS_DOC, cleanDeals } from '@/lib/deals';
import { absUrl } from '@/lib/config';

// Admin > Deals: settings of the one-link deals page (/deals). Which products are deals is automatic: every in-stock product whose
// price is lower than its old price ("compare price"). To make a deal, set an old price on a product (Admin > Products), or ask the AI manager.
const pad = (n) => String(n).padStart(2, '0');
const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function AdminDeals() {
  const [cfg, setCfg] = useState(null);
  const [pinned, setPinned] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(dbClient(), DEALS_DOC.collection, DEALS_DOC.id)).then((d) => {
      const c = d.exists() ? cleanDeals({ ...DEALS_DEFAULT, ...d.data() }) : DEALS_DEFAULT;
      setCfg(c); setPinned(c.pinned.join('\n'));
    }).catch((e) => { setMsg(`Could not read: ${e.message}`); setCfg(DEALS_DEFAULT); });
  }, []);
  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const link = absUrl('/deals');

  async function save() {
    setBusy(true); setMsg('');
    try {
      const clean = cleanDeals({ ...cfg, pinned });
      await setDoc(doc(dbClient(), DEALS_DOC.collection, DEALS_DOC.id), { ...clean, updatedAtMs: Date.now() });
      setCfg(clean); setPinned(clean.pinned.join('\n'));
      await revalidateSite(undefined, ['deals-config']);
      setMsg('Saved. /deals is updated within a few seconds.');
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy(false);
  }
  const copy = async () => { try { await navigator.clipboard.writeText(link); setMsg('Link copied.'); } catch { setMsg(link); } };

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Flame className="text-saffron" /> Deals page</h1>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <section className="card space-y-2">
        <h2 className="text-lg font-extrabold">Your one deals link</h2>
        <p className="break-all rounded-xl bg-raised p-3 font-mono text-sm">{link}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className="btn-ghost !px-4 !py-2 text-sm"><Copy size={15} /> Copy link</button>
          <Link href="/deals" target="_blank" className="btn-ghost !px-4 !py-2 text-sm"><ExternalLink size={15} /> Open</Link>
        </div>
        <p className="text-xs text-dim">Every in-stock product whose price is under its old price (compare price) appears here by itself, live products and catalogue-file products together, biggest discount first. Share this one link on WhatsApp, Facebook, Instagram and TikTok.</p>
      </section>

      <section className="card space-y-3">
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={cfg.enabled} onChange={(e) => set('enabled', e.target.checked)} /> <b>Deals page is on</b></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="label">Title</span><input className="input" maxLength={60} value={cfg.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Badge text</span><input className="input" maxLength={24} value={cfg.badge} onChange={(e) => set('badge', e.target.value)} /></label>
          <label className="block text-sm sm:col-span-2"><span className="label">Sub-title</span><input className="input" maxLength={160} value={cfg.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Smallest discount that counts as a deal (%)</span><input type="number" min={1} max={90} className="input" value={cfg.minPct} onChange={(e) => set('minPct', Number(e.target.value) || 5)} /></label>
          <label className="block text-sm"><span className="label">Countdown: deals end at (optional)</span><input type="datetime-local" className="input" value={toLocal(cfg.endsAtMs)} onChange={(e) => set('endsAtMs', e.target.value ? new Date(e.target.value).getTime() : 0)} /></label>
        </div>
        <label className="block text-sm"><span className="label">Hot picks: product slugs shown first (one per line)</span>
          <textarea className="input" rows={4} value={pinned} onChange={(e) => setPinned(e.target.value)} placeholder="men-leather-wallet-black" /></label>
        <p className="text-xs text-dim">The countdown is only a banner: it does not change any price. A real, automatic price end is the "sale ends" option on the product.</p>
        <button type="button" className="btn-gold" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
      </section>
    </div>
  );
}
