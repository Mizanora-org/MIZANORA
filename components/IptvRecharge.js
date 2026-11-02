'use client';
import { useMemo, useState } from 'react';
import { BadgeCheck, Check, Copy, Crown, Loader2, Lock, Smartphone, Sparkles, Wallet } from 'lucide-react';
import { IPTV, PLANS } from '@/lib/iptv';

const DURATIONS = [
  { months: 1, label: '1 mahina' },
  { months: 3, label: '3 mahine' },
  { months: 12, label: '12 mahine' },
];
const CREDIT_PACKS = [500, 1000, 2500, 5000];
const rs = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`;
const waNumber = (n) => String(n || IPTV.support).replace(/[^\d]/g, '');

export default function IptvRecharge() {
  const [mode, setMode] = useState('line');
  const [planId, setPlanId] = useState(PLANS.find((p) => p.popular)?.id || 'starter');
  const [months, setMonths] = useState(1);
  const [credit, setCredit] = useState(1000);
  const [copied, setCopied] = useState(false);
  const [unlocking, setUnlocking] = useState(true);

  const plan = PLANS.find((p) => p.id === planId) || PLANS[1];
  const price = Number(plan.priced?.[months] || 0);
  const monthly = Number(plan.priced?.[1] || 0);
  const save = Math.max(0, monthly * months - price);

  const message = useMemo(() => {
    if (mode === 'credit') return `Assalam-o-alaikum! Reseller credit recharge chahiye — ${rs(credit)}. Meri reseller ID: `;
    return `Assalam-o-alaikum! IPTV line ${price > 0 ? 'renew' : 'trial'} chahiye — ${plan.name}, ${months} mahina, ${rs(price)}. Username: `;
  }, [mode, plan.name, months, price, credit]);

  const wa = `https://wa.me/${waNumber()}?text=${encodeURIComponent(message)}`;

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(IPTV.support.replace(/(\d{4})(\d{7})/, '$1-$2'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="space-y-4">
      {/* Premium unlock animation — pure CSS, koi video file nahi chahiye */}
      <section
        className="mz-unlock relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-[#171008] via-[#0f1714] to-[#0b1310] p-6"
        onAnimationEnd={() => setUnlocking(false)}
      >
        <div className="mz-unlock-glow" aria-hidden />
        <div className="relative z-[2] flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`mz-lock grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold/40 bg-gold/10 ${unlocking ? 'mz-lock-on' : ''}`}>
              {unlocking ? <Lock size={22} className="text-gold" /> : <Crown size={24} className="text-gold" />}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold/80">Mizanora premium</p>
              <h2 className="font-display text-xl font-black text-cream">{unlocking ? 'Recharge = unlock' : 'Premium unlocked'}</h2>
              <p className="text-[11px] text-dim">Ek recharge, teenon device — live TV, movies, series, poora EPG.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
            {['Ad-free viewing', '4K jahan available', '7-din catch-up', 'Instant activation'].map((t) => (
              <span key={t} className="mz-spark flex items-center gap-1 rounded-full border border-gold/25 bg-black/30 px-2 py-1 text-gold/90"><Sparkles size={9} /> {t}</span>
            ))}
          </div>
        </div>
        <div className="mz-marquee relative z-[2] mt-4 overflow-hidden border-t border-gold/15 pt-2">
          <div className="mz-marquee-track text-[10px] font-bold uppercase tracking-[0.2em] text-faint">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className="inline-flex gap-8 pr-8">
                <span>JazzCash {IPTV.support.replace(/(\d{4})(\d{7})/, '$1-$2')}</span><span>·</span>
                <span>Cycle {IPTV.cycle.from}–{IPTV.cycle.to}</span><span>·</span>
                <span>Wholesale {rs(IPTV.wholesale)}</span><span>·</span>
                <span>Cap {rs(IPTV.cap)}/month</span><span>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-[11px] font-bold">
        {[['line', 'Line recharge / renewal'], ['credit', 'Reseller credit top-up']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)}
            className={`flex-1 rounded-lg px-3 py-2 transition ${mode === id ? 'bg-gold text-black' : 'text-dim hover:text-cream'}`}>{label}</button>
        ))}
      </div>

      {mode === 'line' ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {PLANS.filter((p) => !p.trial).map((p) => (
                <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                  className={`rounded-2xl border p-3 text-left transition ${planId === p.id ? 'border-gold bg-gold/10' : 'border-line bg-surface hover:border-gold/40'}`}>
                  <p className="font-display text-sm font-bold text-cream">{p.name}</p>
                  <p className="text-[10px] text-faint">{p.devices} device · {p.quality}</p>
                  <p className="mt-1 font-display text-base font-black text-gold">{rs(p.priced[1])}<span className="text-[10px] font-normal text-faint">/mahina</span></p>
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-[11px] font-bold">
              {DURATIONS.map((d) => (
                <button key={d.months} type="button" onClick={() => setMonths(d.months)}
                  className={`flex-1 rounded-lg px-2 py-2 transition ${months === d.months ? 'bg-raised text-cream ring-1 ring-gold/40' : 'text-dim'}`}>{d.label}</button>
              ))}
            </div>
            <div className="card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{plan.name} · {months} mahina</p>
              <div className="mt-1 flex items-end justify-between">
                <p className="font-display text-3xl font-black text-cream">{rs(price)}</p>
                {save > 0 && <p className="text-[11px] font-bold text-emerald-400">Bachat {rs(save)}</p>}
              </div>
              {plan.trial && <p className="text-[11px] text-dim">Trial free hai — koi payment nahi.</p>}
            </div>
          </div>

          <aside className="card space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint"><Wallet size={11} /> Payment kaise</p>
            <ol className="space-y-2 text-[11px] text-dim">
              {[
                'Neeche wale JazzCash number par amount bhejein.',
                'Transaction ID (TID) screenshot WhatsApp karein.',
                'Reseller panel se line chalu kar deta hai — 5 minute.',
                'Confirm hote hi app mein unlock ho jata hai.',
              ].map((t, i) => (
                <li key={t} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-[10px] font-bold text-gold">{i + 1}</span><span>{t}</span></li>
              ))}
            </ol>
            <div className="rounded-xl border border-line bg-raised p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-faint">JazzCash (Mizanora)</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-bold text-cream">{IPTV.support.replace(/(\d{4})(\d{7})/, '$1-$2')}</p>
                <button type="button" onClick={copyNumber} className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-dim hover:text-gold">
                  {copied ? <span className="flex items-center gap-1 text-emerald-400"><Check size={10} /> Copied</span> : <span className="flex items-center gap-1"><Copy size={10} /> Copy</span>}
                </button>
              </div>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold w-full justify-center"><Smartphone size={14} /> WhatsApp par bhejein</a>
            <p className="text-[10px] leading-relaxed text-faint">Cycle {IPTV.cycle.from}–{IPTV.cycle.to} tareekh. Cap {rs(IPTV.cap)}/mahina — koi bhi is se zyada nahi le sakta.</p>
          </aside>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
          <div className="card space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Credit pack</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CREDIT_PACKS.map((c) => (
                <button key={c} type="button" onClick={() => setCredit(c)}
                  className={`rounded-xl border p-2 text-center transition ${credit === c ? 'border-gold bg-gold/10' : 'border-line bg-raised'}`}>
                  <p className="font-display text-base font-black text-cream">{rs(c)}</p>
                  <p className="text-[10px] text-faint">{Math.floor(c / IPTV.wholesale)} lines</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-dim">
              Rs {IPTV.wholesale} per line per month wholesale. {Math.floor(credit / IPTV.wholesale)} credit = {Math.floor(credit / IPTV.wholesale)} client lines.
              Har credit kharch panel ke ledger mein likha jata hai.
            </p>
            <ul className="space-y-1 text-[11px] text-dim">
              <li className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-gold" /> Connection fee Rs {IPTV.fee.total} (aap ka {IPTV.fee.reseller}, Mizanora {IPTV.fee.admin})</li>
              <li className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-gold" /> Client se cap {rs(IPTV.cap)} tak — margin aap ka</li>
              <li className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-gold" /> Unlimited clients, jab tak credit hai</li>
            </ul>
          </div>
          <aside className="card space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Credit recharge</p>
            <p className="font-display text-2xl font-black text-cream">{rs(credit)}</p>
            <div className="rounded-xl border border-line bg-raised p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-faint">JazzCash (Mizanora)</p>
              <p className="font-mono text-sm font-bold text-cream">{IPTV.support.replace(/(\d{4})(\d{7})/, '$1-$2')}</p>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold w-full justify-center"><Smartphone size={14} /> Credit ke liye WhatsApp</a>
            <p className="text-[10px] text-faint">Reseller ID aur screenshot bhejein — credit 10 minute mein add.</p>
          </aside>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[10px] text-faint"><Loader2 size={10} className="animate-spin" /> Activation automate hai — payment confirm hote hi line chalu.</p>
    </div>
  );
}
