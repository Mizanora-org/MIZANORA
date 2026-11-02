'use client';
import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react';
import { cleanApply } from '@/lib/iptvReseller';
import { waLink } from '@/lib/config';

const EXPERIENCE = [
  ['none', 'Naya hoon'],
  ['cable', 'Cable / DTH operator'],
  ['mobile', 'Mobile / accessories shop'],
  ['other', 'Kuch aur'],
];

export default function ResellerApply() {
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
      const r = await fetch('/api/reseller/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v.data, uid: '' }),
      });
      const j = await r.json().catch(() => ({ ok: false, error: 'Server ne jawab nahi diya.' }));
      if (!j.ok) {
        if (j.fallback) { setDone({ ...v.data, fallback: true }); setBusy(false); return; }
        setErr(j.error || 'Application nahi gayi.'); setBusy(false); return;
      }
      setDone(v.data);
    } catch {
      setErr('Internet ka masla lagta hai — WhatsApp par bhej dein.');
    }
    setBusy(false);
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
              24 ghante mein review hogi — approve hone par aap ka <b>/reseller</b> panel chalu ho jayega (10 lines credit ke saath).
              Tez chahiye to WhatsApp par bhi bhej dein.
            </p>
            <a className="btn-gold mt-3" href={waLink(msg)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp par bhejein</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3" id="apply">
      <div>
        <h2 className="font-display text-xl font-extrabold">Reseller banein</h2>
        <p className="text-xs text-dim">Rs 30 connection fee + Rs 100 per line per mahina — unlimited clients, apni price (cap Rs 200).</p>
      </div>

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
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Application bhejein
        </button>
        <span className="text-[11px] text-faint">Koi charge nahi — approval free hai.</span>
      </div>
    </form>
  );
}
