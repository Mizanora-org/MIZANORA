'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Upload, LayoutGrid, List, Signal, SignalZero, Crown, CalendarClock,
  Play, MoreHorizontal, ArrowUpDown, Link2, FileText, CheckCircle2, X,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Modal, Toast, SectionHead, Progress, Tabs, Hint } from '@/components/ui';
import { CHANNELS, GROUPS } from '@/lib/data';

const QUALITY = ['All', 'SD', 'HD', 'FHD', '4K'];
const SORTS = [
  { id: 'viewers', label: 'Most watched' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'health', label: 'Best uptime' },
  { id: 'epg', label: 'EPG coverage' },
];

export default function ChannelsPage() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const [quality, setQuality] = useState('All');
  const [sort, setSort] = useState('viewers');
  const [view, setView] = useState('grid');
  const [only, setOnly] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [pasted, setPasted] = useState('https://panel.example.com/get.php?username=demo&password=demo&type=m3u_plus');
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState('');

  const list = useMemo(() => {
    let out = CHANNELS.filter((c) => {
      if (group !== 'All' && c.group !== group) return false;
      if (quality !== 'All' && c.quality !== quality) return false;
      if (only === 'online' && !c.online) return false;
      if (only === 'offline' && c.online) return false;
      if (only === 'premium' && !c.premium) return false;
      if (only === 'noepg' && c.epg > 0) return false;
      if (q && !`${c.name} ${c.group}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    out = out.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'health' ? b.uptime - a.uptime
      : sort === 'epg' ? b.epg - a.epg
      : b.viewers - a.viewers);
    return out;
  }, [q, group, quality, sort, only]);

  const stats = useMemo(() => ({
    total: CHANNELS.length,
    online: CHANNELS.filter((c) => c.online).length,
    premium: CHANNELS.filter((c) => c.premium).length,
    epg: Math.round((CHANNELS.filter((c) => c.epg > 0).length / CHANNELS.length) * 100),
  }), []);

  const runImport = () => {
    setStep(3); setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(t); setTimeout(() => { setImportOpen(false); setStep(1); setToast('2,418 channels imported · 42 duplicates skipped'); }, 500); return 100; }
        return p + 7;
      });
    }, 90);
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Live channels</h1>
            <p className="mt-1 text-sm text-dim">{stats.total} in the library · {stats.online} online · {stats.premium} premium · EPG on {stats.epg}%</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="gold" onClick={() => { setImportOpen(true); setStep(1); }}><Upload size={15} /> Bulk import M3U</Btn>
            <Btn><Plus size={15} /> New channel</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="panel p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search 2,418 channels, groups, sources…" />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-line bg-black/25 p-1">
              {[['grid', LayoutGrid], ['table', List]].map(([id, Icon]) => (
                <button key={id} onClick={() => setView(id)} aria-label={id}
                  className={`grid h-8 w-8 place-items-center rounded-lg transition ${view === id ? 'bg-white/10 text-gold' : 'text-faint hover:text-cream'}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 overflow-x-auto no-sb">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Groups</span>
            {['All', ...GROUPS].map((g) => (
              <button key={g} onClick={() => setGroup(g)} className={`chip shrink-0 ${group === g ? 'active' : ''}`}>{g}</button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Filter</span>
            {[['all', 'All'], ['online', 'Online'], ['offline', 'Offline'], ['premium', 'Premium'], ['noepg', 'Missing EPG']].map(([id, label]) => (
              <button key={id} onClick={() => setOnly(id)} className={`chip shrink-0 ${only === id ? 'active' : ''}`}>{label}</button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Quality</span>
              <div className="flex gap-1">
                {QUALITY.map((x) => (
                  <button key={x} onClick={() => setQuality(x)} className={`chip ${quality === x ? 'active' : ''}`}>{x}</button>
                ))}
              </div>
              <span className="ml-2 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-faint">
                <ArrowUpDown size={11} /> Sort
              </span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto py-1.5 text-xs">
                {SORTS.map((s) => <option key={s.id} value={s.id} className="bg-[#071410]">{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Reveal>

      {view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i * 22, 260)}>
              <article className="card group h-full">
                <div className="flex items-start gap-3">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl text-xs font-black"
                    style={{ background: `linear-gradient(140deg,${c.tint[0]},${c.tint[1]})` }}>
                    {c.name.slice(0, 2).toUpperCase()}
                    <span className="absolute inset-0 bg-gradient-to-b from-white/35 to-transparent opacity-50" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="truncate text-sm font-bold">{c.name}</h3>
                      {c.premium && <Crown size={13} className="shrink-0 text-gold" />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="muted">{c.group}</Badge>
                      <Badge tone={c.quality === '4K' ? 'violet' : c.quality === 'FHD' ? 'info' : 'muted'}>{c.quality}</Badge>
                      {c.online ? <Badge tone="live" dot>ON</Badge> : <Badge tone="off" dot>OFF</Badge>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  {[['Viewers', c.viewers], ['Uptime', `${c.uptime.toFixed(1)}%`], ['Sources', c.sources]].map(([a, b]) => (
                    <div key={a} className="rounded-lg bg-white/[0.04] py-1.5">
                      <div className="num text-xs font-extrabold">{b}</div>
                      <div className="text-[9px] uppercase tracking-wider text-faint">{a}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <CalendarClock size={12} className={c.epg > 50 ? 'text-emerald' : 'text-gold'} />
                  <span className="text-[10px] text-faint">EPG {c.epg}%</span>
                  <Progress value={c.epg} height={4} tone={c.epg > 50 ? '#14b87a' : '#f5b83d'} className="flex-1" />
                  <span className="num text-[10px] text-faint">{c.bitrate.toFixed(1)} Mb</span>
                </div>

                <div className="mt-3 flex gap-1.5">
                  <Link href="/watch" className="btn btn-sm btn-primary flex-1"><Play size={12} /> Preview</Link>
                  <Btn size="sm" variant="ghost" onClick={() => setToast(`${c.name} — edit drawer`)}><Link2 size={12} /> Sources</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setToast('Channel settings')}><MoreHorizontal size={12} /></Btn>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal>
          <div className="panel overflow-hidden">
            <div className="max-h-[62vh] overflow-auto scroll-thin">
              <table className="tbl">
                <thead>
                  <tr><th>Channel</th><th>Group</th><th>Quality</th><th>Status</th><th className="text-right">Viewers</th><th className="text-right">Uptime</th><th>EPG</th><th /></tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black"
                            style={{ background: `linear-gradient(140deg,${c.tint[0]},${c.tint[1]})` }}>{c.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <b className="flex items-center gap-1 text-xs">{c.name}{c.premium && <Crown size={11} className="text-gold" />}</b>
                            <span className="text-[10px] text-faint">{c.sources} sources · updated {c.updated}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-dim">{c.group}</td>
                      <td><Badge tone={c.quality === '4K' ? 'violet' : 'muted'}>{c.quality}</Badge></td>
                      <td>{c.online ? <span className="inline-flex items-center gap-1 text-[11px] text-emeraldsoft"><Signal size={12} /> Online</span> : <span className="inline-flex items-center gap-1 text-[11px] text-red-300"><SignalZero size={12} /> Offline</span>}</td>
                      <td className="num text-right text-xs">{c.viewers}</td>
                      <td className="num text-right text-xs">{c.uptime.toFixed(1)}%</td>
                      <td><div className="flex items-center gap-1.5"><Progress value={c.epg} height={4} tone={c.epg > 50 ? '#14b87a' : '#f5b83d'} className="w-16" /><span className="num text-[10px] text-faint">{c.epg}%</span></div></td>
                      <td className="text-right"><Link href="/watch" className="btn btn-icon btn-ghost"><Play size={13} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-faint">
              <span>Showing {list.length} of {stats.total} channels</span>
              <span>Server-side paging ready · 50 rows</span>
            </div>
          </div>
        </Reveal>
      )}

      {!list.length && (
        <div className="panel grid place-items-center py-16 text-center">
          <X size={28} className="text-faint" />
          <p className="mt-2 text-sm font-bold">Koi channel match nahi hui</p>
          <p className="text-xs text-faint">Filters clear karein ya doosra group chunein.</p>
        </div>
      )}

      {/* ------------------------------------------------------ import modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Bulk import channels" sub="M3U file, M3U link, or an Xtream panel — dedupe and grouping are automatic." wide>
        <div className="mb-4 flex items-center gap-2">
          {['Source', 'Review', 'Import'].map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-extrabold ${step > i ? 'bg-emerald text-[#04170e]' : step === i + 1 ? 'bg-gold text-[#241a00]' : 'bg-white/10 text-faint'}`}>
                {step > i + 1 ? <CheckCircle2 size={12} /> : i + 1}
              </span>
              <span className={`text-[11px] font-bold ${step === i + 1 ? 'text-cream' : 'text-faint'}`}>{s}</span>
              {i < 2 && <span className="h-px flex-1 bg-line" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <Tabs items={[{ id: 'url', label: 'M3U link' }, { id: 'file', label: 'Upload file' }, { id: 'xtream', label: 'Xtream panel' }]} value="url" onChange={() => {}} />
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} className="input" />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#f5b83d]" /> Skip duplicates by stream URL
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#f5b83d]" /> Keep group-title as bouquet
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#f5b83d]" /> Auto-match EPG by name
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#f5b83d]" /> Run health check after import
              </label>
            </div>
            <Hint>Yeh prototype hai — import simulate hota hai. Asli app gateway se M3U fetch kar ke server par parse karega (browser mein nahi), 100k channels tak.</Hint>
            <div className="flex justify-end gap-2 pt-1">
              <Btn onClick={() => setImportOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={() => setStep(2)}><FileText size={14} /> Fetch & review</Btn>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Found', '2,460'], ['New', '2,418'], ['Duplicates', '42'], ['Groups', '31']].map(([a, b]) => (
                <div key={a} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-center">
                  <div className="num text-lg font-extrabold">{b}</div>
                  <div className="text-[10px] uppercase tracking-wider text-faint">{a}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-line">
              <div className="border-b border-line px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-faint">Preview · first 6</div>
              {CHANNELS.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0">
                  <CheckCircle2 size={13} className="text-emerald" />
                  <span className="flex-1 truncate text-xs">{c.name}</span>
                  <Badge tone="muted">{c.group}</Badge>
                  <Badge tone={c.premium ? 'gold' : 'muted'}>{c.quality}</Badge>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <Btn onClick={() => setStep(1)}>Back</Btn>
              <Btn variant="primary" onClick={runImport}>Import 2,418 channels</Btn>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="text-center">
              <div className="num text-3xl font-black gradient-text">{progress}%</div>
              <p className="text-xs text-faint">Writing shards · dedupe · EPG match</p>
            </div>
            <Progress value={progress} height={8} tone="#f5b83d" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Written', Math.round(2418 * progress / 100)], ['Skipped', Math.round(42 * progress / 100)], ['Groups', Math.min(31, Math.round(31 * progress / 100))], ['EPG hits', Math.round(2210 * progress / 100)]].map(([a, b]) => (
                <div key={a} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-center">
                  <div className="num text-sm font-extrabold">{b}</div>
                  <div className="text-[10px] uppercase tracking-wider text-faint">{a}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
