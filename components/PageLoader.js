// Small branded loader shown inside the page while a new page is being prepared.
export default function PageLoader({ label = 'Loading' }) {
  return (
    <div className="mz-loader" role="status" aria-live="polite">
      <div>
        <div className="mz-logo-wrap">
          <span className="ring" aria-hidden="true" /><span className="ring r2" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mz-logo" src="/icons/icon-192.png" width="64" height="64" alt="" />
        </div>
        <p className="font-display text-sm font-bold tracking-[.3em] text-gold">MIZANORA</p>
        <p className="mt-1 text-xs text-faint">{label}...</p>
        <div className="mz-bar" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}

export function CardSkeletons({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="mz-skel aspect-square !rounded-none" />
          <div className="space-y-2 p-3"><div className="mz-skel h-3.5 w-11/12" /><div className="mz-skel h-3.5 w-1/2" /><div className="mz-skel mt-3 h-8 w-full !rounded-full" /></div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for a product page (photo left, details right) - shown while the product is being fetched.
export function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4" aria-hidden="true">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="mz-skel aspect-square !rounded-3xl" />
        <div className="space-y-4">
          <div className="mz-skel h-7 w-4/5" />
          <div className="mz-skel h-6 w-1/3" />
          <div className="mz-skel h-4 w-full" />
          <div className="mz-skel h-4 w-5/6" />
          <div className="mz-skel h-11 w-full !rounded-full" />
          <div className="mz-skel h-11 w-full !rounded-full" />
          <div className="grid grid-cols-3 gap-3"><div className="mz-skel h-20" /><div className="mz-skel h-20" /><div className="mz-skel h-20" /></div>
        </div>
      </div>
    </div>
  );
}

// Skeleton for a listing page: title, chips, then the card grid.
export function ListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4" aria-hidden="true">
      <div className="mz-skel h-8 w-56" />
      <div className="mt-3 flex gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="mz-skel h-9 w-24 !rounded-full" />)}</div>
      <div className="mt-5"><CardSkeletons count={10} /></div>
    </div>
  );
}
