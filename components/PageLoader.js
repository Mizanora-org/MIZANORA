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
