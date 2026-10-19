import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import CartClient from '@/components/CartClient';

export const metadata = pageMeta({ title: 'Your cart', description: 'Review the items in your cart.', path: '/cart', noindex: true });

export default function CartPage() {
  return (
    <>
      <PageHead title="Your cart" />
      <div className="mx-auto max-w-4xl px-4 py-8"><CartClient /></div>
    </>
  );
}
