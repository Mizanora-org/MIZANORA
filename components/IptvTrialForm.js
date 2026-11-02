'use client';
import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Tv, Smartphone, MonitorSmartphone } from 'lucide-react';
import { PLANS, IPTV, cleanPhone, cleanTrial } from '@/lib/iptv';
import { waLink } from '@/lib/config';

const DEVICES = [
  { id: 'xtream', label: 'Tivimate / Smarters', icon: Smartphone },
  { id: 'mag', label: 'MAG / Stalker box', icon: MonitorSmartphone },
  { id: 'smarttv', label: 'Smart TV (Tizen / webOS)', icon: Tv },
  { id: 'phone', label: 'Phone / browser', icon: Smartphone },
];

export default function IptvTrialForm() {
  const [form, setForm] = useState({ name: '', phone: '', city: '', device: 'xtream', plan: 'starter' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr(''); };

  async function submit(e) {
    e.preventDefault();
    const v = cleanTrial(form);
    if (!v.ok) { setErr(v.error); return; }
    if (!cleanPhone(form.phone)) { setErr('Sahi mobile number likhein (03XX-XXXXXXX).'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/iptv/trial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v.data),
      });
      const j = await r.json().catch(() => ({ ok: false, error: 'Server ne jawab nahi diya.' }));
      if (!j.ok) { setErr(j.error || 'Request nahi gayi. Dobara koshish karein.'); setBusy(false); return; }
      setDone(v.data);
    } catch {
      setErr('Internet ka masla lagta hai. WhatsApp par bhej dein.');
    }
    setBusy(false);
  }

  if (done) {
    const msg = `Assalam o Alaikum, maine Mizanora IPTV trial request bheji hai.\nNaam: ${done.name}\nPhone: ${done.phone}\nShehr: ${done.city}\nDevice: ${done.device}`;
    return (
      <div className="card border-gold/40 bg-gold/[0.04]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><CheckCircle2 size={22} /></span>
          <div>
            <h3 className="font-display text-xl font-extrabold">Request mil gayi</h3>
            <p className="mt-1 text-sm text-dim">
              Shukriya {done.name.split(' ')[0]}! Hamari team {done.phone} par {IPTV.trialHours} ghante ka trial
              line bana kar WhatsApp par bhej degi. Aam tor par 15–30 minute lagte hain.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={waLink(msg)} target="_blank" rel="noreferrer" className="btn-gold">
                <MessageCircle size={16} /> WhatsApp par bhi bhejein
              </a>
              <button type="button" className="btn-ghost" onClick={() => { setDone(null); setForm({ name: '', phone: '', city: '', device: 'xtream', plan: 'starter' }); }}>
                Aur aik trial
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Poora naam</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Misaal: Ali Raza" autoComplete="name" required />
        </label>
        <label className="block">
          <span className="label">WhatsApp number</span>
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XX-XXXXXXX" inputMode="tel" autoComplete="tel" required />
        </label>
        <label className="block">
          <span className="label">Shehr</span>
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Kasur" autoComplete="address-level2" required />
        </label>
        <label className="block">
          <span className="label">Plan pasand</span>
          <select className="input" value={form.plan} onChange={(e) => set('plan', e.target.value)}>
            {PLANS.filter((p) => !p.trial).map((p) => <option key={p.id} value={p.id}>{p.name} — Rs {p.priced[1]}/month</option>)}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="label">Device</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" onClick={() => set('device', d.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-semibold transition ${form.device === d.id ? 'border-gold bg-gold/[0.08] text-gold' : 'border-line bg-raised text-dim hover:border-gold/40'}`}>
              <d.icon size={17} /> {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      {err && <p className="field-err" role="alert">{err}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-gold" disabled={busy}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> Bheja ja raha hai…</> : <>Free trial request</>}
        </button>
        <span className="text-[11px] text-faint">
          {IPTV.trialHours} ghante · 1 device · koi card nahi. Number sirf trial ke liye — spam nahi.
        </span>
      </div>
    </form>
  );
}
