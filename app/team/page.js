import Link from 'next/link';
import { ArrowRight, BadgePercent, Code2, Heart, MapPin, MessageCircle, Megaphone, Package, ShieldCheck, Sparkles, Star, Users } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd, orgJsonLd } from '@/lib/seo';
import { absUrl, SITE } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import Reveal from '@/components/Reveal';
import { CREDIT, FOUNDER, TEAM, initialsOf } from '@/lib/team';
import { founderAvatarPhotos, founderHeroPhoto } from '@/lib/founderPhotos';
import FounderPhoto from '@/components/FounderPhoto';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { getGitHub } from '@/lib/githubLive';
import GitHubLive from '@/components/GitHubLive';
import { effectiveTier } from '@/lib/workers';

export const revalidate = 300;

const ICONS = { MessageCircle, Package, Megaphone, ShieldCheck, Code2, Heart };

export const metadata = pageMeta({
  title: 'Mizanora Team: Founder, Developers and Workers (Public Profiles)',
  description: 'Meet the Mizanora team - founded and built by Muaaz Iqbal (developer). See our support, dispatch and catalogue teams and the public profiles of our verified workers.',
  path: '/team',
});

// Public profiles are OPT-IN: a worker only appears here after they turn it on in their dashboard.
// Nothing private (CNIC, phone, address, payout account) is ever read or shown.
async function publicWorkers() {
  try {
    if (!adminReady()) return [];
    const snap = await adminDb().collection('workers').where('publicProfile.on', '==', true).limit(48).get();
    return snap.docs.map((d) => {
      const w = d.data() || {};
      const pp = w.publicProfile || {};
      const t = effectiveTier(w);
      return {
        uid: d.id,
        name: String(pp.name || w.name || 'Mizanora worker').slice(0, 60),
        city: String(pp.city || w.city || '').slice(0, 40),
        bio: String(pp.bio || '').slice(0, 180),
        photo: String(pp.photo || '').slice(0, 500),
        tier: t.name,
        rate: t.rate,
        delivered: Number((w.stats || {}).delivered) || 0,
      };
    }).filter((w) => w.name);
  } catch { return []; }
}

