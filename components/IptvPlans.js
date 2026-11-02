'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, ArrowRight, BadgeCheck } from 'lucide-react';
import { MONTHS, PLANS, IPTV, planPrice, monthlyEquivalent, pkr } from '@/lib/iptv';
import { waLink } from '@/lib/config';

export default function IptvPlans({ startMonths = 1 }) {
  const [months, setMonths] = useState(startMonths);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Plans</h2>
          <p className="mt-1 text-sm text-dim">
            Rs {IPTV.fee.total} connection fee (pehla month shamil) — uske baad mahine ka charge.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {MONTHS.map((m) => (
            <button key={m.months} type="button" onClick={() => setMonths(m.months)}
              aria-pressed={months === m.months}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${months === m.months ? 'bg-gold text-white shadow' : 'text-dim hover:text-gold'}`}>
              {m.label}
              {m.note !== 'monthly' && <span className={`ml-1 text-[10px] ${months === m.months ? 'text-white/80' : 'text-faint'}`}>{m.note}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const price = planPrice(p.id, months);
          const perMonth = monthlyEquivalent(p.id, months);
          const msg = `Assalam o Alaikum, mujhe Mizanora IPTV chahiye: ${p.name} — ${months} month${months > 1 ? 's' : ''} (${pkr(price)}).`;
          return (
            <article key={p.id}
              className={`card flex flex-col ${p.popular ? 'border-gold ring-1 ring-gold/30' : ''} ${p.trial ? 'border-dashed bg-raised/40' : ''}`}>
              {p.popular && (
                <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gold">
                  <Sparkles size={10} /> Sab se popular
                </span>
              )}
              <h3 className="font-display text-lg font-extrabold">{p.name}</h3>
              <p className="text-xs text-faint">{p.for}</p>

              <div className="mt-3">
                {p.trial ? (
                  <p className="font-display text-3xl font-black text-gold">Free</p>
                ) : (
                  <>
                    <p className="font-display text-3xl font-black">{pkr(price)}</p>
                    <p className="text-[11px] text-faint">
                      {months > 1 ? `${pkr(perMonth)}/month · ${months} mahine ek saath` : 'per month'}
                    </p>
                  </>
                )}
              </div>

              <ul className="mt-3 flex-1 space-y-1.5 text-[13px] text-dim">
                {p.includes.map((f) => (
                  <li key={f} className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-gold" />{f}</li>
                ))}
              </ul>

              <div className="mt-4 space-y-1.5">
                {p.trial ? (
                  <Link href="/iptv/trial" className="btn-ghost w-full">Trial start karein</Link>
                ) : (
                  <a href={waLink(msg)} target="_blank" rel="noreferrer" className="btn-gold w-full">
                    Line lein <ArrowRight size={15} />
                  </a>
                )}
                <p className="flex items-center justify-center gap-1 text-[10px] text-faint">
                  <BadgeCheck size={11} className="text-gold" />
                  {p.devices} device · {p.quality}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-faint">
        Reseller Rs {IPTV.cap} mahina se zyada charge nahi kar sakta. Payment har mahine {IPTV.cycle.from}–{IPTV.cycle.to} tareekh
        ke darmiyan JazzCash / Easypaisa / bank se. Trial ke liye card nahi chahiye.
      </p>
    </div>
  );
}
