import Link from 'next/link';
import { ArrowRight, CheckCircle2, MonitorSmartphone, Smartphone, Tv } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';

export const revalidate = 3600;

export const metadata = pageMeta({
  title: 'IPTV apps aur device setup — TiviMate, Smarters, VLC, MAG (Mizanora)',
  description:
    'Mizanora IPTV kaun se apps par chalta hai: TiviMate, IPTV Smarters, XCIPTV, VLC, Kodi aur MAG/Stalker box. Device-wise setup, login aur troubleshooting Roman Urdu mein.',
  path: '/iptv/apps',
});

const APPS = [
  { name: 'TiviMate', devices: 'Android TV, Fire TV', price: 'Free + premium', protocol: 'Xtream', icon: Tv, steps: ['Play Store se install', 'Add playlist → Xtream Codes', 'Server + username + password', 'EPG khud bhar jayegi'], blog: '/blog/iptv-xtream-codes-setup-tivimate-smarters' },
  { name: 'IPTV Smarters', devices: 'Android, iOS, Smart TV', price: 'Free', protocol: 'Xtream / M3U', icon: Smartphone, steps: ['App kholein → Login with Xtream Codes', 'Username, password, server URL', 'Live / Movies / Series tabs', 'Favourites bana lein'], blog: '/blog/iptv-xtream-codes-setup-tivimate-smarters' },
  { name: 'XCIPTV', devices: 'Android, Fire TV', price: 'Free', protocol: 'Xtream / M3U', icon: MonitorSmartphone, steps: ['Playlist add karein', 'Xtream login chunein', 'Line ki detail daalein', 'Settings se EPG on'], blog: '/blog/tivimate-playlist-setup-guide' },
  { name: 'VLC', devices: 'Windows, Mac, Android', price: 'Free', protocol: 'M3U link', icon: Tv, steps: ['Media → Open Network Stream', 'M3U link paste karein', 'Playlist save karein', 'Baqi sab automatic'], blog: '/blog/tivimate-playlist-setup-guide' },
  { name: 'MAG / STB Emulator', devices: 'MAG 250/254, Android STB', price: 'Box / free emu', protocol: 'Stalker portal (MAC)', icon: Tv, steps: ['Portal URL: /c/ (trailing slash)', 'MAC line se juray', 'Box restart', 'Channels khud aa jate hain'], blog: '/blog/stalker-portal-mac-setup-mag-box' },
  { name: 'Kodi (PVR IPTV Simple)', devices: 'Windows, Android, LibreELEC', price: 'Free', protocol: 'M3U + XMLTV', icon: MonitorSmartphone, steps: ['PVR IPTV Simple Client enable', 'M3U URL daalein', 'XMLTV URL daalein', 'Guide refresh karein'], blog: '/blog/tivimate-playlist-setup-guide' },
];

const FAQ = [
  ['Kaun sa app sab se behtar hai?', 'Android TV / Fire TV par TiviMate, mobile par IPTV Smarters ya humara browser player. MAG box ho to portal URL hi chahiye.'],
  ['Browser player ke liye app chahiye?', 'Nahi. /iptv/player kholein, username/password daalein — live, movies, series sab chalta hai.'],
  ['Ek line par kitne device?', 'Plan ke mutabiq: Starter 1, Family 2, Premium 3. Zyada device par purana wala 90 second mein free ho jata hai.'],
  ['EPG nahi aa rahi?', 'Apps mein XMLTV URL /xmltv.php?username=…&password=… daalein, ya browser player mein guide khud aa jati hai.'],
];

export default function AppsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/apps', 'Apps & setup']]), faqJsonLd(FAQ)]} />
      <PageHead
        title="Apps aur device setup"
        intro="Mizanora IPTV Xtream, M3U aur Stalker — teenon par chalta hai. Neeche se apna device chunein, login wohi hai jo aap ko mila hai."
      />
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {APPS.map((a) => (
            <section key={a.name} className="card">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/10"><a.icon size={16} className="text-gold" /></span>
                <div>
                  <h2 className="font-display text-sm font-bold text-cream">{a.name}</h2>
                  <p className="text-[10px] uppercase tracking-wider text-faint">{a.devices} · {a.price}</p>
                </div>
              </div>
              <span className="mt-2 inline-block rounded-full border border-line bg-raised px-2 py-0.5 text-[10px] font-bold text-dim">{a.protocol}</span>
              <ul className="mt-2 space-y-1">
                {a.steps.map((s) => <li key={s} className="flex items-start gap-1.5 text-[11px] text-dim"><CheckCircle2 size={11} className="mt-0.5 shrink-0 text-gold" /> {s}</li>)}
              </ul>
              <Link href={a.blog} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-gold">Poora guide <ArrowRight size={11} /></Link>
            </section>
          ))}
        </div>

        <section className="card mt-4">
          <h2 className="font-display text-base font-bold text-cream">Login kya hoga?</h2>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
            {[
              ['Xtream apps', 'Server: https://mizanora.vercel.app', 'Username + password'],
              ['Browser player', '/iptv/player', 'Wohi username + password'],
              ['MAG / Stalker', 'Portal: https://mizanora.vercel.app/c/', 'MAC line se bound'],
            ].map(([title, a, b]) => (
              <div key={title} className="rounded-xl border border-line bg-raised p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{title}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-cream">{a}</p>
                <p className="text-[11px] text-dim">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/iptv/player" className="btn-gold">Player kholein <ArrowRight size={14} /></Link>
            <Link href="/iptv/channels" className="btn-ghost">Channel list</Link>
            <Link href="/iptv/guide" className="btn-ghost">TV guide</Link>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="mb-2 font-display text-base font-bold text-cream">Common sawal</h2>
          <div className="space-y-2">
            {FAQ.map(([qn, ans]) => (
              <details key={qn} className="rounded-2xl border border-line bg-surface px-3 py-2">
                <summary className="cursor-pointer text-xs font-bold text-cream">{qn}</summary>
                <p className="mt-1 text-[11px] leading-relaxed text-dim">{ans}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
