import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import TrackClient from '@/components/TrackClient';

export const metadata = pageMeta({ title: 'Track your order', description: 'Track your Mizanora order with your order ID and phone number. See status, bill and courier tracking ID.', path: '/track' });

export default function TrackPage() {
  return (
    <>
      <PageHead title="Track your order" intro="Enter your order ID and the phone number you used. You will see your bill and the delivery status." crumbs={[['/', 'Home'], [null, 'Track order']]} />
      <div className="mx-auto max-w-2xl px-4 py-8"><TrackClient /></div>
    </>
  );
}
