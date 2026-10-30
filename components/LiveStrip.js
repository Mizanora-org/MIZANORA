'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Clock3, Radio, Tv } from 'lucide-react';
import LiveBadge from './LiveBadge';
import { nowPlaying, tickerLines } from '@/lib/liveChannel';
import { stripModel, timeAgo } from '@/lib/liveBadges';

// ============================================================================
// THE LIVE BAR (v33)
// ----------------------------------------------------------------------------
// One smooth, animated band that says what the shop is broadcasting RIGHT NOW:
//   * a pulsing LIVE badge (or SCHEDULED when the channel is off air),
//   * what is playing (Quran tilawat / hadees / product ad) with a progress bar,
//   * how many minutes are left and what comes next,
//   * the Pakistan clock, ticking every second,
//   * a marquee of the channel's ticker lines and the live TV count.
//
// The program is a function of the wall clock (lib/liveChannel.js), so every
// visitor sees the SAME ayah at the same second. Nothing is fetched in the
// browser: the config arrives with the page and the clock is local.
//
// `initialAt` is rendered by the server: the first client render uses exactly
// that number, so React hydration always matches. After mount the clock runs.
// ============================================================================
export default function LiveStrip({
  channel = null,        // cleaned channel config (lib/liveChannel cleanChannel) or null
  tv = null,             // { count, channels: [{ name, slug }] }
  initialAt = 0,         // server timestamp (keeps the first paint identical on both sides)
  variant = 'page',      // 'home' (compact) | 'page' (full bar)
  href = '/live-channel',
}) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    // One interval for the whole bar; paused while the tab is hidden.
    const id = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => clearInterval(id);
  }, []);

  const at = mounted && now ? now : (Number(initialAt) || 0);
  const ready = Boolean(at);

  const model = useMemo(() => {
    let playing = null;
    if (channel && ready) {
      try { playing = nowPlaying(channel, at); } catch { playing = null; }
    }
    let tickers = [];
    try { tickers = channel ? tickerLines(channel) : []; } catch { tickers = []; }
    return stripModel({ playing, tv, now: at || undefined, tickers });
  }, [channel, tv, at, ready]);

  const b = model.banner;
  const progress = Math.round((b.progress || 0) * 100);
  const leftMin = b.nextInMs ? Math.max(1, Math.round(b.nextInMs / 60000)) : 0;

  return (
    <section className={`mz-live-strip is-${variant}${b.onAir ? ' is-onair' : ' is-offair'}`} aria-label="Mizanora live now">
      <span className="mz-live-strip-glow" aria-hidden="true" />

      {/* left: the badge + what is playing */}
      <div className="mz-live-strip-main">
        <LiveBadge state={b.tone} label={b.onAir ? 'LIVE' : 'OFF AIR'} size={variant === 'home' ? 'sm' : 'md'} />

        <div className="mz-live-strip-copy">
          <p className="mz-live-strip-title">
            {b.onAir ? b.title : 'Mizanora Live Channel'}
            {b.onAir && b.sub ? <span className="mz-live-strip-sub"> · {b.sub}</span> : null}
          </p>
          {variant === 'page' && (
            <p className="mz-live-strip-line">
              {b.onAir
                ? (leftMin ? <><Clock3 size={12} aria-hidden="true" /> {leftMin} min baqi{b.nextTitle ? ` · phir ${b.nextTitle}` : ''}</> : <><Activity size={12} aria-hidden="true" /> Live</>)
                : <><Clock3 size={12} aria-hidden="true" /> {b.sub || 'Schedule ke mutabiq on hoga'}</>}
            </p>
          )}
        </div>

        {b.onAir && (
          <span className="mz-live-strip-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Current program progress">
            <i style={{ width: `${Math.max(2, progress)}%` }} />
          </span>
        )}
      </div>

      {/* middle: the Pakistan clock */}
      <div className="mz-live-strip-clock" aria-label="Pakistan time">
        <span className="mz-live-strip-clock-time">{ready ? model.clock.hms : '--:--:--'}</span>
        <span className="mz-live-strip-clock-meta">{ready ? `${model.clock.day} · ${model.clock.tz}` : 'PKT'}</span>
      </div>

      {/* right: channels + the way in */}
      <div className="mz-live-strip-side">
        {model.channels.length > 0 && (
          <span className="mz-live-strip-chans">
            <Tv size={13} aria-hidden="true" />
            <b>{model.channels.length}</b> channels
          </span>
        )}
        <Link href={href} className="mz-live-strip-cta">
          <Radio size={13} aria-hidden="true" /> Watch <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      {/* the moving ticker line (the channel's own words) */}
      {variant === 'page' && (
        <div className="mz-live-strip-ticker" aria-hidden="true">
          <div className="mz-live-strip-track">
            {(() => {
              const items = model.tickers.length
                ? model.tickers
                : ['Mizanora Live: Quran, Hadees aur products', 'Cash on delivery across Pakistan', 'Shop smart. Shop halal.'];
              return [...items, ...items].map((t, i) => <span key={`${i}-${String(t).slice(0, 10)}`} className="mz-live-strip-tick">{t}</span>);
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

// A tiny "synced X ago" note for live data (the GitHub section, admin cards).
// It renders a dash first, then the real time - so the server and the browser
// always agree on the first paint.
export function SyncedAgo({ at, label = 'Synced', className = '' }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const t = now ? timeAgo(at, now) : { text: '…', tone: 'idle' };
  return (
    <span className={`mz-synced ${className}`} title={at ? new Date(Number(at)).toISOString() : ''} data-tone={t.tone}>
      {label} <b>{t.text}</b><i aria-hidden="true" />
    </span>
  );
}
