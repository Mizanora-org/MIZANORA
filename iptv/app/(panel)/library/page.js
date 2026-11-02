'use client';
import { useMemo, useState } from 'react';
import { Search, Plus, Film, Clapperboard, HardDrive, Cpu, Star, Play, Layers, Upload } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Toast, Tabs, Progress, SectionHead, Modal, Hint } from '@/components/ui';
import { fmt } from '@/lib/data';

const TITLES = [
  ['Kaghaz Ke Phool', 2025, 'Drama', 8.4, '4K', 'movie', 'ready', ['#0d8b58', '#134e3a']],
  ['Raat Ki Awaz', 2024, 'Thriller', 7.9, 'FHD', 'movie', 'ready', ['#a78bfa', '#3b2470']],
  ['Safar e Ishq', 2026, 'Romance', 8.1, 'FHD', 'series', 'ready', ['#ff7a8a', '#5c1a24']],
  ['Border Line', 2025, 'Action', 7.6, '4K', 'movie', 'ready', ['#f5b83d', '#7a4b06']],
  ['Dhoop Kinare 2', 2026, 'Drama', 8.8, 'FHD', 'series', 'transcoding', ['#4cc3ff', '#0b3d55']],
  ['Ghar Ka Chiragh', 2023, 'Family', 7.2, 'HD', 'series', 'ready', ['#34d399', '#0f3b2c']],
  ['Shehr e Khwab', 2026, 'Mystery', 8.0, '4K', 'movie', 'transcoding', ['#7dd3fc', '#123a52']],
  ['Jeevan Saathi', 2024, 'Romance', 7.5, 'FHD', 'series', 'ready', ['#f472b6', '#5c2140']],
  ['Toofan', 2025, 'Action', 8.2, '4K', 'movie', 'ready', ['#fb923c', '#5c2c0b']],
  ['Aangan', 2022, 'Drama', 8.6, 'FHD', 'series', 'ready', ['#0d8b58', '#134e3a']],
  ['Silent Witness', 2026, 'Crime', 7.8, 'FHD', 'series', 'ready', ['#94a3b8', '#1e293b']],
  ['Chandni Chowk', 2025, 'Comedy', 7.1, 'HD', 'movie', 'ready', ['#fbbf24', '#78350f']],
  ['Iron Valley', 2024, 'Sci-Fi', 8.3, '4K', 'movie', 'ready', ['#38bdf8', '#0c4a6e']],
  ['Maa', 2023, 'Family', 9.0, 'FHD', 'movie', 'ready', ['#a78bfa', '#3b2470']],
  ['Night Shift', 2026, 'Horror', 6.9, 'FHD', 'movie', 'transcoding', ['#ef4444', '#450a0a']],
  ['Kiran', 2025, 'Drama', 8.5, '4K', 'series', 'ready', ['#f5b83d', '#7a4b06']],
  ['Last Train', 2024, 'Thriller', 7.7, 'FHD', 'movie', 'ready', ['#22d3ee', '#0e4a56']],
  ['Gulzar', 2026, 'Poetry', 8.9, '4K', 'series', 'ready', ['#c084fc', '#3b1e5c']],
].map(([title, year, genre, rating, quality, type, status, tint], i) => ({
  id: `m${i}`, title, year, genre, rating, quality, type, status, tint,
  size: type === 'movie' ? `${(1.2 + (i % 9) * 0.7).toFixed(1)} GB` : `${8 + (i % 6) * 4} eps`,
  views: 200 + ((i * 977) % 4200),
  seasons: type === 'series' ? 1 + (i % 3) : 0,
}));

