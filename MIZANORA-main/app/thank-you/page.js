import { Suspense } from 'react';
import { pageMeta } from '@/lib/seo';
import ThankYouClient from '@/components/ThankYouClient';

export const metadata = pageMeta({ title: 'Thank you for your order', description: 'Your Mizanora order has been received.', path: '/thank-you', noindex: true });

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<p className="text-dim">Loading...</p>}><ThankYouClient /></Suspense>
    </div>
  );
}
