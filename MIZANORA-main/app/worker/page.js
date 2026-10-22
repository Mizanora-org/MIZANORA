import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import WorkerClient from '@/components/WorkerClient';

export const metadata = pageMeta({ title: 'Worker dashboard', description: 'Your Mizanora worker links, orders and earnings.', path: '/worker', noindex: true });

export default function WorkerPage() {
  return (
    <>
      <PageHead title="Worker dashboard" intro="Share products, track orders and withdraw your commission." crumbs={[['/', 'Home'], ['/workers', 'Worker program'], [null, 'Dashboard']]} />
      <div className="mx-auto max-w-3xl px-4 py-8"><WorkerClient /></div>
    </>
  );
}