export default async function TeamPage() {
  const [workers, gh] = await Promise.all([publicWorkers(), getGitHub().catch(() => null)]);
  const founder = {
    '@type': 'Person',
    name: FOUNDER.name,
    jobTitle: FOUNDER.role,
    image: absUrl(founderHeroPhoto(FOUNDER.photos[0])),
    telephone: `+${FOUNDER.whatsapp}`,
    description: FOUNDER.bio,
    knowsAbout: ['web development', 'artificial intelligence', 'digital marketing', 'e-commerce'],
    alumniOf: { '@type': 'EducationalOrganization', name: 'Islamia Graduate College' },
    worksFor: { '@id': absUrl('/#org') },
    address: { '@type': 'PostalAddress', addressLocality: 'Kasur', addressRegion: 'Punjab', addressCountry: 'PK' },
  };

  return (
    <>
      <PageHead title="The Mizanora team" intro="A Pakistani shop built by a small, real team - from the founder who writes the code to the workers who share our products." crumbs={[['/', 'Home'], [null, 'Team']]} />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-8">
        {/* FOUNDER */}
        <Reveal>
          <section aria-labelledby="founder" className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0B6B45] via-[#0E8556] to-[#073D28] text-white shadow-xl">
            <div className="relative p-6 sm:p-9">
              <span className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-saffron/25 blur-2xl" aria-hidden="true" />
              <span className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <FounderPhoto photos={founderAvatarPhotos(FOUNDER.photos)} initials={initialsOf(FOUNDER.name)} name={FOUNDER.name} />
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider"><Sparkles size={13} /> {FOUNDER.role}</p>
                  <h1 id="founder" className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{FOUNDER.name}</h1>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85"><MapPin size={14} /> {FOUNDER.city}</p>
                  <p className="mt-3 max-w-2xl text-white/90">{FOUNDER.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FOUNDER.tags.map((t) => <span key={t} className="rounded-full bg-saffron px-3 py-1 text-xs font-extrabold text-[#2B1B00]">{t}</span>)}
                  </div>
                  <p className="mt-3"><a href={`https://wa.me/${FOUNDER.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#073D28]"><MessageCircle size={16} /> WhatsApp {FOUNDER.phone}</a></p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {FOUNDER.built.map((b) => (
                      <span key={b} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">{b}</span>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/contact" className="btn-gold !py-2.5">Contact the founder</Link>
                    <Link href="/workers" className="btn-ghost !border-white/40 !py-2.5 !text-white">Earn with us <ArrowRight size={15} /></Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* TEAM */}
        {/* GITHUB, LIVE (v33): the founder's real open-source work, straight from GitHub */}
        {gh && gh.profile && (
          <Reveal>
            <GitHubLive data={gh} limit={4} compact title="Founder on GitHub, live" intro="Har commit yahin dikhta hai: repositories, stars aur languages seedha GitHub se." />
          </Reveal>
        )}

        <Reveal>
          <section aria-labelledby="team" className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <h2 id="team" className="section-title">Who does what</h2>
              <span className="text-sm text-dim">From developers to packing</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM.map((t) => {
                const Icon = ICONS[t.icon] || Users;
                return (
                  <div key={t.name} className="card flex gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold"><Icon size={20} /></span>
                    <div className="min-w-0">
                      <p className="font-bold">{t.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{t.role}</p>
                      <p className="mt-1 text-sm text-dim">{t.line}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>

        {/* WORKERS WITH PUBLIC PROFILES */}
        <Reveal>
          <section aria-labelledby="workers" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="workers" className="section-title">Our workers and partners</h2>
                <p className="mt-1 max-w-2xl text-sm text-dim">Verified workers who share Mizanora products for commission. Every profile below is <b>opt-in</b>: a worker appears here only if they switched it on in their dashboard. We never show CNIC, phone or address.</p>
              </div>
              <Link href="/worker" className="btn-ghost !py-2.5">Worker dashboard <ArrowRight size={15} /></Link>
            </div>

            {workers.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {workers.map((w) => (
                  <article key={w.uid} className="card flex gap-3 !p-4">
                    {w.photo
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={w.photo} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                      : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold/10 font-display text-lg font-extrabold text-gold">{initialsOf(w.name)}</span>}
                    <div className="min-w-0">
                      <p className="truncate font-bold">{w.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-dim">
                        {w.city && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {w.city}</span>}
                        <span className="inline-flex items-center gap-1 font-semibold text-gold"><Star size={12} /> {w.tier} · {w.rate}%</span>
                      </p>
                      {w.delivered > 0 && <p className="mt-0.5 text-xs text-faint">{w.delivered} order(s) delivered</p>}
                      {w.bio && <p className="mt-1.5 line-clamp-3 text-sm text-dim">{w.bio}</p>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-dim">
                  <b className="text-cream">No worker has made their profile public yet.</b> Are you a Mizanora worker? Open your dashboard and switch on
                  <b> “Show me on the team page”</b> - your name, city and a line about yourself will appear here (never your CNIC or phone).
                </p>
                <Link href="/worker" className="btn-gold shrink-0 !py-2.5">Open my dashboard</Link>
              </div>
            )}
          </section>
        </Reveal>

        {/* EARN WITH US */}
        <Reveal>
          <section aria-labelledby="earn" className="grid gap-3 sm:grid-cols-3">
            <div className="card sm:col-span-3 !p-6">
              <h2 id="earn" className="section-title">Earn with us</h2>
              <p className="mt-1 text-sm text-dim">Mizanora is not only customers and staff - hundreds of Pakistanis earn with it in their own time. Join free and start from 10%, rising to 50% as your delivered orders grow.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/worker" className="btn-gold"><BadgePercent size={17} /> Join as a worker</Link>
                <Link href="/workers" className="btn-ghost">How the programme works</Link>
                <Link href="/contact" className="btn-ghost"><MessageCircle size={16} /> Ask a question</Link>
              </div>
            </div>
          </section>
        </Reveal>

        <p className="text-sm text-faint">{CREDIT} · {SITE.name} - {SITE.city}. This page is updated whenever the team changes.</p>
      </div>

      <JsonLd data={[breadcrumbJsonLd([['/', 'Home'], ['/team', 'Team']]), { ...orgJsonLd(), founder, employee: TEAM.map((t) => ({ '@type': 'OrganizationRole', roleName: t.role })) }]} />
    </>
  );
}
