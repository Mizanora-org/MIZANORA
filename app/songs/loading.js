// v55 — instant skeleton so /songs never looks frozen while the mirrors are asked.
export default function SongsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-4" aria-busy="true" aria-label="Songs load ho rahe hain">
      <div className="h-28 animate-pulse rounded-3xl bg-raised" />
      <div className="mt-4 h-12 animate-pulse rounded-full bg-raised" />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
            <span className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-raised" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-3/4 animate-pulse rounded bg-raised" />
              <span className="block h-2.5 w-1/2 animate-pulse rounded bg-raised" />
              <span className="block h-2 w-1/3 animate-pulse rounded bg-raised" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
