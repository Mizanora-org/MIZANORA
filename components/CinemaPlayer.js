'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  Film,
  ListVideo,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  cleanLegalStream,
  posterHue,
  titleInitials,
  youtubeEmbedUrl,
  youtubeThumbUrl,
} from '@/lib/movies';
import { formatPKR } from '@/lib/format';

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(rem)}` : `${pad(m)}:${pad(rem)}`;
}

export default function CinemaPlayer({ movie, companionProducts = [] }) {
  const legalStream = useMemo(() => cleanLegalStream(movie && movie.publicDomainStream), [movie]);
  const ytEmbed = useMemo(() => youtubeEmbedUrl(movie && movie.trailerYoutubeId), [movie]);
  const ytThumb = useMemo(() => youtubeThumbUrl(movie && movie.trailerYoutubeId), [movie]);
  const seasons = useMemo(() => (movie && Array.isArray(movie.seasons) ? movie.seasons : []), [movie]);

  const defaultTab = legalStream ? 'film' : 'trailer';
  const [tab, setTab] = useState(defaultTab);
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(0);

  // Custom HTML5 / HLS video state (used only for legal public-domain / licensed streams)
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isFs, setIsFs] = useState(false);
  const [levels, setLevels] = useState([]);
  const [curLevel, setCurLevel] = useState(-1);
  const [streamErr, setStreamErr] = useState('');
  const [snapMsg, setSnapMsg] = useState('');

  useEffect(() => {
    setTab(legalStream ? 'film' : 'trailer');
    setTrailerPlaying(false);
    setSelectedSeason(0);
    setStreamErr('');
  }, [movie && movie.slug, legalStream]);

  // Attach legal stream (direct MP4/WebM or HLS .m3u8)
  useEffect(() => {
    if (tab !== 'film' || !legalStream || !videoRef.current) return undefined;
    const el = videoRef.current;
    let cancelled = false;
    setStreamErr('');
    setLevels([]);
    setCurLevel(-1);

    const cleanupHls = () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }
    };

    if (legalStream.isHls) {
      if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = legalStream.url;
      } else {
        import('hls.js')
          .then((mod) => {
            if (cancelled) return;
            const Hls = mod.default || mod;
            if (!Hls || !Hls.isSupported()) {
              el.src = legalStream.url;
              return;
            }
            const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(legalStream.url);
            hls.attachMedia(el);
            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
              if (cancelled) return;
              const lv = (data && data.levels ? data.levels : []).map((l, idx) => ({
                idx,
                label: l.height ? `${l.height}p` : `Level ${idx + 1}`,
              }));
              setLevels(lv);
            });
            hls.on(Hls.Events.ERROR, (_, data) => {
              if (data && data.fatal && !cancelled) {
                setStreamErr('Stream temporarily unavailable from archive server. You can open the official source link below.');
              }
            });
          })
          .catch(() => {
            if (!cancelled) el.src = legalStream.url;
          });
      }
    } else {
      el.src = legalStream.url;
    }

    return () => {
      cancelled = true;
      cleanupHls();
    };
  }, [tab, legalStream]);

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const seekBy = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, (v.currentTime || 0) + delta));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const box = stageRef.current;
    if (!box) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (box.requestFullscreen) {
      box.requestFullscreen().catch(() => {});
    }
  }, []);

  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (v.requestPictureInPicture) {
      v.requestPictureInPicture().catch(() => {});
    }
  }, []);

  const changeSpeed = (next) => {
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const changeLevel = (idx) => {
    const n = Number(idx);
    setCurLevel(n);
    if (hlsRef.current) hlsRef.current.currentLevel = n;
  };

  const captureFrame = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setSnapMsg('Play the video first to capture a frame.');
      return;
    }
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${movie.slug || 'mizanora-frame'}-${Math.floor(v.currentTime || 0)}s.png`;
      a.click();
      setSnapMsg('Frame saved as PNG!');
    } catch {
      setSnapMsg('Cross-origin stream prevents browser frame capture.');
    }
    setTimeout(() => setSnapMsg(''), 3200);
  };

  const onKeyDown = (e) => {
    if (tab !== 'film' || !legalStream) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target && e.target.tagName)) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'k') { e.preventDefault(); togglePlay(); }
    else if (e.key.toLowerCase() === 'j' || e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-10); }
    else if (e.key.toLowerCase() === 'l' || e.key === 'ArrowRight') { e.preventDefault(); seekBy(10); }
    else if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
    else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
        setMuted(videoRef.current.muted);
      }
    }
  };

  const hue = posterHue(movie.slug || movie.title);
  const backdropImg = movie.backdrop || ytThumb || movie.poster;
  const activeSeason = seasons[selectedSeason] || seasons[0] || null;
  const providers = Array.isArray(movie.legalProviders) ? movie.legalProviders : [];

  return (
    <div className="grid gap-5 lg:grid-cols-12" onKeyDown={onKeyDown} tabIndex={-1}>
      <div className="lg:col-span-8 xl:col-span-9">
        {/* Mode Switcher Bar */}
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          {legalStream && (
            <button
              type="button"
              onClick={() => setTab('film')}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
                tab === 'film'
                  ? 'bg-gold text-white shadow-md'
                  : 'border border-line bg-surface text-cream hover:border-gold'
              }`}
            >
              <Play size={14} fill="currentColor" /> Full Film (100% Legal)
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('trailer')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              tab === 'trailer'
                ? 'bg-gold text-white shadow-md'
                : 'border border-line bg-surface text-cream hover:border-gold'
            }`}
          >
            <Film size={14} /> Official Trailer
          </button>
          {seasons.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('episodes')}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
                tab === 'episodes'
                  ? 'bg-gold text-white shadow-md'
                  : 'border border-line bg-surface text-cream hover:border-gold'
              }`}
            >
              <ListVideo size={14} /> Seasons &amp; Episodes ({seasons.length})
            </button>
          )}
          <span className="ml-auto hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-bold text-gold sm:inline-flex">
            <ShieldCheck size={13} /> Safe &amp; Legal Hub
          </span>
        </div>

        {/* ==================== TAB 1: LEGAL PUBLIC-DOMAIN / OWNED VIDEO PLAYER ==================== */}
        {tab === 'film' && legalStream && (
          <div
            ref={stageRef}
            className="overflow-hidden rounded-3xl border border-line bg-[#07130d] text-white shadow-2xl"
          >
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={videoRef}
                crossOrigin="anonymous"
                playsInline
                preload="metadata"
                poster={backdropImg || undefined}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurTime(e.currentTarget.currentTime || 0)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onError={() => setStreamErr('Could not load this stream right now. Use the official archive source link below.')}
                onClick={togglePlay}
                className="h-full w-full cursor-pointer object-contain"
              />

              {!playing && !streamErr && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={`Play ${movie.title}`}
                  className="group absolute inset-0 grid place-items-center bg-black/35 transition hover:bg-black/20"
                >
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-gold text-white shadow-2xl ring-4 ring-white/30 transition group-hover:scale-105 sm:h-20 sm:w-20">
                    <Play size={32} fill="currentColor" />
                  </span>
                </button>
              )}

              {streamErr && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
                  <p className="max-w-md text-sm font-semibold text-white/90">{streamErr}</p>
                  {legalStream.sourceUrl && (
                    <a
                      href={legalStream.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-4 py-2 text-xs font-extrabold text-[#2B1B00]"
                    >
                      Open on {legalStream.sourceName} <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Custom Cinema Control Bar */}
            <div className="space-y-2 border-t border-white/10 bg-[#081b13] px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2.5">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, duration)}
                  step={1}
                  value={Math.min(curTime, duration || 1)}
                  aria-label="Seek timeline"
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setCurTime(next);
                    if (videoRef.current) videoRef.current.currentTime = next;
                  }}
                  className="h-1.5 flex-1 cursor-pointer accent-[#F29F05]"
                />
                <span className="font-mono text-[0.7rem] text-white/80">
                  {fmtTime(curTime)} / {fmtTime(duration)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause' : 'Play'}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-white hover:bg-goldhi"
                  >
                    {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekBy(-10)}
                    aria-label="Rewind 10 seconds"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekBy(10)}
                    aria-label="Forward 10 seconds"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  >
                    <RotateCw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!videoRef.current) return;
                      videoRef.current.muted = !videoRef.current.muted;
                      setMuted(videoRef.current.muted);
                    }}
                    aria-label={muted ? 'Unmute' : 'Mute'}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    aria-label="Volume"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      setMuted(v === 0);
                      if (videoRef.current) {
                        videoRef.current.volume = v;
                        videoRef.current.muted = v === 0;
                      }
                    }}
                    className="hidden w-20 cursor-pointer accent-emerald-400 sm:block"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {levels.length > 1 && (
                    <select
                      aria-label="Video quality"
                      value={curLevel}
                      onChange={(e) => changeLevel(e.target.value)}
                      className="rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-xs font-bold text-white"
                    >
                      <option value={-1}>Auto HD</option>
                      {levels.map((l) => (
                        <option key={l.idx} value={l.idx}>{l.label}</option>
                      ))}
                    </select>
                  )}
                  <select
                    aria-label="Playback speed"
                    value={speed}
                    onChange={(e) => changeSpeed(Number(e.target.value))}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-xs font-bold text-white"
                  >
                    {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                      <option key={s} value={s}>{s}x</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={captureFrame}
                    title="Save frame as PNG"
                    aria-label="Capture frame"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  >
                    <Camera size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePip}
                    title="Picture in Picture"
                    aria-label="Picture in Picture"
                    className="hidden h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 sm:grid"
                  >
                    <PictureInPicture2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label="Fullscreen"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  >
                    {isFs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </div>
              </div>

              {snapMsg && <p className="text-xs font-semibold text-[#F5B83D]">{snapMsg}</p>}
            </div>

            {/* Verified License Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#05120c] px-4 py-2 text-[0.72rem] text-emerald-200/90">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                <b>Verified Legal Stream:</b> {legalStream.license}
              </span>
              {legalStream.sourceUrl && (
                <a
                  href={legalStream.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#F5B83D] hover:underline"
                >
                  Source: {legalStream.sourceName} <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: OFFICIAL TRAILER STAGE ==================== */}
        {tab === 'trailer' && (
          <div className="overflow-hidden rounded-3xl border border-line bg-[#081811] text-white shadow-xl">
            <div
              className="relative aspect-video w-full overflow-hidden"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 58%, 20%) 0%, hsl(${(hue + 50) % 360}, 65%, 9%) 100%)`,
              }}
            >
              {ytEmbed && trailerPlaying ? (
                <iframe
                  src={`${ytEmbed}&autoplay=1`}
                  title={`${movie.title} Official Trailer`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="h-full w-full border-0"
                />
              ) : ytEmbed ? (
                <button
                  type="button"
                  onClick={() => setTrailerPlaying(true)}
                  aria-label={`Play official trailer for ${movie.title}`}
                  className="group relative flex h-full w-full flex-col items-center justify-center p-6 text-center"
                >
                  {backdropImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={backdropImg}
                      alt=""
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-300 group-hover:scale-105 group-hover:opacity-65"
                    />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/30" />
                  <span className="relative grid h-16 w-16 place-items-center rounded-full bg-saffron text-[#2B1B00] shadow-2xl ring-4 ring-white/30 transition group-hover:scale-110 sm:h-20 sm:w-20">
                    <Play size={32} fill="currentColor" />
                  </span>
                  <span className="relative mt-3 rounded-full bg-black/70 px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-white backdrop-blur-sm sm:text-sm">
                    Watch Official Trailer · {movie.title} ({movie.year})
                  </span>
                </button>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 font-display text-2xl font-extrabold">
                    {titleInitials(movie.title)}
                  </span>
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-xs font-bold text-[#F5B83D]">
                    <Sparkles size={13} /> {movie.status === 'upcoming' ? `Upcoming Release · ${movie.releaseDate || movie.year}` : 'Official Title Preview'}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-white/80">
                    Official studio trailer will appear here as soon as it is published. Explore cast, story and official release platforms below.
                  </p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} ${movie.year} official trailer`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-gold hover:bg-white/90"
                  >
                    Search Official Teasers on YouTube <ExternalLink size={13} />
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#06130d] px-4 py-2.5 text-xs text-white/80">
              <span>
                Official preview &amp; discovery stage — Mizanora never embeds unauthorized third-party movie streams.
              </span>
              {movie.trailerYoutubeId && (
                <a
                  href={`https://www.youtube.com/watch?v=${movie.trailerYoutubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#F5B83D] hover:underline"
                >
                  Open on YouTube <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: SERIES SEASON & EPISODE GUIDE ==================== */}
        {tab === 'episodes' && seasons.length > 0 && (
          <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="font-display text-lg font-extrabold text-cream">Seasons &amp; Episode Guide</h3>
                <p className="text-xs text-dim">Official episode breakdown, air dates and story summaries for {movie.title}.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {seasons.map((s, idx) => (
                  <button
                    key={s.season}
                    type="button"
                    onClick={() => setSelectedSeason(idx)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                      selectedSeason === idx ? 'bg-gold text-white' : 'bg-raised text-cream hover:border-gold'
                    }`}
                  >
                    Season {s.season}
                  </button>
                ))}
              </div>
            </div>

            {activeSeason && (
              <div className="mt-4 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gold">
                  {activeSeason.title} · {activeSeason.year}
                </p>
                {(activeSeason.episodes || []).map((ep) => (
                  <div key={ep.e} className="rounded-2xl border border-line bg-ink/60 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-sm font-extrabold text-cream sm:text-base">
                        <span className="mr-2 rounded-md bg-gold/15 px-2 py-0.5 font-mono text-xs text-gold">
                          S{activeSeason.season} · E{ep.e}
                        </span>
                        {ep.title}
                      </p>
                      <span className="text-xs font-semibold text-faint">
                        {ep.runtime ? `${ep.runtime} min` : ''}{ep.runtime && ep.airDate ? ' · ' : ''}{ep.airDate || ''}
                      </span>
                    </div>
                    {ep.summary && <p className="mt-1.5 text-sm leading-relaxed text-dim">{ep.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Official Legal "Where to Watch" Bar */}
        {providers.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gold">
              Where to Watch Legally &amp; Official Links
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {providers.map((p, idx) => {
                const internal = p.url.startsWith('/');
                return internal ? (
                  <Link
                    key={`${p.name}-${idx}`}
                    href={p.url}
                    onClick={() => { if (legalStream) setTab('film'); }}
                    className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-extrabold text-gold transition hover:bg-gold hover:text-white"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>{p.name}</span>
                    <span className="rounded bg-white/80 px-1.5 py-0.5 text-[0.62rem] text-gold">{p.kind}</span>
                  </Link>
                ) : (
                  <a
                    key={`${p.name}-${idx}`}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-raised px-3.5 py-2 text-xs font-bold text-cream transition hover:border-gold hover:text-gold"
                  >
                    <span>{p.name}</span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[0.62rem] font-semibold text-dim">{p.kind}</span>
                    <ExternalLink size={12} />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ==================== COMPANION MIZANORA SHOP DEALS COLUMN ==================== */}
      <aside className="lg:col-span-4 xl:col-span-3" aria-label="Shop on Mizanora">
        <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
            <div>
              <p className="inline-flex items-center gap-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-saffron">
                <ShoppingBag size={12} /> Mizanora Store
              </p>
              <h3 className="font-display text-base font-extrabold text-cream">Shop While You Browse</h3>
            </div>
            <Link href="/deals" className="text-xs font-bold text-gold hover:underline">
              All deals →
            </Link>
          </div>

          {companionProducts.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {companionProducts.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/product/${p.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-ink/50 p-2 transition hover:border-gold hover:bg-surface"
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover"
                      />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-raised font-bold text-gold">
                        MZ
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-bold leading-snug text-cream group-hover:text-gold">
                        {p.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-gold">{formatPKR(p.price)}</span>
                        {p.comparePrice > p.price && (
                          <span className="text-[0.68rem] text-faint line-through">{formatPKR(p.comparePrice)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-2xl bg-raised p-3.5 text-xs text-dim">
              Explore fashion, footwear, gadgets and everyday essentials on Mizanora with Cash on Delivery across Pakistan.
            </div>
          )}

          <Link
            href="/products"
            className="btn-gold mt-3.5 flex w-full items-center justify-center gap-1.5 !py-2.5 text-xs"
          >
            <ShoppingBag size={14} /> Open Mizanora Market (COD)
          </Link>
        </div>
      </aside>
    </div>
  );
}
