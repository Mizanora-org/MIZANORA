import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import { ISLAMIC_ITEMS, KIND_COLOR, KIND_LABEL } from '@/lib/islamic';
import { REMINDERS } from '@/lib/reminders';
import { getFeedPosts } from '@/lib/feedPosts';

export const revalidate = 3600;
export const metadata = pageMeta({ title: 'Islamic reminders: ayat, hadees and duas', description: 'A collection of short ayat of the Quran, ahadees, duas and aqwal with Urdu meaning and exact references, from the Mizanora Islami Feed.', path: '/islamic' });

export default async function IslamicPage() {
  const extra = await getFeedPosts();
  const seen = new Set();
  const all = [...extra, ...ISLAMIC_ITEMS, ...REMINDERS.map((r, i) => ({ id: `r${i}`, kind: 'ayat', ar: r.ar, ur: r.ur, ref: r.ref }))].filter((x) => { const k = x.ar || x.ur; if (seen.has(k)) return false; seen.add(k); return true; });
  return (
    <>
      <PageHead title="Islamic reminders" intro="Ayat, ahadees, duas and aqwal, each with its reference." crumbs={[['/', 'Home'], [null, 'Islamic reminders']]} />
      <div className="mx-auto max-w-4xl px-3 py-8 sm:px-4">
        <p className="mb-5 rounded-2xl bg-raised p-3 text-sm text-dim">Every text has its reference. For questions of fiqh, please ask a qualified scholar. Read also <Link href="/blog/halal-business-and-honest-trade-in-islam-for-online-shops" className="font-semibold text-gold underline underline-offset-4">honest trade in Islam</Link>.</p>
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gradient-to-r from-[#06402B] to-[#0B6B45] p-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2C766]">Mizanora Live Channel</p>
            <p className="mt-1 text-lg font-extrabold">Quran ki live tilawat, ahadees aur ads — 24/7 channel</p>
            <p className="mt-1 text-sm text-white/85">Channel ki screen par Mizanora logo, LIVE badge aur Pakistan ka chalta hua waqt. Live m3u8 stream bhi available hai.</p>
          </div>
          <Link href="/live-channel" className="rounded-full bg-[#F2C766] px-5 py-2.5 text-sm font-extrabold text-[#1d1600]">Channel dekhein →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {all.map((x) => (
            <article key={x.id} className="rounded-2xl border border-line bg-white p-4">
              <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold text-white ${KIND_COLOR[x.kind] || 'bg-emerald-600'}`}>{KIND_LABEL[x.kind] || 'Yaad-dehani'}</span>
              {x.ar && <p lang="ar" dir="rtl" className="font-arabic text-2xl leading-[2.1] text-cream">{x.ar}</p>}
              <p className="mt-2 text-sm text-dim">{x.ur}</p>
              <p className="mt-2 text-xs font-semibold text-faint">{x.ref}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
