import Link from 'next/link';
import { CheckCircle2, Clock3, ShieldCheck, MessageCircle } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import IptvTrialForm from '@/components/IptvTrialForm';
import { IPTV } from '@/lib/iptv';
import { waLink } from '@/lib/config';

export const metadata = pageMeta({
  title: 'Free 24-hour IPTV trial — Mizanora',
  description:
    'Get a free 24-hour Mizanora IPTV trial on one device. Xtream Codes or Stalker/MAC, no card, no auto-charge. Works on TiviMate, IPTV Smarters, Smart TV and MAG boxes.',
  path: '/iptv/trial',
});

export default function TrialPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/trial', 'Free trial']])} />
      <PageHead
        title="Free 24-hour trial"
        intro="Aik device, poore channels, koi card nahi. Request bhejein — team WhatsApp par line bhej degi."
        crumbs={[['/', 'Home'], ['/iptv', 'IPTV'], [null, 'Free trial']]}
      />

      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8 lg:grid-cols-[1.15fr_.85fr]">
        <IptvTrialForm />

        <div className="space-y-3">
          <div className="card">
            <h2 className="font-display text-base font-bold">Trial mein kya milta hai</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-dim">
              {[
                `${IPTV.trialHours} ghante tak live channels`,
                '1 device par — Xtream ya MAC',
                'Poora EPG guide',
                'Koi card, koi auto-charge nahi',
              ].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="flex items-center gap-2 font-display text-base font-bold"><Clock3 size={16} className="text-gold" /> Kitni der mein?</h2>
            <p className="mt-1 text-sm text-dim">
              Aam tor par 15–30 minute. Raat 10 baje ke baad requests subah di jati hain.
            </p>
          </div>

          <div className="card border-gold/30 bg-gold/[0.05]">
            <h2 className="flex items-center gap-2 font-display text-base font-bold"><ShieldCheck size={16} className="text-gold" /> Number safe hai</h2>
            <p className="mt-1 text-sm text-dim">
              Number sirf trial line ke liye — koi marketing message nahi. Trial ke baad line khud band ho jati hai, charge nahi lagta.
            </p>
          </div>

          <a href={waLink('Assalam o Alaikum, mujhe Mizanora IPTV ka free trial chahiye.')} target="_blank" rel="noreferrer" className="btn-ghost w-full">
            <MessageCircle size={16} /> WhatsApp par bhi bhejein
          </a>

          <p className="text-center text-xs text-faint">
            Trial ke baad <Link href="/iptv#plans" className="font-semibold text-gold underline underline-offset-4">plans</Link> se apni line le lein.
          </p>
        </div>
      </div>
    </>
  );
}
