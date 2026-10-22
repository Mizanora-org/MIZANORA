import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import AccountClient from '@/components/AccountClient';

export const metadata = pageMeta({ title: 'My account', description: 'Your Mizanora orders, bills and saved addresses.', path: '/account', noindex: true });

export default function AccountPage() {
  return (
    <>
      <PageHead title="My account" intro="Your orders, bills and saved addresses." crumbs={[['/', 'Home'], [null, 'Account']]} />
      <div className="mx-auto max-w-3xl px-4 py-8"><AccountClient /></div>
    </>
  );
}
