import Link from 'next/link';
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import { FOUNDER } from '@/lib/team';
import FounderPhoto from '@/components/FounderPhoto';

export const revalidate = 86400;
export const metadata = pageMeta({
  title: 'Muaaz Iqbal: developer and founder of Mizanora (Kasur, Pakistan)',
  description: 'Muaaz Iqbal from Kasur, Punjab, Pakistan: AI-native full-stack developer, founder of Mizanora online marketplace and the HijriAnchor calendar app. His projects, skills, links and story.',
  path: '/muaaz-iqbal',
});

const PROJECTS = [
  ['Mizanora', 'https://mizanora.vercel.app', 'An online marketplace for Pakistan ("Shop Smart. Shop Halal"): a catalogue of thousands of products, cash on delivery, WhatsApp ordering, deals, an Urdu voice assistant, worker programme and daily Islamic feed.'],
  ['HijriAnchor', 'https://mizanoraapp.com', 'A privacy-first, ad-free dual calendar and life planner app (Umm al-Qura Hijri with Gregorian), working offline, for Android and iOS.'],
  ['Muslim Islam Organization', 'https://muslimislam.vercel.app', 'An Islamic community portal with a project hub, a shared chat and device and network tools.'],
  ['Ramadan tools', null, 'Pakistani Ramadan web tools: Sehr and Iftar countdowns by location, daily duas and easy sharing.'],
  ['Study notes', null, 'Intermediate (11th class) notes and study material for students in Kasur.'],
];
const SKILLS = [
  ['Web engineering', 'Next.js, React, Tailwind CSS, JavaScript / TypeScript, Vercel, Firebase, catalogue scrapers and importers.'],
  ['Mobile apps', 'Publishing for Android (Google Play) and iOS (App Store).'],
  ['AI orchestration', 'Building with Claude, Gemini, Qwen and ChatGPT together: logic and code, data cleaning, batch work, copywriting and strategy.'],
  ['Design and media', 'Graphic design, branding, video editing, UI and UX wireframes.'],
  ['Crafts and care', 'Embroidery and tailoring, first-aid and wound dressing, poetry (shayari) and reading.'],
];
const FAQ = [
  ['Who is Muaaz Iqbal?', 'Muaaz Iqbal is a developer and entrepreneur from Kasur, Punjab, Pakistan. He is the founder of Mizanora, an online marketplace for Pakistan, and the maker of the HijriAnchor calendar app.'],
  ['What is Mizanora?', 'Mizanora is a Pakistani online store at mizanora.vercel.app with cash on delivery, WhatsApp ordering, deals, an Urdu AI assistant and an Islamic feed. Its motto is "Shop Smart. Shop Halal".'],
  ['What is HijriAnchor?', 'HijriAnchor is a privacy-first, ad-free, offline dual-calendar app that combines the Umm al-Qura Hijri calendar with the Gregorian calendar, for Android and iOS.'],
  ['Where can I follow Muaaz Iqbal?', 'On YouTube (@MuaazIqbalofficial), X (@MizanoraApps) and Instagram (@mizanora and @mezanora.market).'],
];

