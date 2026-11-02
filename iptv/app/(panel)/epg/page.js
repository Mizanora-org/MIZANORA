'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, RefreshCw, CheckCircle2, Clock3, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Toast, SectionHead, Progress, Hint } from '@/components/ui';
import { EPG } from '@/lib/data';

const GENRE = {
  news: '#f5b83d', drama: '#a78bfa', sports: '#14b87a', islamic: '#34d399',
  movie: '#ff7a8a', talk: '#4cc3ff', kids: '#ffb84d', doc: '#7dd3fc', comedy: '#f472b6',
};

const SOURCES = [
  { id: 's1', name: 'iptv-org / epg', channels: 412, refresh: '6h', health: 98 },
  { id: 's2', name: 'Broadcaster feeds', channels: 96, refresh: '3h', health: 92 },
  { id: 's3', name: 'epg.pw (PK bundle)', channels: 210, refresh: '12h', health: 88 },
  { id: 's4', name: 'Manual / dummy', channels: 34, refresh: '—', health: 100 },
];

const PPX = 3.4;           // px per minute
const START_H = 6;         // guide starts 06:00
const HOURS = Array.from({ length: 19 }, (_, i) => START_H + i); // 06 → 24

export default function EpgPage() {
  const [toast, setToast] = useState('');
  const [day, setDay] = useState('today');
  const [nowMin, setNowMin] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pkt = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
      setNowMin(pkt.getHours() * 60 + pkt.getMinutes());
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // scroll near the current time on first paint
    if (scrollRef.current && nowMin != null) {
      const x = Math.max(0, (nowMin - START_H * 60 - 60) * PPX);
      scrollRef.current.scrollLeft = x;
    }
  }, [nowMin]);

  const totalW = HOURS.length * 60 * PPX;
  const nowX = nowMin == null ? 0 : (nowMin - START_H * 60) * PPX;

  const coverage = useMemo(() => Math.round((EPG.filter((c) => c.programs.length).length / EPG.length) * 100), []);

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">EPG guide</h1>
            <p className="mt-1 text-sm text-dim">Every channel covered · 7-day window · multi-source with primary + backup IDs.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-line bg-black/25 p-1">
              {['today', 'tomorrow'].map((d) => (
                <button key={d} onClick={() => setDay(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${day === d ? 'bg-white/10 text-cream' : 'text-dim hover:text-cream'}`}>{d}</button>
              ))}
            </div>
            <Btn onClick={() => setToast('EPG refresh queued — 752 channels updated')}><RefreshCw size={14} /> Refresh now</Btn>
            <Btn variant="gold" onClick={() => setToast('Mapper opened — 12 unmatched channels')}><Filter size={14} /> Map channels</Btn>
          </div>
        </div>
      </Reveal>

      {/* coverage strip */}
      <Reveal delay={50}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel panel-pad flex items-center gap-4">
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-emerald/12">
              <CalendarRange size={24} className="text-emerald" />
            </div>
            <div>
              <div className="num text-2xl font-black">{coverage}%</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">Channels with EPG</div>
              <Progress value={coverage} height={4} className="mt-1.5 w-24" />
            </div>
          </div>
          {SOURCES.slice(0, 3).map((s) => (
            <div key={s.id} className="panel panel-pad">
              <div className="flex items-center justify-between">
                <b className="truncate text-xs">{s.name}</b>
                <Badge tone="live" dot>ok</Badge>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="num text-lg font-extrabold">{s.channels}</div>
                  <div className="text-[10px] uppercase tracking-wider text-faint">channels</div>
                </div>
                <div className="text-right text-[10px] text-faint">refresh {s.refresh}<br />health {s.health}%</div>
              </div>
              <Progress value={s.health} height={4} tone="#4cc3ff" className="mt-2" />
            </div>
          ))}
        </div>
      </Reveal>

      {/* guide */}
      <Reveal delay={90}>
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11px] text-faint">
              <Clock3 size={13} className="text-gold" />
              <span>Now line follows Pakistan time</span>
              <span className="hidden items-center gap-1 sm:flex"><CheckCircle2 size={12} className="text-emerald" /> auto-mapped by name + logo</span>
            </div>
            <div className="flex gap-1">
              <Btn size="sm" variant="ghost" onClick={() => scrollRef.current?.scrollBy({ left: -600, behavior: 'smooth' })}><ChevronLeft size={13} /></Btn>
              <Btn size="sm" variant="ghost" onClick={() => scrollRef.current?.scrollBy({ left: 600, behavior: 'smooth' })}><ChevronRight size={13} /></Btn>
            </div>
          </div>

          <div ref={scrollRef} className="overflow-x-auto scroll-thin">
            <div style={{ width: totalW + 168 }} className="min-w-full">
              {/* hour ruler */}
              <div className="sticky top-0 z-20 flex border-b border-line bg-[#071410]/95 backdrop-blur">
                <div className="sticky left-0 z-30 w-[168px] shrink-0 border-r border-line bg-[#071410] px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-faint">
                  Channel
                </div>
                <div className="relative flex" style={{ width: totalW }}>
                  {HOURS.map((h) => (
                    <div key={h} className="shrink-0 border-r border-white/5 px-1.5 py-2 text-[10px] font-bold text-faint" style={{ width: 60 * PPX }}>
                      {String(h % 24).padStart(2, '0')}:00
                    </div>
                  ))}
                  {nowMin != null && nowMin > START_H * 60 && nowX < totalW && (
                    <div className="absolute top-0 h-full w-px bg-gold" style={{ left: nowX }}>
                      <span className="absolute -left-4 -top-0.5 rounded bg-gold px-1 py-0.5 text-[9px] font-black text-[#241a00]">NOW</span>
                    </div>
                  )}
                </div>
              </div>

              {/* rows */}
              {EPG.map((ch) => (
                <div key={ch.id} className="flex border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <div className="sticky left-0 z-10 flex w-[168px] shrink-0 items-center gap-2 border-r border-line bg-[#06120c] px-3 py-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[9px] font-black"
                      style={{ background: `linear-gradient(140deg,${ch.tint[0]},${ch.tint[1]})` }}>{ch.name.slice(0, 2).toUpperCase()}</span>
                    <span className="truncate text-[11px] font-bold">{ch.name}</span>
                  </div>
                  <div className="relative flex h-[46px]" style={{ width: totalW }}>
                    {ch.programs.map((p) => {
                      const past = nowMin != null && p.end < nowMin;
                      const live = nowMin != null && p.start <= nowMin && p.end > nowMin;
                      const w = (p.end - p.start) * PPX;
                      return (
                        <button key={p.id}
                          onClick={() => setToast(`${ch.name} · ${p.title}`)}
                          className={`group relative shrink-0 overflow-hidden border-r border-[#04100a]/70 px-2 py-1 text-left transition hover:brightness-125 ${live ? 'ring-1 ring-inset ring-gold/60' : ''}`}
                          style={{
                            width: w,
                            background: live
                              ? `linear-gradient(180deg,${GENRE[p.genre]}44,${GENRE[p.genre]}18)`
                              : past ? 'rgba(255,255,255,.025)' : `linear-gradient(180deg,${GENRE[p.genre]}22,${GENRE[p.genre]}0d)`,
                          }}>
                          <span className="block truncate text-[11px] font-bold" style={{ color: live ? '#ffe2a4' : 'rgba(242,247,243,.88)' }}>{p.title}</span>
                          <span className="num block truncate text-[9px] text-faint">
                            {fmtTime(p.start)}–{fmtTime(p.end)} {live && '· LIVE'} {past && '· catch-up'}
                          </span>
                          <i className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: GENRE[p.genre], opacity: live ? 1 : 0.45 }} />
                        </button>
                      );
                    })}
                    {nowMin != null && nowX < totalW && nowX > 0 && (
                      <div className="pointer-events-none absolute inset-y-0 w-px bg-gold/70" style={{ left: nowX }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-[10px] text-faint">
            {Object.entries(GENRE).slice(0, 6).map(([g, c]) => (
              <span key={g} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: c }} />{g}</span>
            ))}
            <span className="ml-auto">7-day XMLTV stored · gzip served</span>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Reveal delay={120}>
          <div className="panel panel-pad">
            <SectionHead title="Unmatched channels" sub="Auto-match failed — map them by hand once" actions={<Badge tone="gold">12</Badge>} />
            <div className="space-y-2">
              {['HUM News', 'A Sports', 'Pogo', 'Sindh TV', 'Khyber TV', 'Nickelodeon'].map((n) => (
                <div key={n} className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2">
                  <span className="flex-1 truncate text-xs font-semibold">{n}</span>
                  <span className="text-[10px] text-faint">no guide data</span>
                  <Btn size="sm" variant="ghost" onClick={() => setToast(`${n} mapped to a guide channel`)}>Map</Btn>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="panel panel-pad">
            <SectionHead title="How coverage is guaranteed" sub="The rules that keep the grid full" />
            <ul className="space-y-2 text-[11px] leading-relaxed text-dim">
              {[
                'Primary EPG ID + backup ID — agar ek source stale ho to doosra chalta hai.',
                'Per-channel timeshift (± minutes) — PKT aur galat timezone wale feeds fix.',
                'Dummy schedule fallback — guide kabhi khaali nahi dikhti.',
                'Har 6 ghante refresh, compressed XMLTV, cache in Redis.',
                'Xtream (xmltv.php), Stalker (embedded), M3U (tvg-id) — sab par same guide.',
              ].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald" />{t}</li>
              ))}
            </ul>
            <Hint>Stalker/MAG boxes EPG portal se hi lete hain — is liye wahan bhi wohi grid dikhega.</Hint>
          </div>
        </Reveal>
      </div>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}

function fmtTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}
