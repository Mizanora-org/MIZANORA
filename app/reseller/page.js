import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import ResellerPanel from '@/components/ResellerPanel';
import { IPTV } from '@/lib/iptv';

export const metadata = pageMeta({
  title: 'Reseller panel',
  description: 'Mizanora IPTV reseller panel: clients, lines, prices, kamai aur collection — sab aik jagah.',
  path: '/reseller',
  noindex: true,
});

export default function ResellerPage() {
  return (
    <>
      <PageHead
        title="Reseller panel"
        intro="Clients, lines, apni price aur kamai — sab yahan. Line bante hi credentials mil jate hain."
        crumbs={[['/', 'Home'], ['/iptv', 'IPTV'], [null, 'Reseller panel']]}
      />
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <ResellerPanel />
        <div className="card text-xs text-dim">
          <p className="font-bold text-cream">Rules yaad rakhein</p>
          <ul className="mt-1.5 space-y-1">
            <li>· Client se {IPTV.cycle.from}–{IPTV.cycle.to} tareekh ke darmiyan wasooli — apne JazzCash/Easypaisa/bank par.</li>
            <li>· Mizanora ko Rs {IPTV.wholesale} per line har mahine, {IPTV.cycle.to} tareekh tak (JazzCash {IPTV.support.replace(/^92/, '0')}).</li>
            <li>· Client se Rs {IPTV.cap} mahina se zyada nahi — cap system khud rokta hai.</li>
            <li>· {IPTV.suspendDay} tareekh tak payment na aaye to line auto-suspend, aur aap ka credit bhi ruk jata hai.</li>
          </ul>
          <p className="mt-2">
            Detail: <Link href="/iptv/reseller" className="font-semibold text-gold underline underline-offset-4">reseller page</Link>
            {' · '}<Link href="/blog/iptv-reseller-pakistan-guide" className="font-semibold text-gold underline underline-offset-4">reseller guide</Link>
            {' · '}<Link href="/blog/iptv-reseller-panel-guide" className="font-semibold text-gold underline underline-offset-4">panel kaise chalayein</Link>
          </p>
        </div>
      </div>
    </>
  );
}
