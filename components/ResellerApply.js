'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, LogIn, MessageCircle, Rocket, Send } from 'lucide-react';
import { cleanApply } from '@/lib/iptvReseller';
import { waLink } from '@/lib/config';
import { useAuth } from './AuthProvider';
import { authClient } from '@/lib/firebase-client';

const EXPERIENCE = [
  ['none', 'Naya hoon'],
  ['cable', 'Cable / DTH operator'],
  ['mobile', 'Mobile / accessories shop'],
  ['other', 'Kuch aur'],
];

export default function ResellerApply() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', city: '', cnic: '', experience: 'none', note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr(''); };

  async function submit(e) {
    e.preventDefault();
    const v = cleanApply(form);
    if (!v.ok) { setErr(v.error); return; }
    setBusy(true); setErr('');
    try {
      const token = authClient().currentUser ? await authClient().currentUser.getIdToken() : '';
      const r = await fetch('/api/reseller/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(v.data),
      });
      const j = await r.json().catch(() => ({ ok: false, error: 'Server ne jawab nahi diya.' }));
      if (!j.ok) {
        if (j.fallback) { setDone({ ...v.data, fallback: true }); setBusy(false); return; }
        setErr(j.error || 'Application nahi gayi.'); setBusy(false); return;
      }
      setDone({ ...v.data, approved: j.approved === true, credit: j.credit || 0 });
    } catch {
      setErr('Internet ka masla lagta hai — WhatsApp par bhej dein.');
    }
    setBusy(false);
  }

  if (done?.approved) {
    return (
      <div className="card border-gold/50 bg-gold/[0.06]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><Rocket size={22} /></span>
          <div>
            <h3 className="font-display text-xl font-extrabold">Approved — panel chalu hai</h3>
            <p className="mt-1 text-sm text-dim">
              Mubarak ho {String(done.name).split(' ')[0]}! Aap ka reseller account foran manzoor ho gaya
              {done.credit ? <> — <b>{done.credit} lines</b> ka credit</> : null}. Panel kholein aur pehla client banayein.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/reseller" className="btn-gold"><Rocket size={15} /> Reseller panel</Link>
              <a className="btn-ghost" href={waLink('Mera reseller panel chalu ho gaya hai — madad chahiye.')} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const msg = `Assalam o Alaikum, main Mizanora IPTV reseller banna chahta hoon.\nNaam: ${done.name}\nPhone: ${done.phone}\nShehr: ${done.city}\nExperience: ${done.experience}`;
    return (
      <div className="card border-gold/40 bg-gold/[0.04]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><CheckCircle2 size={22} /></span>
          <div>
            <h3 className="font-display text-xl font-extrabold">Application mil gayi</h3>
            <p className="mt-1 text-sm text-dim">
              {done.fallback
                ? 'Online approval filhal band hai — WhatsApp par bhejein, 1 din mein panel chalu ho jayega.'
                : 'Aap sign in nahi hain, is liye review queue mein chali gayi hai. Sign in kar ke dobara bhejein to foran approve ho jati hai.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/account" className="btn-gold"><LogIn size={15} /> Sign in</Link>
              <a className="btn-ghost" href={waLink(msg)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3" id="apply">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold">Reseller banein</h2>
          <p className="text-xs text-dim">Rs 30 connection fee + Rs 100 per line per mahina — unlimited clients, apni price (cap Rs 200).</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${user ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-raised text-dim'}`}>
          {user ? 'Foran approve hoga' : 'Sign in = foran approve'}
        </span>
      </div>

      {!user && (
        <p className="rounded-xl border border-line bg-raised px-3 py-2 text-xs text-dim">
          <b className="text-cream">Tip:</b> pehle{' '}
          <Link href="/account" className="font-semibold text-gold underline underline-offset-4">Google se sign in</Link>{' '}
          karein — phir application bhejne par panel <b>turant</b> chalu ho jata hai (admin ka intezaar nahi).
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Poora naam</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ali Raza" autoComplete="name" required />
        </label>
        <label className="block"><span className="label">WhatsApp number</span>
          <input className="input" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XX-XXXXXXX" autoComplete="tel" required />
        </label>
        <label className="block"><span className="label">Shehr</span>
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Kasur" autoComplete="address-level2" required />
        </label>
        <label className="block"><span className="label">CNIC (optional)</span>
          <input className="input" inputMode="numeric" value={form.cnic} onChange={(e) => set('cnic', e.target.value)} placeholder="35201-XXXXXXX-X" />
        </label>
        <label className="block"><span className="label">Aap ka kaam</span>
          <select className="input" value={form.experience} onChange={(e) => set('experience', e.target.value)}>
            {EXPERIENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Kitne clients expect hain?</span>
          <input className="input" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Misaal: 40–50 ghar" />
        </label>
      </div>

      {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-gold" disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {user ? 'Bhejein — foran approve' : 'Application bhejein'}
        </button>
        <span className="text-[11px] text-faint">Koi charge nahi — approval free hai.</span>
      </div>
    </form>
  );
}
