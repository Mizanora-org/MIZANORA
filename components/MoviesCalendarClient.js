'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Film, Sparkles, Tv } from 'lucide-react';
import { MOVIE_REGIONS, buildReleaseCalendar, posterHue, titleInitials } from '@/lib/movies';

export default function MoviesCalendarClient({ movies = [], todayIso = '2026-11-05' }) {
  const [region, setRegion] = useState('all');
  const [type, setType] = useState('all');
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  const months = useMemo(
    () =>
      buildReleaseCalendar(movies, {
        region,
        type,
        includeRecent: !upcomingOnly,
        refDate: todayIso,
      }),
    [movies, region, type, upcomingOnly, todayIso],
  );

  return (
    <div>
      {/* Filter controls */}
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ['all', 'All Formats', null],
              ['movie', 'Movies', Film],
              ['series', 'Series & Dramas', Tv],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  type === id ? 'bg-gold text-white' : 'bg-raised text-cream hover:text-gold'
                }`}
              >
                {Icon && <Icon size={13} />} {label}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-cream">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(e) => setUpcomingOnly(e.target.checked)}
              className="h-4 w-4 rounded accent-[#0B6B45]"
            />
            Show Upcoming Releases Only
          </label>
        </div>

        <div className="no-sb mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {MOVIE_REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegion(r.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                region === r.id
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-line bg-surface text-dim hover:border-gold'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month-by-month timeline */}
      {months.length > 0 ? (
        <div className="mt-6 space-y-8">
          {months.map((mGroup) => (
            <section key={mGroup.ym} aria-labelledby={`cal-${mGroup.ym}`}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-white shadow">
                  <Calendar size={17} />
                </span>
                <div>
                  <h2 id={`cal-${mGroup.ym}`} className="font-display text-xl font-extrabold text-cream">
                    {mGroup.label}
                  </h2>
                  <p className="text-xs text-faint">
                    {mGroup.items.length} scheduled {mGroup.items.length === 1 ? 'release' : 'releases'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {mGroup.items.map((item) => {
                  const hue = posterHue(item.slug || item.title);
                  const isFuture = item.status === 'upcoming' || (item.daysAway != null && item.daysAway > 0);
                  const dayChip =
                    item.daysAway === 0
                      ? 'Releases Today!'
                      : item.daysAway != null && item.daysAway > 0
                        ? `In ${item.daysAway} day${item.daysAway === 1 ? '' : 's'}`
                        : 'Released';

                  return (
                    <Link
                      key={item.slug}
                      href={`/movies/${item.slug}`}
                      prefetch={false}
                      className="group flex gap-3.5 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
                    >
                      <div
                        className="flex h-24 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-inner sm:h-28 sm:w-20"
                        style={{
                          background: `linear-gradient(155deg, hsl(${hue}, 58%, 26%), hsl(${(hue + 45) % 360}, 65%, 12%))`,
                        }}
                      >
                        <span className="font-display text-lg font-extrabold">{titleInitials(item.title)}</span>
                        <span className="mt-1 rounded bg-black/40 px-1.5 py-0.5 text-[0.6rem] font-bold">
                          {item.releaseDate.slice(5)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold ${
                              isFuture ? 'bg-saffron/25 text-[#7A4E00]' : 'bg-gold/10 text-gold'
                            }`}
                          >
                            {isFuture ? <Sparkles size={10} /> : <Clock size={10} />}
                            {dayChip}
                          </span>
                          <span className="rounded bg-raised px-2 py-0.5 text-[0.62rem] font-bold text-dim">
                            {item.region}
                          </span>
                          <span className="rounded bg-raised px-2 py-0.5 text-[0.62rem] font-bold uppercase text-dim">
                            {item.type}
                          </span>
                          {item.imdbId && (
                            <span className="font-mono text-[0.62rem] font-bold text-faint">{item.imdbId}</span>
                          )}
                        </div>

                        <h3 className="mt-1.5 line-clamp-1 font-display text-base font-extrabold text-cream group-hover:text-gold sm:text-lg">
                          {item.title}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-dim">
                          {item.tagline || item.story}
                        </p>
                        <p className="mt-1.5 text-[0.68rem] font-semibold text-faint">
                          Release date: <b className="text-cream">{item.releaseDate}</b>
                          {(item.cast || []).length > 0 && (
                            <> · Cast: {item.cast.slice(0, 3).map((c) => c.name).join(', ')}</>
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center text-sm text-dim">
          No scheduled titles matched this filter. Switch back to All Regions or uncheck Upcoming Only.
        </div>
      )}
    </div>
  );
}
