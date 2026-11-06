// v55 — skeleton for the movies hub (Cinemeta + the IMDb snapshot).
export default function MoviesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-6 sm:px-4" aria-busy="true" aria-label="Movies load ho rahi hain">
      <div className="h-40 animate-pulse rounded-3xl bg-raised" />
      {[0, 1].map((row) => (
        <div key={row} className="pt-8">
          <div className="h-4 w-40 animate-pulse rounded bg-raised" />
          <div className="mt-3 flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[42vw] max-w-[185px] shrink-0 sm:w-auto sm:flex-1">
                <div className="aspect-[2/3] animate-pulse rounded-2xl bg-raised" />
                <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-raised" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
