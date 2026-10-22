import { CardSkeletons } from '@/components/PageLoader';
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8" aria-hidden="true">
      <div className="mz-skel h-8 w-64" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="mz-skel h-24 !rounded-2xl" />)}
      </div>
      <div className="mt-8"><CardSkeletons count={5} /></div>
    </div>
  );
}
