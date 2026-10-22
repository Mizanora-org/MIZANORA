import { SITE } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import { SOCIAL_ICONS } from '@/components/Icons';

export const metadata = pageMeta({
  title: 'Official Mizanora Accounts',
  description: 'All official Mizanora links in one place: WhatsApp support, Instagram, Facebook, TikTok and YouTube.',
  path: '/connect',
});

export default function Connect() {
  return (
    <>
      <PageHead title="Official Mizanora accounts" intro="If a link is not listed here, it is not ours." crumbs={[['/', 'Home'], [null, 'Connect']]} />
      <div className="mx-auto grid max-w-4xl gap-3 px-4 py-8 sm:grid-cols-2">
        {SITE.social.filter((s) => s.url).map((s) => {
          const Icon = SOCIAL_ICONS[s.id];
          return (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-gold">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-raised text-gold"><Icon /></span>
              <span><b className="block">{s.label}</b><span className="text-sm text-dim">{s.note}</span></span>
            </a>
          );
        })}
      </div>
    </>
  );
}
