import Link from 'next/link';
import { ArrowRight, CheckCircle2, Wallet, Users, ShieldCheck } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import IptvResellerCalc from '@/components/IptvResellerCalc';
import ResellerApply from '@/components/ResellerApply';
import { IPTV, RESELLER_PACKS, RESELLER_RULES, pkr } from '@/lib/iptv';
import { waLink } from '@/lib/config';

export const metadata = pageMeta({
  title: 'Mizanora IPTV reseller program — unlimited clients, Rs 100 profit per line',
  description:
    'Become a Mizanora IPTV reseller: Rs 30 from every new connection, Rs 100 profit per active line every month, unlimited clients, your own payment numbers and pricing up to Rs 200. Payments collected 1–10 every month.',
  path: '/iptv/reseller',
});

const FAQ = [
  ['Reseller banne ka kitna kharcha hai?', 'Registration free hai. Starter pack Rs 1,000 (10 connections) se shuru hota hai — trial reseller ke liye 2 connections 7 din free.'],
  ['Main kitne clients bana sakta hoon?', 'Jitne chahiye. Register hone ke baad koi limit nahi — har active line ka Rs 100 mahina Mizanora ko jata hai.'],
  ['Mujhe client se kitna lena hai?', `Rs ${IPTV.fee.total} connection fee (pehla month shamil) aur uske baad Rs ${IPTV.cap} mahina — cap se zyada system khud rok deta hai.`],
  ['Payment kab tak karni hai?', `Har mahine ${IPTV.cycle.from} se ${IPTV.cycle.to} tareekh tak, JazzCash ${'0306-2015326'} par. ${IPTV.suspendDay} tareekh tak na aaye to aap ki lines auto-suspend ho jati hain.`],
  ['Client kaise pay karega?', 'Aap panel mein apna JazzCash / Easypaisa / bank number set karte hain. Client ko recharge screen par wohi naam aur number dikhta hai.'],
];

export default function ResellerPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/reseller', 'Reseller']]), faqJsonLd(FAQ)]} />
      <PageHead
        title="Mizanora IPTV reseller"
        intro={`Rs ${IPTV.fee.reseller} har nayi connection par, aur Rs ${IPTV.resellerMargin} har active line par — har mahine. Clients unlimited.`}
        crumbs={[['/', 'Home'], ['/iptv', 'IPTV'], [null, 'Reseller']]}
      />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {/* economy */}
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Wallet, pkr(IPTV.fee.total), 'Connection fee', `Rs ${IPTV.fee.reseller} aap ka · Rs ${IPTV.fee.admin} Mizanora`],
            [Users, pkr(IPTV.cap), 'Client ka monthly', `Rs ${IPTV.wholesale} Mizanora · Rs ${IPTV.resellerMargin} aap ka`],
            [CheckCircle2, 'Unlimited', 'Clients', 'Koi limit nahi'],
            [ShieldCheck, `${IPTV.cycle.from}–${IPTV.cycle.to}`, 'Collection window', `${IPTV.suspendDay} tareekh par auto-suspend`],
          ].map(([Icon, v, l, s]) => (
            <div key={l} className="card">
              <Icon size={16} className="text-gold" />
              <p className="mt-2 font-display text-2xl font-black">{v}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
              <p className="mt-1 text-[11px] text-dim">{s}</p>
            </div>
          ))}
        </section>

        {/* calculator + rules */}
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <IptvResellerCalc />
          <div className="card">
            <h2 className="font-display text-lg font-extrabold">Rules — saaf saaf</h2>
            <ul className="mt-3 space-y-2.5">
              {RESELLER_RULES.map(([t, d]) => (
                <li key={t} className="flex gap-2 text-sm">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold" />
                  <span><b>{t}</b><span className="block text-dim">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* packs */}
        <section>
          <h2 className="section-title mb-1">Reseller packs</h2>
          <p className="mb-4 text-sm text-dim">Pack ki zaroorat sirf pehli baar hai — uske baad clients ke hisaab se wholesale chalta rehta hai.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RESELLER_PACKS.map((p) => (
              <div key={p.id} className={`card ${p.id === 'growth' ? 'border-gold ring-1 ring-gold/25' : ''}`}>
                <h3 className="font-display text-base font-extrabold">{p.name}</h3>
                <p className="mt-1 font-display text-2xl font-black">{p.price ? pkr(p.price) : 'Free'}</p>
                <p className="text-[11px] text-faint">{p.connections} connections{p.bonus ? ` + ${p.bonus} free` : ''}</p>
                <p className="mt-2 text-xs text-dim">{p.note}</p>
                <a className="btn-ghost mt-3 w-full" href={waLink(`Assalam o Alaikum, mujhe ${p.name} reseller pack chahiye.`)} target="_blank" rel="noreferrer">
                  Shuru karein <ArrowRight size={14} />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* join */}
        <section className="card border-gold/30 bg-gold/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold">Pehle se reseller hain?</h2>
              <p className="mt-1 text-sm text-dim">
                Apna panel kholain — clients, lines, price aur kamai wahan hai. Sign in wohi Mizanora account se.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="btn-gold" href="/reseller">Reseller panel</Link>
              <a className="btn-ghost" href={waLink('Assalam o Alaikum, mujhe Mizanora IPTV reseller banna hai.')} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* apply */}
        <ResellerApply />

        {/* faq */}
        <section>
          <h2 className="section-title mb-4">Reseller sawal</h2>
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card">
                <summary className="cursor-pointer list-none font-display font-bold">{q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-dim">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
