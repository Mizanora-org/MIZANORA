import Link from 'next/link';
import { ArrowRight, KeyRound, ShieldCheck, Zap } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import IptvClaim from '@/components/IptvClaim';
import { IPTV } from '@/lib/iptv';

export const metadata = pageMeta({
  title: 'Apni IPTV key — Google se sign in, free trial foran',
  description:
    'Mizanora IPTV account: Google se sign in karein aur 24 ghante ki free Xtream key foran lein. Username, password, server — sab turant, koi intezaar nahi.',
  path: '/iptv/start',
});

const FAQ = [
  ['Key foran milti hai?', `Haan. Google ya email se sign in karne ke baad "Free key banayein" dabate hi ${IPTV.trialHours} ghante ki line ban jati hai — username, password aur server usi screen par.`],
  ['Kya card ya payment chahiye?', 'Nahi. Trial free hai, koi card save nahi hota, koi auto-charge nahi. Trial ke baad plan lena ho to WhatsApp par batayein.'],
  ['Aik account par kitni keys?', 'Trial aik dafa. Uske baad har plan ki apni line hoti hai — reseller ya Mizanora seedha bana dete hain.'],
  ['Key kahan use karun?', 'TiviMate, IPTV Smarters, Smart TV ka Set IPTV app, ya MAG box — Xtream login ya MAC, dono chalte hain.'],
];

export default function IptvStartPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/start', 'My key']]), faqJsonLd(FAQ)]} />
      <PageHead
        title="Apni IPTV key"
        intro={`Sign in karein — ${IPTV.trialHours} ghante ki free key foran ban jati hai. Koi form, koi wait, koi card nahi.`}
        crumbs={[['/', 'Home'], ['/iptv', 'IPTV'], [null, 'My key']]}
      />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            [Zap, 'Foran', 'Sign in → key, 10 second'],
            [KeyRound, 'Xtream + MAC', 'Dono tarah ka login'],
            [ShieldCheck, 'Apna account', 'Key aap ke account se bandhi'],
          ].map(([Icon, t, d]) => (
            <div key={t} className="card">
              <Icon size={16} className="text-gold" />
              <p className="mt-1.5 font-display text-sm font-bold">{t}</p>
              <p className="text-[11px] text-faint">{d}</p>
            </div>
          ))}
        </div>

        <IptvClaim />

        <section className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card">
              <summary className="cursor-pointer list-none font-display font-bold">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-dim">{a}</p>
            </details>
          ))}
        </section>

        <div className="card flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-dim">Trial ke baad poora plan chahiye?</p>
          <div className="flex gap-2">
            <Link href="/iptv#plans" className="btn-gold">Plans dekhein <ArrowRight size={14} /></Link>
            <Link href="/iptv/reseller" className="btn-ghost">Reseller banein</Link>
          </div>
        </div>
      </div>
    </>
  );
}
