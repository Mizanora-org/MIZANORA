import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';
import IptvRecharge from '@/components/IptvRecharge';

export const revalidate = 3600;

export const metadata = pageMeta({
  title: 'IPTV recharge — JazzCash se line renew, premium unlock',
  description:
    'Mizanora IPTV recharge: JazzCash se apni line renew karein ya reseller credit top-up karein. Cycle 1–10 tareekh, Rs 200/mahina cap, free trial, instant activation.',
  path: '/iptv/recharge',
});

export default function RechargePage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/recharge', 'Recharge']])} />
      <PageHead
        title="Recharge aur premium unlock"
        intro="Line renew karni hai ya reseller credit barhana hai — JazzCash number, cycle aur poori price yahan saaf likhi hai. Koi hidden charge nahi."
      />
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <IptvRecharge />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/iptv/start" className="btn-ghost">Nayi line <ArrowRight size={14} /></Link>
          <Link href="/iptv/reseller" className="btn-ghost">Reseller banein</Link>
          <Link href="/iptv/status" className="btn-ghost">Status</Link>
        </div>
      </div>
    </>
  );
}
