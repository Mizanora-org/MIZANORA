'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, SkipForward, RotateCcw, Crown, WifiOff, RefreshCw,
  Search, ChevronLeft, ChevronRight, Radio, Star, Info, MessageCircle, ShieldCheck,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Badge, Btn, Toast } from '@/components/ui';
import { EQ } from '@/components/charts';
import { CHANNELS, BRAND } from '@/lib/data';

const STATES = [
  { id: 'normal', label: 'Live' },
  { id: 'intro', label: 'Intro' },
  { id: 'premium', label: 'Premium lock' },
  { id: 'offline', label: 'Offline' },
  { id: 'recharge', label: 'Recharge' },
];

export default function WatchPage() {
  const [state, setState] = useState('normal');
  const [channel, setChannel] = useState(CHANNELS[2]);
  const [q, setQ] = useState('');
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [count, setCount] = useState(4);
  const [toast, setToast] = useState('');

  // Intro counts down by itself, then the channel starts.
  useEffect(() => {
    if (state !== 'intro') { setCount(4); return; }
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) { clearInterval(t); setState('normal'); return 4; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  const guide = useMemo(
    () => CHANNELS.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 22),
    [q],
  );

  const pick = (c) => { setChannel(c); setState('intro'); };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Player preview</h1>
            <p className="mt-1 text-sm text-dim">What the subscriber sees — intro, premium, offline and recharge states.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATES.map((s) => (
              <button key={s.id} onClick={() => setState(s.id)}
                className={`chip ${state === s.id ? 'active' : ''}`}>{s.label}</button>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        {/* ---------------------------------------------------------- player */}
        <Reveal delay={60}>
          <div className="overflow-hidden rounded-[24px] border border-gold/20"
            style={{
              background: 'radial-gradient(circle at 8% 0%,rgba(13,139,88,.22),transparent 34%),radial-gradient(circle at 100% 0%,rgba(245,184,61,.12),transparent 30%),linear-gradient(155deg,#071711,#06130e 48%,#030905)',
              boxShadow: '0 34px 90px -38px rgba(1,18,10,.95)',
            }}>
            {/* top bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/25 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-goldsoft to-gold text-[#071711]">
                <Radio size={16} />
              </span>
              <div className="min-w-0">
                <b className="block text-xs font-black tracking-[0.14em]">MIZANORA</b>
                <small className="text-[9px] font-bold tracking-[0.22em] text-gold">LIVE TV</small>
              </div>
              <div className="mx-1 h-8 w-px bg-white/10" />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{channel.name}</b>
                <small className="text-[10px] text-white/50">{channel.group} · {channel.quality} · {channel.country}</small>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-wider ${state === 'offline' ? 'border-red-400/40 bg-red-500/15 text-red-200' : 'border-emerald/40 bg-emerald/15 text-emeraldsoft'}`}>
                  <i className={`h-1.5 w-1.5 rounded-full ${state === 'offline' ? 'bg-red-400' : 'bg-emerald'}`} />
                  {state === 'offline' ? 'NO SIGNAL' : state === 'premium' ? 'LOCKED' : 'LIVE'}
                </span>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-black text-white/70">{channel.quality}</span>
                <span className="hidden rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-black text-white/70 sm:block">{channel.viewers} watching</span>
              </div>
            </div>

            {/* screen */}
            <div className="relative">
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                {/* fake video */}
                <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 30%,${channel.tint[0]}55,transparent 55%), radial-gradient(circle at 75% 70%,${channel.tint[1]}88,transparent 60%), linear-gradient(160deg,#06140e,#020806)` }} />
                <div className="absolute inset-0 grid-bg opacity-15" />
                {state === 'normal' && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center opacity-90">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-lg font-black"
                        style={{ background: `linear-gradient(140deg,${channel.tint[0]},${channel.tint[1]})` }}>
                        {channel.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="mt-3 text-sm font-black tracking-wide">{channel.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">live broadcast</p>
                    </div>
                  </div>
                )}

                {/* ---- overlays ---- */}
                {state === 'intro' && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-[#03100a]/85 backdrop-blur-[2px]">
                    <div className="pop-in text-center">
                      <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-goldsoft to-gold text-[#241a00] float"
                        style={{ boxShadow: '0 24px 60px -24px rgba(245,184,61,.9)' }}>
                        <Star size={30} />
                      </div>
                      <p className="mt-4 text-2xl font-black tracking-[0.16em]">MIZANORA</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gold">broadcast network</p>
                      <div className="mx-auto mt-4 h-1 w-44 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-gold transition-all duration-1000" style={{ width: `${((4 - count) / 4) * 100}%` }} />
                      </div>
                      <p className="mt-2 text-[10px] text-white/45">Starting in {count}s</p>
                      <button onClick={() => setState('normal')} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold">
                        Skip intro <SkipForward size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {state === 'premium' && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-[#03100a]/88 px-5 text-center backdrop-blur-[2px]">
                    <div className="pop-in max-w-sm">
                      <Crown size={30} className="mx-auto text-gold float" />
                      <p className="mt-2 text-lg font-black">Premium channel</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                        Yeh channel aap ke <b className="text-white/80">{channel.name}</b> plan mein shamil nahi. Family ya VIP 4K mein unlock karein.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-1.5 text-left text-[10px]">
                        {[['Family', 'Rs 350', true], ['VIP 4K', 'Rs 900', true], ['Basic', 'Rs 200', false], ['Sports', 'Rs 500', false]].map(([n, p, ok]) => (
                          <div key={n} className={`rounded-lg border px-2 py-1.5 ${ok ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-white/5'}`}>
                            <b className="block">{n}</b><span className="text-white/50">{p}/mo</span>
                          </div>
                        ))}
                      </div>
                      <a href={`https://wa.me/92${BRAND.jazzcash.replace(/\D/g, '').slice(1)}`} target="_blank" rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-[11px] font-extrabold text-[#04210f]">
                        <MessageCircle size={12} /> WhatsApp {BRAND.jazzcash}
                      </a>
                    </div>
                  </div>
                )}

                {state === 'offline' && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-[#03100a]/90 px-5 text-center">
                    <div className="pop-in">
                      <WifiOff size={30} className="mx-auto text-info float" />
                      <p className="mt-2 text-base font-black">Signal restore ho raha hai</p>
                      <p className="mt-1 text-[11px] text-white/55">Broadcast standby active · source {channel.sources}/{channel.sources} failing</p>
                      <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-1/2 rounded-full bg-info shimmer" />
                      </div>
                      <button onClick={() => { setToast('Retrying backup sources…'); setTimeout(() => setState('normal'), 900); }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold">
                        <RotateCcw size={12} /> Retry now
                      </button>
                    </div>
                  </div>
                )}

                {state === 'recharge' && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-gradient-to-b from-[#3a0d14]/85 to-[#03100a]/95 px-5 text-center">
                    <div className="pop-in max-w-sm">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-200 spin-slow" style={{ animationDuration: '9s' }}>
                        <RefreshCw size={22} />
                      </div>
                      <p className="mt-2 text-base font-black">Recharge required</p>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-gold">Barakat Vision · Lahore</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-goldsoft num">{BRAND.jazzcash}</p>
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[9px]">
                        {['JazzCash', 'Easypaisa', 'Bank / Raast'].map((m) => <span key={m} className="rounded-full bg-white/10 px-2 py-0.5">{m}</span>)}
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2 rounded-full bg-black/40 px-3 py-1.5">
                        <EQ bars={4} color="#f5b83d" />
                        <span className="text-[10px] text-white/70">🔊 “Recharge ke liye {BRAND.jazzcash} par rabta karein”</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ad strip */}
                {state === 'normal' && (
                  <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-2.5 py-1.5 backdrop-blur">
                    <span className="rounded bg-gold px-1.5 py-0.5 text-[8px] font-black text-[#241a00]">AD</span>
                    <span className="text-[10px] text-white/75">Mizanora winter jackets — 40% off</span>
                    <span className="text-[9px] text-gold">Shop →</span>
                  </div>
                )}
              </div>

              {/* controls */}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/35 px-3 py-2.5">
                <button onClick={() => setPlaying((p) => !p)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Play">
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button onClick={() => setMuted((m) => !m)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Mute">
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <div className="mx-1 h-1 w-24 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-full bg-red-500/80" />
                </div>
                <span className="flex items-center gap-1 text-[9px] font-black tracking-wider text-red-300"><i className="h-1.5 w-1.5 rounded-full bg-red-400" /> LIVE</span>
                <span className="ml-2 hidden text-[10px] text-white/45 sm:block">Next: Prime Time News · 21:00</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Guide"><ChevronLeft size={14} /></button>
                  <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Guide"><ChevronRight size={14} /></button>
                  <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold">Auto</span>
                  <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Fullscreen"><Maximize size={14} /></button>
                </div>
              </div>
            </div>

            {/* EPG strip */}
            <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-[11px]">
              <Info size={13} className="shrink-0 text-gold" />
              <span className="truncate text-white/60"><b className="text-white/85">Now:</b> {channel.group} live coverage</span>
              <span className="ml-auto hidden shrink-0 items-center gap-1 text-[9px] text-white/35 sm:flex">
                <ShieldCheck size={11} /> signed token · expires in 42s
              </span>
            </div>
          </div>
        </Reveal>

        {/* ----------------------------------------------------------- guide */}
        <Reveal delay={110}>
          <div className="panel flex h-full flex-col overflow-hidden">
            <div className="border-b border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-extrabold">Channel guide</h2>
                <Badge tone="live" dot>2.4k</Badge>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} className="input py-2 pl-8 text-xs" placeholder="Search channels…" />
              </div>
              <div className="mt-2 flex gap-1">
                {['All', 'Fav', 'Recent'].map((t, i) => (
                  <span key={t} className={`chip ${i === 0 ? 'active' : ''} text-[10px]`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="max-h-[520px] flex-1 overflow-y-auto scroll-thin p-2">
              {guide.map((c) => (
                <button key={c.id} onClick={() => pick(c)}
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition ${c.id === channel.id ? 'bg-white/10 ring-1 ring-inset ring-gold/30' : 'hover:bg-white/5'}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black"
                    style={{ background: `linear-gradient(140deg,${c.tint[0]},${c.tint[1]})` }}>{c.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[11px]">{c.name}</b>
                    <small className="text-[9px] text-faint">{c.group} · {c.quality}</small>
                  </span>
                  {c.premium && <Crown size={11} className="shrink-0 text-gold" />}
                  {c.id === channel.id && <span className="shrink-0"><EQ bars={3} color="#14b87a" /></span>}
                </button>
              ))}
            </div>
            <div className="border-t border-line p-3">
              <p className="text-[10px] leading-relaxed text-faint">
                Tap a channel → intro plays → live stream. Premium channel par lock video, dead source par standby.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={150}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Intro', '4s · skip after 2s', '#f5b83d'],
            ['Premium', 'plan check at gateway', '#a78bfa'],
            ['Offline', 'health state from Redis', '#4cc3ff'],
            ['Recharge', 'reseller number + voice', '#ff7a8a'],
          ].map(([a, b, c]) => (
            <div key={a} className="panel panel-pad">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c }} /><b className="text-xs">{a}</b></div>
              <p className="mt-1 text-[10px] text-faint">{b}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