export default function LibraryPage() {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('All');
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');

  const genres = useMemo(() => ['All', ...new Set(TITLES.map((t) => t.genre))], []);
  const items = useMemo(() => TITLES.filter((t) => {
    if (tab !== 'all' && t.type !== tab) return false;
    if (genre !== 'All' && t.genre !== genre) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tab, genre, q]);

  const stats = {
    movies: TITLES.filter((t) => t.type === 'movie').length,
    series: TITLES.filter((t) => t.type === 'series').length,
    storage: '18.4 TB',
    queue: TITLES.filter((t) => t.status === 'transcoding').length,
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Movies & series</h1>
            <p className="mt-1 text-sm text-dim">VOD library with TMDB metadata, posters and transcoding queue.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setOpen(true)}><Upload size={15} /> Bulk add</Btn>
            <Btn variant="gold" onClick={() => setOpen(true)}><Plus size={15} /> Add title</Btn>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Film, stats.movies.toLocaleString(), 'Movies', '#14b87a'],
          [Clapperboard, stats.series.toLocaleString(), 'Series', '#a78bfa'],
          [HardDrive, stats.storage, 'Storage used', '#4cc3ff'],
          [Cpu, `${stats.queue} in queue`, 'Transcoding', '#f5b83d'],
        ].map(([Icon, v, l, c], i) => (
          <Reveal key={l} delay={i * 50}>
            <div className="panel panel-pad flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${c}1c`, color: c }}><Icon size={18} /></span>
              <div><div className="num text-lg font-extrabold">{v}</div><div className="text-[10px] uppercase tracking-wider text-faint">{l}</div></div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={80}>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs items={[{ id: 'all', label: 'All' }, { id: 'movie', label: 'Movies' }, { id: 'series', label: 'Series' }]} value={tab} onChange={setTab} />
          <div className="relative ml-auto w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search titles…" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button key={g} onClick={() => setGenre(g)} className={`chip ${genre === g ? 'active' : ''}`}>{g}</button>
          ))}
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {items.map((t, i) => (
          <Reveal key={t.id} delay={Math.min(i * 28, 300)}>
            <article className="group relative overflow-hidden rounded-2xl border border-line bg-white/[0.03] transition hover:border-gold/40">
              <div className="relative aspect-[2/3] overflow-hidden"
                style={{ background: `linear-gradient(160deg,${t.tint[0]},${t.tint[1]} 60%,#04100a)` }}>
                <div className="absolute inset-0 grid-bg opacity-30" />
                <div className="absolute inset-0 flex flex-col justify-between p-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-black tracking-wider">{t.quality}</span>
                    <span className="flex items-center gap-0.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-bold"><Star size={9} className="text-gold" />{t.rating}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{t.genre} · {t.year}</p>
                    <h3 className="text-sm font-extrabold leading-tight drop-shadow">{t.title}</h3>
                    {t.type === 'series' && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/60"><Layers size={10} />{t.seasons} season{t.seasons > 1 ? 's' : ''}</p>}
                  </div>
                </div>
                <div className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-[#241a00] shadow-xl"><Play size={17} /></span>
                </div>
                {t.status === 'transcoding' && (
                  <span className="absolute left-2 top-9 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-goldsoft">transcoding…</span>
                )}
              </div>
              <div className="p-2.5">
                <div className="flex items-center justify-between text-[10px] text-faint">
                  <span>{t.size}</span>
                  <span className="num">{fmt(t.views)} views</span>
                </div>
                <Progress value={t.status === 'ready' ? 100 : 62} height={3} tone={t.status === 'ready' ? '#14b87a' : '#f5b83d'} className="mt-1.5" />
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="panel panel-pad">
          <SectionHead title="Recent imports" sub="TMDB matched automatically · posters stored on R2" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TITLES.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.03] px-3 py-2">
                <span className="h-10 w-7 rounded" style={{ background: `linear-gradient(160deg,${t.tint[0]},${t.tint[1]})` }} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-xs">{t.title}</b>
                  <span className="text-[10px] text-faint">{t.year} · {t.genre} · {t.quality}</span>
                </div>
                <Badge tone={t.status === 'ready' ? 'live' : 'gold'}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Modal open={open} onClose={() => setOpen(false)} title="Add titles" sub="Upload file, or point to a URL — the worker transcodes to a 3-rung HLS ladder." wide>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Title" />
            <input className="input" placeholder="Year" defaultValue="2026" />
            <input className="input" placeholder="Genre" />
            <input className="input" placeholder="TMDB ID (optional)" />
          </div>
          <div className="rounded-2xl border border-dashed border-line bg-white/[0.02] p-6 text-center">
            <Upload size={22} className="mx-auto text-gold" />
            <p className="mt-2 text-xs font-bold">Drop MKV / MP4 here</p>
            <p className="text-[10px] text-faint">Direct upload to R2 · max 40 GB per file</p>
          </div>
          <Hint>Real build: queue → ffmpeg worker → 1080p/720p/480p HLS + poster + subtitle tracks. Prototype mein sirf UI.</Hint>
          <div className="flex justify-end gap-2"><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={() => { setOpen(false); setToast('3 titles queued for transcoding'); }}>Queue import</Btn></div>
        </div>
      </Modal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
