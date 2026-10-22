import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import CheckoutClient from '@/components/CheckoutClient';

export const metadata = pageMeta({ title: 'Checkout', description: 'Enter your delivery details and pay cash on delivery.', path: '/checkout', noindex: true });

export default function CheckoutPage() {
  return (
    <>
      <PageHead title="Checkout" intro="No account needed. You pay cash when your parcel arrives." />
      <div className="mx-auto max-w-5xl px-4 py-8"><CheckoutClient /></div>
    </>
  );
}
