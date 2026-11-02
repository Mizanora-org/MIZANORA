import Link from 'next/link';
import { Tv, Play, SearchX } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import { getTvConfig } from '@/lib/liveTvServer';
import { channelSlugs } from '@/lib/liveTv';

export const revalidate = 600;

export const metadata = pageMeta({
  title: 'IPTV channel list — news, sports, Islamic and entertainment',
  description:
    'The complete Mizanora IPTV channel list: Pakistani news, sports, Islamic, entertainment, movies, kids and international channels, with a 7-day EPG guide on every line.',
  path: '/iptv/channels',
});

export default async function IptvChannelsPage() {
  let channels = [];
  try { const cfg = await getTvConfig(); channels = (cfg?.channels || []).filter((c) => !c.off); } catch { /* no config */ }
  const slugs = channelSlugs(channels);

  const grouped = channels.reduce((map, c, i) => {
    const g = c.group || 'Other';
    (map[g] = map[g] || []).push({ ...c, slug: slugs[i] });
    return map;
  }, {});
  const groups = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/channels', 'Channels']])]} />
      <PageHead
        title="Channel list"
        intro={channels.length
          ? `${channels.length} channels — ${groups.length} groups. Har line par 7-din EPG guide aur favourites.`
          : 'Channels admin panel se add hote hain. Neeche list khali hai matlab abhi TV config set nahi hua.'}
        crumbs={[['/', 'Home'], ['/iptv', 'IPTV'], [null, 'Channels']]}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {channels.length ? (
          <div className="space-y-8">
            <nav aria-label="Groups" className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <a key={g} href={`#g-${encodeURIComponent(g)}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-dim hover:border-gold hover:text-gold">
                  {g} <span className="text-faint">({grouped[g].length})</span>
                </a>
              ))}
            </nav>

            {groups.map((g) => (
              <section key={g} id={`g-${encodeURIComponent(g)}`} className="scroll-mt-24">
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
                  <Tv size={16} className="text-gold" /> {g}
                  <span className="text-xs font-semibold text-faint">{grouped[g].length} channels</span>
                </h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {grouped[g].map((c) => (
                    <li key={c.slug}>
                      <Link href={`/live/${c.slug}`} className="group flex items-center gap-2 rounded-xl border border-line bg-surface p-2 transition hover:border-gold">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-[10px] font-black text-gold">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-xs">{c.name}</b>
                          <span className="text-[10px] text-faint">{c.group || 'Live'}</span>
                        </span>
                        <Play size={12} className="shrink-0 text-faint group-hover:text-gold" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="text-xs text-faint">
              Ye list free Live TV aur IPTV dono ke liye hai. Kuch channels premium plans mein hain — woh line ke saath unlock hote hain.
              {' '}<Link href="/iptv#plans" className="font-semibold text-gold underline underline-offset-4">Plans dekhein</Link>.
            </p>
          </div>
        ) : (
          <div className="card grid place-items-center py-14 text-center">
            <SearchX size={26} className="text-faint" />
            <h2 className="mt-2 font-display font-bold">Channel list abhi khali hai</h2>
            <p className="mt-1 max-w-md text-sm text-dim">
              Admin &gt; Live TV se M3U import karein ya channels add karein — wohi list yahan aur IPTV lines par chali jayegi.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/live" className="btn-gold">Live TV</Link>
              <Link href="/iptv" className="btn-ghost">IPTV plans</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