export default function MuaazPage() {
  const crumbs = [['/', 'Home'], ['/muaaz-iqbal', 'Muaaz Iqbal']];
  const profile = {
    '@context': 'https://schema.org', '@type': 'ProfilePage', url: absUrl('/muaaz-iqbal'), name: 'Muaaz Iqbal',
    mainEntity: {
      '@type': 'Person', '@id': absUrl('/muaaz-iqbal#person'), name: 'Muaaz Iqbal', alternateName: ['Muaaz Iqbal Kasur', 'Muaaz Iqbal Mizanora'],
      jobTitle: 'Founder and full-stack developer', url: absUrl('/muaaz-iqbal'), image: FOUNDER.photos[0],
      address: { '@type': 'PostalAddress', addressLocality: 'Kasur', addressRegion: 'Punjab', addressCountry: 'PK' },
      worksFor: { '@id': absUrl('/#org') },
      sameAs: ['https://www.youtube.com/@MuaazIqbalofficial', 'https://x.com/MizanoraApps', 'https://www.instagram.com/mizanora', 'https://www.instagram.com/mezanora.market'],
      knowsAbout: ['Next.js', 'React', 'Artificial intelligence', 'E-commerce', 'Islamic calendar apps'],
      owns: PROJECTS.filter((p) => p[1]).map(([name, url]) => ({ '@type': 'WebSite', name, url })),
    },
  };
  return (
    <>
      <PageHead title="Muaaz Iqbal" intro="Developer and founder of Mizanora, from Kasur, Punjab, Pakistan." crumbs={[['/', 'Home'], [null, 'Muaaz Iqbal']]} />
      <article className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-5 rounded-3xl border border-line bg-surface p-5">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl"><FounderPhoto photos={FOUNDER.photos} name="Muaaz Iqbal" initials="MI" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold">Muaaz Iqbal</h2>
            <p className="text-dim">AI-native full-stack developer, indie founder and builder · Kasur, Punjab, Pakistan</p>
            <p className="mt-2 flex flex-wrap gap-2 text-sm font-bold">
              <a className="rounded-full bg-gold/10 px-3 py-1 text-gold" href="https://www.youtube.com/@MuaazIqbalofficial" target="_blank" rel="noopener noreferrer me">YouTube</a>
              <a className="rounded-full bg-gold/10 px-3 py-1 text-gold" href="https://x.com/MizanoraApps" target="_blank" rel="noopener noreferrer me">X @MizanoraApps</a>
              <a className="rounded-full bg-gold/10 px-3 py-1 text-gold" href="https://www.instagram.com/mizanora" target="_blank" rel="noopener noreferrer me">Instagram @mizanora</a>
            </p>
          </div>
        </div>

        <section className="prose-mz mt-8" aria-labelledby="about">
          <h2 id="about">About Muaaz Iqbal</h2>
          <p><strong>Muaaz Iqbal</strong> is an independent software developer and digital entrepreneur from Kasur, Punjab, Pakistan. He designs, builds and ships complete products on his own: web platforms, a high-volume online store and a calendar app for phones. His way of working joins modern AI tools with honest business, privacy-first design and the idea behind the name Mizanora: <em>mizan</em>, balance and fair dealing.</p>
          <p>He is the founder of <Link href="/">Mizanora</Link>, an online market for Pakistan with cash on delivery, and of <strong>HijriAnchor</strong>, an offline, ad-free dual calendar. More about the people behind the shop is on the <Link href="/team">team page</Link>, and his story is told in <Link href="/blog/who-is-muaaz-iqbal-founder-of-mizanora">this article</Link>.</p>
        </section>

        <section className="mt-8" aria-labelledby="projects">
          <h2 id="projects" className="section-title mb-3">Projects</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PROJECTS.map(([name, url, text]) => (
              <li key={name} className="rounded-2xl border border-line bg-surface p-4">
                <h3 className="font-display text-lg font-bold">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{name}</a> : name}</h3>
                <p className="mt-1 text-sm text-dim">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="skills">
          <h2 id="skills" className="section-title mb-3">Skills</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {SKILLS.map(([k, v]) => <div key={k} className="rounded-2xl bg-raised p-4"><dt className="font-bold">{k}</dt><dd className="mt-1 text-sm text-dim">{v}</dd></div>)}
          </dl>
        </section>

        <section className="mt-8" aria-labelledby="faq">
          <h2 id="faq" className="section-title mb-3">Questions</h2>
          <div className="space-y-3">{FAQ.map(([q, a]) => <details key={q} className="rounded-2xl border border-line bg-surface p-4"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-2 text-sm text-dim">{a}</p></details>)}</div>
        </section>

        <p className="mt-8 text-sm text-dim">Contact for orders and support: WhatsApp {FOUNDER.phone}. Related reading: <Link className="text-gold underline" href="/blog/muaaz-iqbal-kasur-developer-ai-researcher-marketer">Muaaz Iqbal, Kasur developer</Link>, <Link className="text-gold underline" href="/blog/muaaz-iqbal-story-how-mizanora-was-built">how Mizanora was built</Link>.</p>
      </article>
      <JsonLd data={[breadcrumbJsonLd(crumbs), profile, faqJsonLd(FAQ)]} />
    </>
  );
}
