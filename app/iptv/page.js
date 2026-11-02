import Link from 'next/link';
import { Tv, CalendarClock, Zap, ShieldCheck, MonitorSmartphone, Wallet, ArrowRight, CheckCircle2, Play, Users } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import IptvPlans from '@/components/IptvPlans';
import IptvResellerCalc from '@/components/IptvResellerCalc';
import { getTvConfig } from '@/lib/liveTvServer';
import { IPTV, FEATURES, HOW, FAQ, PLANS, pkr } from '@/lib/iptv';

export const revalidate = 600;

export const metadata = pageMeta({
  title: 'Mizanora IPTV: Live TV, Movies & Series on Xtream, Stalker/MAC and M3U',
  description:
    'Mizanora IPTV — live channels, movies and series on your TV, phone or MAG box. Xtream Codes, Stalker/MAC and M3U support, full 7-day EPG, 24-hour free trial, Rs 50 connection fee and Rs 200 per month. Cash-friendly payment on JazzCash, Easypaisa and bank.',
  path: '/iptv',
  keywords: undefined,
});

const ICONS = { Tv, CalendarClock, Zap, ShieldCheck, MonitorSmartphone, Wallet };

export default async function IptvPage() {
  let channels = [];
  try { const cfg = await getTvConfig(); channels = (cfg?.channels || []).filter((c) => !c.off); } catch { /* no TV config */ }
  const groups = [...new Set(channels.map((c) => c.group).filter(Boolean))].slice(0, 8);

  const ld = [
    breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV']]),
    faqJsonLd(FAQ),
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Mizanora IPTV subscription',
      description: 'Live TV, movies and series on Xtream Codes, Stalker/MAC and M3U. 24-hour trial, Rs 200 per month.',
      brand: { '@type': 'Brand', name: 'Mizanora' },
      url: absUrl('/iptv'),
      offers: PLANS.filter((p) => !p.trial).map((p) => ({
        '@type': 'Offer',
        name: `${p.name} — 1 month`,
        price: p.priced[1],
        priceCurrency: 'PKR',
        availability: 'https://schema.org/InStock',
        url: absUrl('/iptv#plans'),
      })),
    },
  ];

  return (
    <>
      <JsonLd data={ld} />
      <PageHead
        title="Mizanora IPTV"
        intro="Live TV, movies aur series — Xtream Codes, Stalker/MAC ya M3U se, kisi bhi device par. Rs 50 connection fee (pehla month shamil), uske baad Rs 200 mahina."
        crumbs={[['/', 'Home'], [null, 'IPTV']]}
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8">
        {/* hero */}
        <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-7">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-gold/5 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                {['Xtream Codes', 'Stalker / MAC', 'M3U + XMLTV', '7-day EPG'].map((t) => (
                  <span key={t} className="rounded-full border border-line bg-raised px-3 py-1 text-[11px] font-bold text-dim">{t}</span>
                ))}
              </div>
              <h2 className="mt-4 font-display text-3xl font-black leading-tight sm:text-4xl">
                Cable ki tarah, magar <span className="text-gold">aap ke control</span> mein.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-dim sm:text-base">
                Aik line, har device par. Ghar ke TV par TiviMate, bachon ke phone par Smarters, aur baap ke MAG box par —
                wohi channels, wohi guide. Koi dish nahi, koi cable nahi.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/iptv/start" className="btn-gold">Free key — Google se foran <ArrowRight size={16} /></Link>
                <Link href="/iptv/trial" className="btn-ghost">Trial form</Link>
                <Link href="/iptv/player" className="btn-ghost"><Play size={15} /> Browser player</Link>
                <Link href="#plans" className="btn-ghost">Plans dekhein</Link>
                <Link href="/live" className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-semibold text-gold hover:underline">
                  <Play size={14} /> Free live TV pehle dekhein
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                [channels.length ? `${channels.length}+` : '800+', 'Live channels'],
                ['3', 'Devices (top plan)'],
                ['~1s', 'Channel switch'],
                ['24h', 'Free trial'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-line bg-raised p-3 text-center">
                  <p className="font-display text-2xl font-black text-gold">{v}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
              <div className="col-span-2 rounded-2xl border border-gold/30 bg-gold/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-gold"><Users size={12} /> Reseller banein</p>
                <p className="mt-0.5 text-[11px] text-dim">
                  Har client se Rs 30 (connection) + Rs {IPTV.resellerMargin} har mahine. Clients unlimited.
                </p>
                <Link href="/iptv/reseller" className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-gold underline underline-offset-4">
                  Poora hisaab dekhein <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* v46: poora IPTV system — har page aik jagah se */}
        <section className="rounded-2xl border border-line bg-surface p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-faint">Poora system</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['/iptv/channels', 'Live channels', 'groups + logos'],
              ['/iptv/guide', 'TV guide', 'now / next + 7d'],
              ['/iptv/movies', 'Movies', 'posters + IMDb'],
              ['/iptv/series', 'Series', 'seasons + episodes'],
              ['/iptv/player', 'Browser player', 'no install'],
              ['/iptv/apps', 'Apps & setup', 'TiviMate, MAG, VLC'],
              ['/iptv/recharge', 'Recharge', 'JazzCash + unlock'],
              ['/iptv/status', 'Status', 'live counts'],
              ['/iptv/trial', 'Free trial', '24 hours'],
              ['/iptv/reseller', 'Reseller', 'credit + margin'],
              ['/iptv/start', 'Free key', 'Google sign-in'],
              ['/live', 'Free live TV', 'alag feature'],
            ].map(([href, label, note]) => (
              <Link key={href} href={href} className="rounded-xl border border-line bg-raised px-2.5 py-2 transition hover:border-gold/40">
                <p className="text-[11px] font-bold text-cream">{label}</p>
                <p className="text-[10px] text-faint">{note}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* plans */}
        <section id="plans" className="scroll-mt-24">
          <IptvPlans />
        </section>

        {/* features */}
        <section id="features" className="scroll-mt-24">
          <h2 className="section-title mb-1">Kya milta hai</h2>
          <p className="mb-5 text-sm text-dim">Channels, guide aur support — sab aik jagah.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([icon, title, text]) => {
              const Icon = ICONS[icon] || Tv;
              return (
                <div key={title} className="card">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/10 text-gold"><Icon size={19} /></span>
                  <h3 className="mt-2 font-display text-base font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-dim">{text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* how */}
        <section id="how" className="scroll-mt-24">
          <h2 className="section-title mb-1">Kaise shuru karein</h2>
          <p className="mb-5 text-sm text-dim">Chaar step — zyada tar log 10 minute mein dekh rahe hote hain.</p>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map(([t, d], i) => (
              <li key={t} className="card">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gold text-sm font-black text-white">{i + 1}</span>
                <b className="mt-2 block font-display">{t}</b>
                <span className="text-sm text-dim">{d}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* channels + groups */}
        <section id="channels" className="scroll-mt-24">
          <div className="card flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-extrabold">Channels</h2>
              <p className="mt-1 text-sm text-dim">
                {channels.length ? `${channels.length} channels live right now` : 'Channels admin panel se add hote hain'}
                {groups.length ? ` — ${groups.join(' · ')}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  ['News', 'ARY, Geo, Hum, Samaa, Dunya'],
                  ['Sports', 'PTV Sports, Ten Sports, Star Sports'],
                  ['Islamic', 'Makkah, Madinah, Madani, Paigham'],
                  ['Entertainment', 'HUM, ARY Digital, Green, A-Plus'],
                ].map(([g, ex]) => (
                  <span key={g} className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px]">
                    <b className="text-cream">{g}</b> <span className="text-faint">{ex}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/iptv/channels" className="btn-gold">Poori list <ArrowRight size={15} /></Link>
              <Link href="/live" className="btn-ghost">Abhi dekhein</Link>
            </div>
          </div>
        </section>

        {/* reseller */}
        <section id="reseller" className="scroll-mt-24">
          <div className="mb-4">
            <h2 className="section-title">Reseller program</h2>
            <p className="mt-1 text-sm text-dim">
              Rs {IPTV.fee.total} connection fee se Rs {IPTV.fee.reseller} aap ka, aur har mahine Rs {IPTV.resellerMargin} per line.
              Clients unlimited — jitne banayein.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
            <IptvResellerCalc />
            <div className="card">
              <h3 className="font-display text-base font-bold">Kaam kaise karta hai</h3>
              <ul className="mt-2 space-y-2 text-sm text-dim">
                {[
                  `Client Rs ${pkr(IPTV.cap)} deta hai — Rs ${pkr(IPTV.wholesale)} Mizanora ko, Rs ${pkr(IPTV.resellerMargin)} aap ka.`,
                  `Nayi line par client Rs ${pkr(IPTV.fee.total)} deta hai — Rs ${pkr(IPTV.fee.reseller)} aap ka, Rs ${pkr(IPTV.fee.admin)} Mizanora ka.`,
                  `Wasooli ${IPTV.cycle.from}–${IPTV.cycle.to} tareekh: aap Mizanora ko JazzCash par pay karte hain.`,
                  'Aap apna payment number aur price (cap ke andar) panel se set karte hain.',
                ].map((t) => (
                  <li key={t} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold" />{t}</li>
                ))}
              </ul>
              <Link href="/iptv/reseller" className="btn-gold mt-4">Reseller details</Link>
            </div>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="scroll-mt-24">
          <h2 className="section-title mb-4">Aam sawal</h2>
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card group">
                <summary className="cursor-pointer list-none font-display font-bold marker:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {q}
                    <span className="mt-0.5 text-gold transition group-open:rotate-45" aria-hidden>+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-dim">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* links */}
        <section className="card">
          <h2 className="font-display text-base font-bold">Aage parhein</h2>
          <div className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            {[
              ['/blog/mizanora-iptv-guide-roman-urdu', 'Mizanora IPTV: poora guide (Roman Urdu)'],
              ['/blog/iptv-xtream-codes-setup-tivimate-smarters', 'Xtream Codes setup: TiviMate aur Smarters'],
              ['/blog/stalker-portal-mac-setup-mag-box', 'Stalker portal / MAC setup: MAG box'],
              ['/blog/iptv-reseller-pakistan-guide', 'Pakistan mein IPTV reseller business'],
              ['/blog/iptv-browser-player-guide', 'Browser player: bina app install ke IPTV'],
              ['/blog/iptv-epg-xmltv-guide-pakistan', 'EPG / XMLTV: guide khaali kyun aati hai'],
              ['/blog/iptv-movies-series-library-guide', 'Movies aur series library ka guide'],
              ['/blog/iptv-7-din-catchup-timeshift', '7-din catch-up (timeshift) ka tareeqa'],
              ['/blog/iptv-ads-vs-ad-free', 'Ads vs ad-free: sasta plan ya premium'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="font-semibold text-gold underline underline-offset-4">{label}</Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
