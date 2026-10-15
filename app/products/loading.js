import { CardSkeletons } from '@/components/PageLoader';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
      <div className="mz-skel mb-3 h-11 w-full" aria-hidden="true" />
      <div className="no-sb mb-4 flex gap-2 overflow-hidden" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="mz-skel h-8 w-24 shrink-0 !rounded-full" />)}</div>
      <CardSkeletons count={10} />
    </div>
  );
}
