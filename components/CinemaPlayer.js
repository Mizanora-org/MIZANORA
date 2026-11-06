'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  Captions,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Gauge,
  Languages,
  ListVideo,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Server,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { resolveMovieServers } from '@/lib/movieServers';
import { cleanLegalStream, posterHue, titleInitials, youtubeEmbedUrl, youtubeThumbUrl } from '@/lib/movies';
import { formatPKR } from '@/lib/format';
import { movieEntry, patchRecentProgress, readRecent, touchRecent } from '@/lib/movieProgress';

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(rem)}` : `${pad(m)}:${pad(rem)}`;
}

const resLabel = (height) => (height >= 2160 ? '4K' : height >= 1440 ? '2K' : height >= 1080 ? '1080p' : height >= 720 ? '720p' : height >= 480 ? '480p' : height ? `${height}p` : 'Auto');

const kindLabel = { hls: 'HLS', mp4: 'MP4', dash: 'DASH', embed: 'Embed' };

export default function CinemaPlayer({ movie, companionProducts = [], servers = [], adConfig = null }) {
  const imdbId = movie && movie.imdbId ? String(movie.imdbId).toLowerCase() : '';
  const isSeries = movie && movie.type === 'series';
  const seasons = useMemo(() => (movie && Array.isArray(movie.seasons) ? movie.seasons : []), [movie]);
  const ytEmbed = useMemo(() => youtubeEmbedUrl(movie && movie.trailerYoutubeId), [movie]);
  const ytThumb = useMemo(() => youtubeThumbUrl(movie && movie.trailerYoutubeId), [movie]);
  const archiveStream = useMemo(() => cleanLegalStream(movie && movie.publicDomainStream), [movie]);
  const providers = Array.isArray(movie && movie.legalProviders) ? movie.legalProviders : [];

  const adSeconds = Math.max(0, Math.min(30, Number(adConfig && adConfig.seconds) || 0));
  const adSkipAfter = Math.max(0, Math.min(20, Number(adConfig && adConfig.skipAfter) || 0));
  const adsOn = !(adConfig && adConfig.enabled === false);
  const adProducts = Array.isArray(companionProducts) ? companionProducts.filter(Boolean) : [];

  const [tab, setTab] = useState('watch');
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [episode, setEpisode] = useState(1);
  const [serverId, setServerId] = useState('');
  const [adStage, setAdStage] = useState('idle'); // idle | countdown | done
  const [adLeft, setAdLeft] = useState(0);
  const [adIndex, setAdIndex] = useState(0);
  const [railMsg, setRailMsg] = useState('');
  const [slowHint, setSlowHint] = useState(false);
  const triedServers = useRef(new Set());

  const activeSeason = seasons[seasonIdx] || seasons[0] || null;
  const episodes = (activeSeason && Array.isArray(activeSeason.episodes)) ? activeSeason.episodes : [];

  // Every server the admin switched on, with the URL for THIS season / episode already filled in.
  const resolved = useMemo(() => {
    const info = {
      imdbId,
      slug: movie ? movie.slug : '',
      title: movie ? movie.title : '',
      year: movie ? movie.year : 0,
      type: isSeries ? 'series' : 'movie',
      season: Number(activeSeason && activeSeason.season) || 1,
      episode: Number(episode) || 1,
    };
    const list = resolveMovieServers(servers || [], info);
    if (archiveStream) {
      list.unshift({
        id: 'mz-free-archive',
        name: 'Mizanora Free Archive',
        kind: archiveStream.isHls ? 'hls' : 'mp4',
        quality: 'Auto',
        language: 'Original',
        scope: 'all',
        priority: 0,
        enabled: true,
        url: archiveStream.url,
        note: archiveStream.sourceName || 'Public domain / licensed',
        isArchive: true,
      });
    }
    return list;
  }, [servers, imdbId, movie, isSeries, activeSeason, episode, archiveStream]);

  const activeServer = resolved.find((s) => s.id === serverId) || resolved[0] || null;
  const canSkip = adStage === 'countdown' && adSeconds - adLeft >= adSkipAfter;
  const playing = tab === 'watch' && adStage === 'done' && Boolean(activeServer);

  // ---- ad timer ------------------------------------------------------------------------------
  useEffect(() => {
    if (adStage !== 'countdown') return undefined;
    if (adLeft <= 0) {
      setAdStage('done');
      return undefined;
    }
    const t = setTimeout(() => setAdLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [adStage, adLeft]);

  // A new title starts from scratch (fresh ad, first server, season 1).
  useEffect(() => {
    setTab('watch');
    setSeasonIdx(0);
    setEpisode(1);
    setServerId('');
    setAdStage('idle');
    setAdLeft(0);
    setRailMsg('');
    setSlowHint(false);
    triedServers.current = new Set();
  }, [movie && movie.slug]);

  // Remember this title in "Continue watching" as soon as playback really starts.
  const movieId = String((movie && (movie.imdbId || movie.slug)) || '').toLowerCase();
  useEffect(() => {
    if (!playing || !movie) return;
    touchRecent({ ...movieEntry(movie), server: (activeServer && activeServer.name) || '' });
  }, [playing, movieId, activeServer && activeServer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // An embed frame cannot report its own errors, so after 12 s of nothing we offer the next server.
  useEffect(() => {
    if (!playing || !activeServer || activeServer.kind !== 'embed') {
      setSlowHint(false);
      return undefined;
    }
    const t = setTimeout(() => setSlowHint(true), 12000);
    return () => clearTimeout(t);
  }, [playing, activeServer && activeServer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const adKey = `mz_movie_ad_${(movie && (movie.imdbId || movie.slug)) || 'x'}`;
  const startWatch = useCallback(
    (id) => {
      if (id) setServerId(id);
      if (adStage === 'countdown' || adStage === 'done') return;
      let already = false;
      try {
        already = window.sessionStorage.getItem(adKey) === '1';
      } catch {
        /* ignore */
      }
      if (adsOn && adSeconds > 0 && !already) {
        setAdLeft(adSeconds);
        setAdStage('countdown');
        setAdIndex((n) => n + 1);
      } else {
        setAdStage('done');
      }
    },
    [adStage, adsOn, adSeconds, adKey],
  );

  const finishAd = useCallback(() => {
    setAdStage('done');
    setAdLeft(0);
    try {
      window.sessionStorage.setItem(adKey, '1');
    } catch {
      /* ignore */
    }
  }, [adKey]);

  // Switch servers by hand: forget the "already tried" set from the previous choice.
  const pickServer = useCallback((id) => {
    triedServers.current = new Set([id]);
    setServerId(id);
    setRailMsg('');
    setSlowHint(false);
    if (adStage !== 'done') startWatch(id);
  }, [adStage, startWatch]);

  // A direct stream that dies (DNS, 403, dead host) moves to the next server on its own - once per
  // server, so two broken hosts cannot bounce the viewer back and forth.
  const handleServerError = useCallback((reason) => {
    const currentId = activeServer && activeServer.id;
    const idx = resolved.findIndex((s) => s.id === currentId);
    const next = resolved.slice(idx + 1).find((s) => s.id !== currentId && !triedServers.current.has(s.id));
    if (next) {
      triedServers.current.add(next.id);
      setServerId(next.id);
      setSlowHint(false);
      setRailMsg(`“${(activeServer && activeServer.name) || 'Server'}” jawab nahi de raha — “${next.name}” par switch kar diya.`);
    } else {
      setRailMsg(reason || 'Yeh server jawab nahi de raha. Upar se doosra server chunein.');
    }
  }, [resolved, activeServer]);

  const hue = posterHue((movie && (movie.slug || movie.title)) || 'mizanora');
  const backdrop = (movie && (movie.backdrop || ytThumb || movie.poster)) || '';

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8 xl:col-span-9">
        {/* ---------- mode tabs ---------- */}
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('watch')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              tab === 'watch' ? 'bg-gold text-white shadow-md' : 'border border-line bg-surface text-cream hover:border-gold'
            }`}
          >
            <Play size={14} fill="currentColor" /> Watch Now
            {resolved.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[0.62rem] ${tab === 'watch' ? 'bg-white/25' : 'bg-raised text-dim'}`}>
                {resolved.length} server{resolved.length === 1 ? '' : 's'}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('trailer')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              tab === 'trailer' ? 'bg-gold text-white shadow-md' : 'border border-line bg-surface text-cream hover:border-gold'
            }`}
          >
            <Film size={14} /> Official Trailer
          </button>
          {isSeries && seasons.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('episodes')}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
                tab === 'episodes' ? 'bg-gold text-white shadow-md' : 'border border-line bg-surface text-cream hover:border-gold'
              }`}
            >
              <ListVideo size={14} /> Seasons &amp; Episodes ({seasons.length})
            </button>
          )}
          <span className="ml-auto hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-bold text-gold sm:inline-flex">
            <ShieldCheck size={13} /> Mizanora Player
          </span>
        </div>

        {/* ================= WATCH ================= */}
        {tab === 'watch' && (
          <div className="overflow-hidden rounded-3xl border border-line bg-[#06130d] shadow-lg">
            <div
              className="relative aspect-video w-full overflow-hidden"
              style={
                backdrop && !playing
                  ? { backgroundImage: `linear-gradient(180deg, rgba(3,20,13,0.55), rgba(3,20,13,0.92)), url(${backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: `radial-gradient(circle at 30% 20%, hsl(${hue} 58% 22%), #04120c 70%)` }
              }
            >
              {/* ---------- the actual player ---------- */}
              {playing && activeServer && (
                <ServerStage
                  key={`${activeServer.id}-${episode}-${seasonIdx}`}
                  server={activeServer}
                  poster={backdrop}
                  title={`${movie.title}${isSeries && activeSeason ? ` · S${activeSeason.season}E${episode}` : ''}`}
                  movie={movie}
                  onError={handleServerError}
                  onNotice={(m) => setRailMsg(m)}
                />
              )}

              {/* ---------- start gate: press play, then our own ad, then the stream ---------- */}
              {tab === 'watch' && adStage === 'idle' && resolved.length > 0 && (
                <button
                  type="button"
                  onClick={() => startWatch()}
                  className="group/gate absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/85 via-black/45 to-black/50 px-4 text-center"
                >
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F5B83D] text-[#221600] shadow-2xl ring-4 ring-white/25 transition group-hover/gate:scale-105 sm:h-20 sm:w-20">
                    <Play size={28} fill="currentColor" />
                  </span>
                  <span className="font-display text-lg font-extrabold text-white sm:text-2xl">Watch {movie.title}</span>
                  <span className="max-w-md text-xs font-semibold text-white/80">
                    {activeServer ? `Playing from ${activeServer.name}` : 'Choose a server below'}
                    {adsOn && adSeconds > 0 ? ` · ${adSeconds}s Mizanora ad first, skip after ${adSkipAfter}s` : ''}
                  </span>
                  {movie.status === 'upcoming' && (
                    <span className="rounded-full bg-saffron px-3 py-1 text-[0.68rem] font-extrabold text-[#2B1B00]">
                      Upcoming · {movie.releaseDate || movie.year} — preview & trailer ready
                    </span>
                  )}
                </button>
              )}

              {/* ---------- pre-roll: our own ad, then the player loads ---------- */}
              {tab === 'watch' && adStage === 'countdown' && (
                <AdRoll
                  stage={adStage}
                  left={adLeft}
                  seconds={adSeconds}
                  canSkip={canSkip}
                  skipAfter={adSkipAfter}
                  product={adProducts.length ? adProducts[adIndex % adProducts.length] : null}
                  headline={(adConfig && adConfig.headline) || 'Mizanora Store'}
                  note={(adConfig && adConfig.note) || 'Pakistan bhar mein Cash on Delivery.'}
                  poster={backdrop}
                  hue={hue}
                  onSkip={finishAd}
                  hasServers={resolved.length > 0}
                />
              )}

              {playing && slowHint && (
                <div className="absolute bottom-3 right-3 z-20 max-w-[16rem] rounded-xl border border-white/20 bg-black/80 p-2.5 text-right backdrop-blur">
                  <p className="text-[0.68rem] font-bold text-white/85">Kuch nazar nahi aa raha?</p>
                  <button
                    type="button"
                    onClick={() => handleServerError('')}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#F5B83D] px-2.5 py-1 text-[0.66rem] font-extrabold text-[#221600] hover:brightness-95"
                  >
                    <SkipForward size={11} /> Next server try karein
                  </button>
                </div>
              )}

              {/* ---------- live quality / server chips ---------- */}
              {playing && (
                <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-white backdrop-blur">
                    <Server size={11} /> {activeServer.name}
                  </span>
                  {activeServer.kind !== 'embed' && (
                    <span className="rounded-full bg-gold/90 px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-wider text-white">
                      {kindLabel[activeServer.kind] || 'Stream'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ---------- server picker ---------- */}
            <div className="border-t border-white/10 bg-[#06130d] px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-wider text-white/70">
                  <Server size={12} /> Play from
                  {resolved.length > 1 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.62rem] text-white/80">{resolved.length} servers</span>}
                </p>
                <Link href="/licence" className="inline-flex items-center gap-1 text-[0.66rem] font-bold text-[#F5B83D] hover:underline">
                  <ShieldCheck size={11} /> Streaming rights &amp; licence
                </Link>
              </div>

              {resolved.length > 0 ? (
                <div className="no-sb mt-2 flex gap-2 overflow-x-auto pb-1">
                  {resolved.map((s) => {
                    const on = activeServer && activeServer.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickServer(s.id)}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                          on
                            ? 'border-[#F5B83D] bg-[#F5B83D]/15 text-white shadow'
                            : 'border-white/15 bg-white/5 text-white/80 hover:border-[#F5B83D]/60 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {s.isArchive ? <ShieldCheck size={12} className="text-emerald-300" /> : <Server size={12} />}
                          {s.name}
                          {on && <CheckCircle2 size={12} className="text-[#F5B83D]" />}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-wide text-white/55">
                          <span className="rounded bg-white/10 px-1">{s.quality || 'Auto'}</span>
                          <span>{kindLabel[s.kind] || 'Embed'}</span>
                          {s.language ? <span className="truncate">· {s.language}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
                  <p className="font-bold text-[#F5B83D]">Abhi koi play server set nahi hai</p>
                  <p className="mt-1 leading-relaxed">
                    Admin &gt; Movies &gt; <b>Play Servers</b> mein apna server link add karein (jaise{' '}
                    <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.68rem]">https://my-cdn.com/play/{'{imdbid}'}</code>).
                    Us ke baad har title yahan khud chalne lagega.
                  </p>
                  {ytEmbed && (
                    <button type="button" onClick={() => setTab('trailer')} className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 font-bold text-white hover:bg-white/25">
                      <Film size={12} /> Watch the official trailer instead
                    </button>
                  )}
                </div>
              )}

              {railMsg && <p className="mt-2 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[0.7rem] font-semibold text-amber-200">{railMsg}</p>}
            </div>

            {/* ---------- season / episode rail ---------- */}
            {isSeries && seasons.length > 0 && (
              <div className="border-t border-white/10 bg-[#04100a] px-3 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-white/60">Season</span>
                  {seasons.map((s, idx) => (
                    <button
                      key={s.season || idx}
                      type="button"
                      onClick={() => {
                        setSeasonIdx(idx);
                        setEpisode(1);
                        setRailMsg('');
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                        seasonIdx === idx ? 'bg-[#F5B83D] text-[#221600]' : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {s.season}
                    </button>
                  ))}
                  {episodes.length > 0 && (
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Previous episode"
                        onClick={() => setEpisode((e) => Math.max(1, e - 1))}
                        className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="min-w-[4.5rem] text-center text-xs font-bold text-white">Ep {episode}</span>
                      <button
                        type="button"
                        aria-label="Next episode"
                        onClick={() => setEpisode((e) => Math.min(episodes.length || 99, e + 1))}
                        className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </span>
                  )}
                </div>
                {episodes.length > 0 && (
                  <div className="no-sb mt-2 flex gap-1.5 overflow-x-auto pb-1">
                    {episodes.map((ep) => (
                      <button
                        key={ep.e}
                        type="button"
                        title={ep.title}
                        onClick={() => {
                          setEpisode(ep.e);
                          setRailMsg('');
                          if (adStage === 'idle') startWatch();
                        }}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold transition ${
                          episode === ep.e ? 'bg-gold text-white' : 'bg-white/10 text-white/75 hover:bg-white/20'
                        }`}
                      >
                        E{ep.e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TRAILER ================= */}
        {tab === 'trailer' && (
          <div className="overflow-hidden rounded-3xl border border-line bg-[#06130d] shadow-lg">
            <div className="relative aspect-video w-full">
              {ytEmbed ? (
                <iframe
                  src={`${ytEmbed}&autoplay=1`}
                  title={`${movie.title} official trailer`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                  <span
                    className="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 font-display text-2xl font-extrabold text-white"
                    style={{ background: `linear-gradient(145deg, hsl(${hue}, 58%, 30%), hsl(${(hue + 45) % 360}, 65%, 14%))` }}
                  >
                    {titleInitials(movie.title)}
                  </span>
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-xs font-bold text-[#F5B83D]">
                    <Sparkles size={13} /> {movie.status === 'upcoming' ? `Upcoming Release · ${movie.releaseDate || movie.year}` : 'Official Title Preview'}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-white/80">
                    The official studio trailer will appear here as soon as it is published. Cast, story and official links are below.
                  </p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} ${movie.year} official trailer`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-gold hover:bg-white/90"
                  >
                    Search official teasers on YouTube <ExternalLink size={13} />
                  </a>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5 text-xs text-white/75">
              <span>Official trailer · Mizanora never re-uploads studio content.</span>
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

        {/* ================= EPISODES ================= */}
        {tab === 'episodes' && (
          <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="font-display text-lg font-extrabold text-cream">Seasons &amp; Episode Guide</h3>
                <p className="text-xs text-dim">Official episode breakdown, air dates and story summaries for {movie.title}.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {seasons.map((s, idx) => (
                  <button
                    key={`tab-s-${s.season || idx}`}
                    type="button"
                    onClick={() => { setSeasonIdx(idx); setEpisode(1); }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                      seasonIdx === idx ? 'bg-gold text-white' : 'bg-raised text-cream hover:border-gold'
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
                  <button
                    key={ep.e}
                    type="button"
                    onClick={() => {
                      setEpisode(ep.e);
                      setTab('watch');
                      if (adStage === 'idle') startWatch();
                    }}
                    className="block w-full rounded-2xl border border-line bg-ink/60 p-3.5 text-left transition hover:border-gold"
                  >
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
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] font-extrabold text-gold">
                      <Play size={11} fill="currentColor" /> Play this episode
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- official where-to-watch strip ---------- */}
        {providers.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Where to Watch Legally &amp; Official Links</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {providers.map((p, idx) => {
                const internal = String(p.url || '').startsWith('/');
                return internal ? (
                  <Link
                    key={`${p.name}-${idx}`}
                    href={p.url}
                    className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-extrabold text-gold transition hover:bg-gold hover:text-white"
                  >
                    <Play size={13} fill="currentColor" /> <span>{p.name}</span>
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

      {/* ================= SHOP SIDEBAR ================= */}
      <aside className="min-w-0 lg:col-span-4 xl:col-span-3" aria-label="Shop on Mizanora">
        <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
            <div>
              <p className="inline-flex items-center gap-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-saffron">
                <ShoppingBag size={12} /> Mizanora Store
              </p>
              <h3 className="font-display text-base font-extrabold text-cream">Shop While You Watch</h3>
            </div>
            <Link href="/deals" className="text-xs font-bold text-gold hover:underline">All deals →</Link>
          </div>

          {adProducts.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {adProducts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/product/${p.slug}`} className="group flex items-center gap-3 rounded-2xl border border-line bg-ink/50 p-2 transition hover:border-gold hover:bg-surface">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover" />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-raised font-bold text-gold">MZ</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-bold leading-snug text-cream group-hover:text-gold">{p.name}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-gold">{formatPKR(p.price)}</span>
                        {p.comparePrice > p.price && <span className="text-[0.68rem] text-faint line-through">{formatPKR(p.comparePrice)}</span>}
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

          <Link href="/products" className="btn-gold mt-3.5 flex w-full items-center justify-center gap-1.5 !py-2.5 text-xs">
            <ShoppingBag size={14} /> Open Mizanora Market (COD)
          </Link>
        </div>

        <div className="mt-3 rounded-2xl border border-line bg-surface p-3.5 text-[0.7rem] leading-relaxed text-dim">
          <b className="block text-cream">Player tips</b>
          Space / K play-pause · ← → 10s · F full screen · C screenshot. Streaming sources are added by the
          site admin; Mizanora only plays what it is licensed to play.
        </div>
      </aside>
    </div>
  );
}

/* ============================================================================================ */
/* Ad roll: our own house ad. Plays BEFORE the stream starts, skippable after a few seconds.    */
/* ============================================================================================ */
function AdRoll({ stage, left, seconds, skipAfter, canSkip, product, headline, note, hue, onSkip, hasServers }) {
  const progress = seconds > 0 ? Math.min(100, ((seconds - left) / seconds) * 100) : 100;
  const waitSkip = Math.max(0, (skipAfter || 0) - (seconds - left));
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#03160e] via-[#0a2b1c] to-[#101b2e] text-white">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-wider text-white/85 backdrop-blur">
          <Sparkles size={10} /> Advertisement · {headline}
        </span>
        <span className="rounded-full bg-black/45 px-2 py-1 font-mono text-[0.68rem] font-bold text-white/85">
          {stage === 'countdown' ? `${left}s` : 'Ready'}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-2">
        <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md sm:p-4">
          <div className="flex items-center gap-3">
            {product && product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl bg-white object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span
                className="grid h-20 w-20 shrink-0 place-items-center rounded-xl text-lg font-extrabold"
                style={{ background: `linear-gradient(150deg, hsl(${hue}, 60%, 34%), hsl(${(hue + 50) % 360}, 65%, 18%))` }}
              >
                MZ
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-extrabold uppercase tracking-wider text-[#F5B83D]">{headline}</p>
              <p className="mt-0.5 line-clamp-2 font-display text-sm font-extrabold leading-snug sm:text-base">
                {product ? product.name : 'Pakistan ki apni online shopping — COD ke saath'}
              </p>
              <p className="mt-1 line-clamp-2 text-[0.7rem] leading-snug text-white/75">{note}</p>
              {product && (
                <p className="mt-1 flex items-baseline gap-1.5">
                  <b className="text-sm font-extrabold text-[#F5B83D]">{formatPKR(product.price)}</b>
                  {product.comparePrice > product.price && <span className="text-[0.66rem] text-white/60 line-through">{formatPKR(product.comparePrice)}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Link
              href={product ? `/product/${product.slug}` : '/products'}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[0.72rem] font-extrabold text-[#0B3D28] hover:bg-white/90"
            >
              <ShoppingBag size={12} /> {product ? 'View on Mizanora' : 'Shop Mizanora'}
            </Link>
            {!hasServers && <span className="text-[0.66rem] font-semibold text-amber-200">No play server configured yet</span>}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#F5B83D] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[0.66rem] text-white/60">{product ? 'Sponsored by a Mizanora seller' : 'Mizanora house ad'}</span>
          <button
            type="button"
            onClick={onSkip}
            disabled={!canSkip}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
              canSkip ? 'bg-[#F5B83D] text-[#221600] hover:brightness-95' : 'cursor-not-allowed bg-white/10 text-white/45'
            }`}
          >
            <SkipForward size={13} /> {canSkip ? 'Skip ad' : `Skip in ${waitSkip}s`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================================ */
/* Server stage: direct HTML5/HLS/DASH player with quality, audio tracks, captions & shortcuts.  */
/* Embed servers get a sandboxed iframe.                                                        */
/* ============================================================================================ */
function ServerStage({ server, poster, title, movie, onError, onNotice }) {
  if (server.kind === 'embed') {
    return (
      <div className="relative h-full w-full bg-black">
        <iframe
          src={server.url}
          title={`${title} — ${server.name}`}
          className="h-full w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          loading="eager"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6 text-[0.66rem] text-white/75">
          <span>Stream: {server.name} · {server.kind.toUpperCase()}</span>
          <a
            href={server.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex items-center gap-1 font-bold text-[#F5B83D] hover:underline"
          >
            Open in new tab <ExternalLink size={11} />
          </a>
        </div>
      </div>
    );
  }
  return <DirectPlayer server={server} poster={poster} title={title} movie={movie} onError={onError} onNotice={onNotice} />;
}

function DirectPlayer({ server, poster, title, movie, onError, onNotice }) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimer = useRef(null);
  const movieId = String((movie && (movie.imdbId || movie.slug)) || '').toLowerCase();

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isFs, setIsFs] = useState(false);
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState(-1);
  const [audios, setAudios] = useState([]);
  const [audioId, setAudioId] = useState(-1);
  const [subs, setSubs] = useState([]);
  const [subId, setSubId] = useState(-1);
  const [showUi, setShowUi] = useState(true);
  const [menu, setMenu] = useState('');
  const [resume, setResume] = useState(0);
  const [stats, setStats] = useState({ res: '', kbps: 0, buffer: 0, dropped: 0, codec: '' });
  const [msg, setMsg] = useState('');
  const [shot, setShot] = useState('');

  const showMsg = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); }, []);

  // ---- attach the stream ---------------------------------------------------------------
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    let dead = false;
    setBuffering(true);
    setReady(false);
    setLevels([]);
    setAudios([]);
    setSubs([]);
    setMenu('');
    onNotice && onNotice('');

    const killHls = () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }
    };

    const afterMeta = () => {
      setReady(true);
      setBuffering(false);
      const saved = readRecent().find((x) => x.id === movieId);
      if (saved && Number(saved.t) > 45 && el.duration && saved.t < el.duration - 45) setResume(Number(saved.t));
    };

    if (server.kind === 'hls' && !el.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then((mod) => {
          if (dead) return;
          const Hls = mod.default || mod;
          if (!Hls || !Hls.isSupported()) {
            el.src = server.url;
            return;
          }
          const conn = (typeof navigator !== 'undefined' && navigator.connection) || {};
          const estimate = conn.downlink ? Math.max(800_000, Number(conn.downlink) * 1_000_000) : 2_500_000;
          const h = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: -1, // fastest possible start, then climb
            abrEwmaDefaultEstimate: estimate,
            abrEwmaFastVoD: 3,
            abrEwmaSlowVoD: 9,
            abrBandWidthFactor: 0.85,
            abrBandWidthUpFactor: 0.7,
            startFragPrefetch: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 90,
            backBufferLength: 30,
            maxBufferHole: 0.5,
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 500,
          });
          hlsRef.current = h;
          h.loadSource(server.url);
          h.attachMedia(el);
          h.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
            if (dead) return;
            const rows = ((data && data.levels) || []).map((l, idx) => ({
              idx,
              height: l.height || 0,
              bitrate: l.bitrate || 0,
              label: `${resLabel(l.height)}${l.bitrate ? ` · ${Math.round(l.bitrate / 1000)} kbps` : ''}`,
            }));
            setLevels(rows.sort((a, b) => b.height - a.height));
          });
          h.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
            if (dead) return;
            setLevel(h.currentLevel);
            const lv = h.levels && h.levels[h.currentLevel];
            if (lv) setStats((s) => ({ ...s, res: resLabel(lv.height), kbps: Math.round((lv.bitrate || 0) / 1000) }));
          });
          h.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
            if (dead) return;
            setAudios(((data && data.audioTracks) || []).map((t, i) => ({ i, name: t.name || t.lang || `Track ${i + 1}`, lang: t.lang || '' })));
          });
          h.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
            if (dead) return;
            setSubs(((data && data.subtitleTracks) || []).map((t, i) => ({ i, name: t.name || t.lang || `Subtitle ${i + 1}` })));
          });
          h.on(Hls.Events.ERROR, (_e, data) => {
            if (dead || !data) return;
            if (data.fatal) {
              if (data.type === 'networkError') h.startLoad();
              else if (data.type === 'mediaError') h.recoverMediaError();
              else {
                setMsg('Stream could not load. Try another server above.');
                onError && onError('This server is not responding. Choose another server from the list above.');
              }
            }
          });
        })
        .catch(() => {
          if (!dead) el.src = server.url;
        });
    } else {
      el.src = server.url;
    }

    const onLoaded = () => afterMeta();
    const onErr = () => {
      if (dead) return;
      setBuffering(false);
      setMsg('Stream could not load. Try another server above.');
      onError && onError('This server is not responding right now. Pick another server above.');
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onErr);

    return () => {
      dead = true;
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('error', onErr);
      killHls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.kind, movieId]);

  // ---- html5 events --------------------------------------------------------------------
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    const onTime = () => {
      setCur(el.currentTime || 0);
      if (el.buffered && el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1) || 0);
      if (el.duration) setDur(el.duration || 0);
    };
    const onPlay = () => { setPlaying(true); setBuffering(false); };
    const onPause = () => setPlaying(false);
    const onWait = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('durationchange', onTime);
    el.addEventListener('progress', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWait);
    el.addEventListener('playing', onCanPlay);
    el.addEventListener('canplay', onCanPlay);

    const tick = setInterval(() => {
      if (!el.duration || !el.currentTime) return;
      patchRecentProgress(movieId, el.currentTime, el.duration);
      const h = hlsRef.current;
      if (h && h.bandwidthEstimate) setStats((s) => ({ ...s, kbps: Math.round(h.bandwidthEstimate / 1000) }));
      try {
        const q = el.getVideoPlaybackQuality ? el.getVideoPlaybackQuality() : null;
        if (q) setStats((s) => ({ ...s, dropped: q.droppedVideoFrames || 0 }));
      } catch { /* Safari */ }
      if (el.videoHeight) setStats((s) => (s.res ? s : { ...s, res: resLabel(el.videoHeight) }));
      setStats((s) => ({ ...s, buffer: Math.max(0, (el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0) - el.currentTime) }));
    }, 4000);

    return () => {
      clearInterval(tick);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('durationchange', onTime);
      el.removeEventListener('progress', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWait);
      el.removeEventListener('playing', onCanPlay);
      el.removeEventListener('canplay', onCanPlay);
    };
  }, [movieId]);

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Autoplay once the ad is over (browsers may still want a tap - then the big play button stays).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const p = el.play && el.play();
    if (p && p.catch) p.catch(() => setBuffering(false));
  }, [server.url]);

  // ---- controls ------------------------------------------------------------------------
  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const seek = useCallback((to) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, to));
  }, []);

  const jump = useCallback((delta) => {
    const el = videoRef.current;
    if (el) seek((el.currentTime || 0) + delta);
  }, [seek]);

  const fullScreen = useCallback(() => {
    const box = stageRef.current;
    if (!box) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
  }, []);

  const pip = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else if (el.requestPictureInPicture) el.requestPictureInPicture().catch(() => {});
  }, []);

  const setQuality = (idx) => {
    setLevel(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    showMsg(idx < 0 ? 'Quality: Auto' : `Quality locked: ${levels[idx] ? levels[idx].label : ''}`);
    setMenu('');
  };

  const setAudio = (idx) => {
    setAudioId(idx);
    const h = hlsRef.current;
    if (h && h.audioTrack !== idx) h.audioTrack = idx;
    const el = videoRef.current;
    if (el && el.audioTracks) {
      for (let i = 0; i < el.audioTracks.length; i += 1) el.audioTracks[i].enabled = i === idx;
    }
    showMsg('Audio track changed');
    setMenu('');
  };

  const setSubtitle = (idx) => {
    setSubId(idx);
    const h = hlsRef.current;
    if (h) {
      h.subtitleTrack = idx;
      h.subtitleDisplay = idx >= 0;
    }
    const el = videoRef.current;
    if (el && el.textTracks) {
      for (let i = 0; i < el.textTracks.length; i += 1) el.textTracks[i].mode = i === idx ? 'showing' : 'disabled';
    }
    showMsg(idx < 0 ? 'Subtitles off' : 'Subtitles on');
    setMenu('');
  };

  const changeSpeed = (next) => {
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
    setMenu('');
  };

  const snapshot = () => {
    const el = videoRef.current;
    if (!el || !el.videoWidth) {
      showMsg('Play the video first, then take a screenshot.');
      return;
    }
    try {
      const c = document.createElement('canvas');
      c.width = el.videoWidth;
      c.height = el.videoHeight;
      c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `${(movie && movie.slug) || 'mizanora'}-${Math.floor(el.currentTime || 0)}s.png`;
      a.click();
      showMsg('Screenshot saved as PNG');
    } catch {
      showMsg('This stream does not allow screenshots (protected cross-origin media).');
    }
  };

  const onKey = (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = String(e.key || '').toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'arrowleft' || k === 'j') { e.preventDefault(); jump(-10); }
    else if (k === 'arrowright' || k === 'l') { e.preventDefault(); jump(10); }
    else if (k === 'arrowup') { e.preventDefault(); const v = Math.min(1, volume + 0.1); setVolume(v); if (videoRef.current) videoRef.current.volume = v; }
    else if (k === 'arrowdown') { e.preventDefault(); const v = Math.max(0, volume - 0.1); setVolume(v); if (videoRef.current) videoRef.current.volume = v; }
    else if (k === 'f') { e.preventDefault(); fullScreen(); }
    else if (k === 'm') { e.preventDefault(); const el = videoRef.current; if (el) { el.muted = !el.muted; setMuted(el.muted); } }
    else if (k === 'c') { e.preventDefault(); snapshot(); }
  };

  const armHide = () => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) { setShowUi(false); setMenu(''); }
    }, 3200);
  };

  const pct = dur > 0 ? (cur / dur) * 100 : 0;
  const bufPct = dur > 0 ? (buffered / dur) * 100 : 0;

  return (
    <div
      ref={stageRef}
      tabIndex={-1}
      onKeyDown={onKey}
      onMouseMove={armHide}
      onTouchStart={armHide}
      className="group relative h-full w-full bg-black outline-none"
      style={{ backgroundImage: poster ? `url(${poster})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black"
        playsInline
        controls={false}
        poster={poster}
        onClick={toggle}
        onDoubleClick={fullScreen}
      />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35">
          <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/25 border-t-[#F5B83D]" />
        </div>
      )}

      {!playing && ready && (
        <button type="button" onClick={toggle} className="absolute inset-0 grid place-items-center bg-black/25" aria-label="Play">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F5B83D] text-[#221600] shadow-2xl ring-4 ring-white/20">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      )}

      {resume > 0 && !playing && (
        <button
          type="button"
          onClick={() => { seek(resume); setResume(0); toggle(); }}
          className="absolute left-3 top-14 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-[0.7rem] font-extrabold text-white backdrop-blur hover:bg-black"
        >
          <RotateCw size={12} /> Resume from {fmtTime(resume)}
        </button>
      )}

      {/* ------- controls ------- */}
      <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8 transition-opacity duration-200 ${showUi || !playing ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
        <div className="relative mx-1 h-1.5 cursor-pointer rounded-full bg-white/25" onMouseDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * (dur || 0)); }}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufPct}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#F5B83D]" style={{ width: `${pct}%` }} />
          <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `calc(${pct}% - 6px)` }} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-0.5 text-white sm:gap-1">
          <Ctrl label={playing ? 'Pause' : 'Play'} onClick={toggle}>{playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}</Ctrl>
          <Ctrl label="Back 10s" onClick={() => jump(-10)}><RotateCcw size={15} /></Ctrl>
          <Ctrl label="Forward 10s" onClick={() => jump(10)}><RotateCw size={15} /></Ctrl>

          <div className="group/vol relative flex items-center">
            <Ctrl label={muted ? 'Unmute' : 'Mute'} onClick={() => { const el = videoRef.current; if (el) { el.muted = !el.muted; setMuted(el.muted); } }}>
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </Ctrl>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
                if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
              }}
              className="hidden w-16 accent-[#F5B83D] sm:block"
            />
          </div>

          <span className="px-1 font-mono text-[0.68rem] text-white/85">{fmtTime(cur)} / {dur ? fmtTime(dur) : '--:--'}</span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {stats.res && (
              <span className="hidden items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 text-[0.62rem] font-bold sm:inline-flex">
                <Gauge size={10} /> {stats.res}{stats.kbps ? ` · ${stats.kbps} kbps` : ''}
              </span>
            )}

            {levels.length > 0 && (
              <MenuButton id="quality" menu={menu} setMenu={setMenu} label="Quality" icon={<Settings2 size={15} />}>
                <MenuItem on={level < 0} onClick={() => setQuality(-1)}>Auto (recommended)</MenuItem>
                {levels.map((l) => (
                  <MenuItem key={l.idx} on={level === l.idx} onClick={() => setQuality(l.idx)}>{l.label}</MenuItem>
                ))}
              </MenuButton>
            )}

            {audios.length > 1 && (
              <MenuButton id="audio" menu={menu} setMenu={setMenu} label="Audio track" icon={<Languages size={15} />}>
                {audios.map((a) => (
                  <MenuItem key={a.i} on={audioId === a.i} onClick={() => setAudio(a.i)}>{a.name}{a.lang ? ` · ${a.lang}` : ''}</MenuItem>
                ))}
              </MenuButton>
            )}

            {subs.length > 0 && (
              <MenuButton id="subs" menu={menu} setMenu={setMenu} label="Subtitles" icon={<Captions size={15} />}>
                <MenuItem on={subId < 0} onClick={() => setSubtitle(-1)}>Off</MenuItem>
                {subs.map((s) => (
                  <MenuItem key={s.i} on={subId === s.i} onClick={() => setSubtitle(s.i)}>{s.name}</MenuItem>
                ))}
              </MenuButton>
            )}

            <MenuButton id="speed" menu={menu} setMenu={setMenu} label="Speed" icon={<span className="text-[0.66rem] font-extrabold">{speed}×</span>}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                <MenuItem key={s} on={speed === s} onClick={() => changeSpeed(s)}>{s}×</MenuItem>
              ))}
            </MenuButton>

            <Ctrl label="Screenshot" onClick={snapshot}><Camera size={15} /></Ctrl>
            <Ctrl label="Picture in picture" onClick={pip}><PictureInPicture2 size={15} /></Ctrl>
            <Ctrl label="Full screen" onClick={fullScreen}>{isFs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</Ctrl>
          </div>
        </div>
      </div>

      {(msg || shot) && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-[0.7rem] font-semibold text-white backdrop-blur">
          {msg || shot}
        </div>
      )}
    </div>
  );
}

function Ctrl({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-md p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white">
      {children}
    </button>
  );
}

function MenuButton({ id, menu, setMenu, label, icon, children }) {
  const open = menu === id;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenu(open ? '' : id)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={`rounded-md p-1.5 transition hover:bg-white/15 ${open ? 'bg-white/15 text-white' : 'text-white/85'}`}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute bottom-9 right-0 z-40 min-w-[9rem] rounded-xl border border-white/15 bg-[#08160f]/95 p-1 shadow-2xl backdrop-blur">
          <p className="px-2 py-1 text-[0.6rem] font-extrabold uppercase tracking-wider text-white/45">{label}</p>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition ${on ? 'bg-[#F5B83D]/20 text-[#F5B83D]' : 'text-white/85 hover:bg-white/10'}`}
    >
      <span>{children}</span>
      {on && <CheckCircle2 size={12} />}
    </button>
  );
}
