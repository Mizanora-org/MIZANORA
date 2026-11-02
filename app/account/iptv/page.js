import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import AccountIptv from '@/components/AccountIptv';

export const metadata = pageMeta({
  title: 'My IPTV line',
  description: 'Your Mizanora IPTV line: plan, expiry, devices and login details.',
  path: '/account/iptv',
  noindex: true,
});

export default function AccountIptvPage() {
  return (
    <>
      <PageHead
        title="My IPTV"
        intro="Aap ki line, expiry, devices aur login — sab yahan."
        crumbs={[['/', 'Home'], ['/account', 'Account'], [null, 'IPTV']]}
      />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <AccountIptv />
        <p className="text-xs text-faint">
          Line nahi mil rahi? <Link href="/iptv/trial" className="font-semibold text-gold underline underline-offset-4">Free trial</Link> lein ya
          {' '}<Link href="/iptv#faq" className="font-semibold text-gold underline underline-offset-4">sawal</Link> dekhein.
        </p>
      </div>
    </>
  );
}
