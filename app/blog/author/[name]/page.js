import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CalendarDays, Clock, Github, Linkedin, PenLine, Youtube } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import FounderPhoto from '@/components/FounderPhoto';
import { authorSlug, postsByAuthor, CATEGORY_LABELS } from '@/lib/blog';
import { FOUNDER_LINKS } from '@/lib/team';
import { founderAvatarPhotos } from '@/lib/founderPhotos';

// Mizanora v56 — /blog/author/muaaz-iqbal
//
// A real author hub: every guide written by one person, in one place, with the Person schema that
// Google uses for the "written by" line. Before this, 150+ posts carried `author: Muaaz Iqbal` in the
// front matter and nothing linked that name to anything.
export const revalidate = 3600;

const NAME = 'Muaaz Iqbal';

export async function generateMetadata({ params }) {
  const { name } = await params;
  const posts = postsByAuthor(name);
  if (!posts.length) return { robots: { index: false, follow: true } };
  return pageMeta({
    title: `${NAME} — writer & founder of Mizanora (all articles)`,
    description: `Every guide written by ${NAME}, the developer from Kasur who built Mizanora: online shopping, movies and IMDb, the Songs player, Quran tools, SEO and how the store is engineered. ${posts.length} articles.`,
    path: `/blog/author/${authorSlug(name)}`,
  });
}

export default async function AuthorPage({ params }) {
  const { name } = await params;
  const posts = postsByAuthor(name);
  if (!posts.length) notFound();

  const byCat = new Map();
  for (const p of posts) byCat.set(p.category, (byCat.get(p.category) || 0) + 1);
  const latest = posts.slice(0, 12);

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: NAME,
            url: absUrl('/blog/author/muaaz-iqbal'),
            jobTitle: 'Full-stack developer and founder of Mizanora',
            homeLocation: { '@type': 'Place', name: 'Kasur, Punjab, Pakistan' },
            sameAs: FOUNDER_LINKS.map(([, href]) => href).filter((h) => /github|linkedin|youtube|x\.com|instagram/.test(h)),
          },
          breadcrumbJsonLd([['/', 'Home'], ['/blog', 'Blog'], [`/blog/author/${authorSlug(name)}`, NAME]]),
        ]}
      />

      <PageHead
        title={`${NAME} — likhne wala aur Mizanora ka baanī`}
        intro={`Yahan un tamam guides ki fehrist hai jo ${NAME} ne likhin — shopping, movies, songs, Quran tools aur website engineering.`}
        crumbs={[['/', 'Home'], ['/blog', 'Blog'], [null, NAME]]}
      />

      <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-4">
        <section className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <FounderPhoto name={NAME} initials="MI" photos={founderAvatarPhotos()} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold text-cream">{NAME}</h2>
            <p className="mt-1 text-sm leading-7 text-dim">
              Kasur, Punjab (Pakistan) se full-stack developer aur Mizanora ka founder. Next.js, Firebase aur AI
              orchestration ke saath Pakistani shoppers, students aur chhote karobar ke liye cheezein banata hai —
              Mizanora store, HijriAnchor calendar app, Asaan Lang (Urdu programming language) aur BarakatWave TV.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <Link href="/muaaz-iqbal" className="rounded-full bg-gold/10 px-3 py-1.5 text-gold hover:bg-gold/20">Poora profile</Link>
              <a href={FOUNDER_LINKS.find(([k]) => k === 'GitHub')[1]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold"><Github size={12} /> GitHub</a>
              <a href={FOUNDER_LINKS.find(([k]) => k === 'LinkedIn')[1]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold"><Linkedin size={12} /> LinkedIn</a>
              <a href={FOUNDER_LINKS.find(([k]) => k === 'YouTube')[1]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold"><Youtube size={12} /> YouTube</a>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center sm:grid-cols-1">
            <div className="rounded-2xl bg-raised px-4 py-2">
              <p className="font-display text-xl font-extrabold text-cream">{posts.length}</p>
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-faint">Articles</p>
            </div>
            <div className="rounded-2xl bg-raised px-4 py-2">
              <p className="font-display text-xl font-extrabold text-cream">{byCat.size}</p>
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-faint">Categories</p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="section-title">Latest guides</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
                  <span className="mz-tag w-fit">{CATEGORY_LABELS[p.category] || p.category}</span>
                  <h3 className="mt-2 line-clamp-2 font-display text-base font-extrabold text-cream group-hover:text-gold">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-6 text-dim">{p.description}</p>
                  <span className="mt-auto flex items-center gap-3 pt-3 text-[0.65rem] font-bold text-faint">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {p.date}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {p.mins} min</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {posts.length > latest.length && (
            <p className="mt-4 text-sm text-dim">
              {posts.length - latest.length} aur guides — <Link href="/blog" className="font-bold text-gold hover:underline">poore blog</Link> par.
            </p>
          )}
        </section>

        <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-raised p-5">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-cream"><PenLine size={15} className="text-gold" /> Kisi topic par guide chahiye?</p>
          <Link href="/contact" className="inline-flex items-center gap-1 rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-white">Suggest a topic <ArrowRight size={14} /></Link>
        </section>
      </div>
    </>
  );
}
