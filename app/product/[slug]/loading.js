export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-4" aria-hidden="true">
      <div className="mz-skel mb-4 h-3 w-48" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mz-skel aspect-square w-full" />
          <div className="mt-3 flex gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="mz-skel h-16 w-16 shrink-0" />)}</div>
        </div>
        <div className="space-y-4">
          <div className="mz-skel h-8 w-11/12" /><div className="mz-skel h-8 w-2/3" />
          <div className="mz-skel h-9 w-40" />
          <div className="mz-skel h-4 w-56" />
          <div className="flex gap-2 pt-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="mz-skel h-11 w-14" />)}</div>
          <div className="mz-skel h-12 w-full !rounded-full" /><div className="mz-skel h-12 w-full !rounded-full" />
        </div>
      </div>
    </div>
  );
}
