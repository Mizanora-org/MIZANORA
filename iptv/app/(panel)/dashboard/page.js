'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Tv, Activity, Wallet, CheckCircle2, ArrowUpRight, ArrowDownRight, Plus, Ticket, Banknote,
  AlertTriangle, Zap, Server, ChevronRight, Radio,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import { AreaChart, Spark, Ring, EQ, Bars } from '@/components/charts';
import { Btn, Badge, SectionHead, Progress, Toast } from '@/components/ui';
import {
  KPIS, VIEWERS_SERIES, REVENUE_SERIES, NODES, TOP_CHANNELS, ACTIVITY, PENDING_PAYMENTS, BRAND, fmt, rs,
} from '@/lib/data';

const ICONS = { tv: Tv, activity: Activity, wallet: Wallet, check: CheckCircle2 };
const TONES = { emerald: '#14b87a', gold: '#f5b83d', violet: '#a78bfa', info: '#4cc3ff' };

const RANGES = [
  { id: 'viewers', label: 'Viewers', data: VIEWERS_SERIES, color: '#14b87a', labels: ['00:00', '06:00', '12:00', '18:00', 'Now'], fmt: (v) => `${v} live` },
  { id: 'revenue', label: 'Revenue', data: REVENUE_SERIES.map((r) => r.v), color: '#f5b83d', labels: REVENUE_SERIES.filter((_, i) => i % 2 === 0).map((r) => r.m), fmt: (v) => rs(v) },
  { id: 'bandwidth', label: 'Bandwidth', data: VIEWERS_SERIES.map((v) => Math.round(v * 0.0042 * 100) / 100), color: '#4cc3ff', labels: ['00:00', '06:00', '12:00', '18:00', 'Now'], fmt: (v) => `${v} Gbps` },
];

export default function Dashboard() {
  const [range, setRange] = useState('viewers');
  const [toast, setToast] = useState('');
  const r = RANGES.find((x) => x.id === range);

  return (
    <div className="space-y-6">
      {/* alert ticker */}
      <Reveal>
        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-white/[0.03] px-3 py-2">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/12 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-red-200">
            <AlertTriangle size={11} /> Attention
          </span>
          <div className="marquee-mask flex-1 overflow-hidden">
            <div className="ticker gap-8 whitespace-nowrap text-[11px] text-dim">
              {[0, 1].map((k) => (
                <span key={k} className="flex gap-8">
                  <span>⚡ Frankfurt Edge 04 above 85% CPU — traffic shifted to Dubai</span>
                  <span>📡 HUM News offline (2/2 sources) — auto-standby playing</span>
                  <span>💸 4 resellers pending · window closes 10 {BRAND.cycle.month}</span>
                  <span>🧾 12 recharge videos re-rendered</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* header */}
      <Reveal delay={40}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Control room</h1>
            <p className="mt-1 text-sm text-dim">
              Sunday, 2 November 2026 · cycle <b className="text-cream">{BRAND.cycle.from}–{BRAND.cycle.to} {BRAND.cycle.month}</b> · {BRAND.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setToast('M3U importer ready — 0 channels yet')}><Plus size={15} /> Add channels</Btn>
            <Btn onClick={() => setToast('Trial line created (24h, 1 device)')}><Ticket size={15} /> Issue trial</Btn>
            <Btn variant="gold" onClick={() => setToast('Collection reminders sent on WhatsApp')}><Banknote size={15} /> Collect</Btn>
          </div>
        </div>
      </Reveal>

      {/* kpis */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k, i) => {
          const Icon = ICONS[k.icon];
          const tone = TONES[k.tone];
          const up = k.delta >= 0;
          return (
            <Reveal key={k.id} delay={80 + i * 60}>
              <div className="card group h-full">
                <div className="flex items-start justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${tone}1f`, color: tone }}>
                    <Icon size={16} />
                  </span>
                  <span className={`badge ${up ? 'b-live' : 'b-off'}`}>
                    {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(k.delta)}%
                  </span>
                </div>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-faint">{k.label}</div>
                <div className="num mt-0.5 text-2xl font-black">
                  <CountUp value={k.value} prefix={k.prefix || ''} suffix={k.suffix || ''} />
                </div>
                <div className="mt-1 text-[11px] text-faint">{k.hint}</div>
                <div className="-mx-1 mt-3 opacity-80">
                  <Spark data={VIEWERS_SERIES.slice(-14).map((v) => v + i * 40)} color={tone} height={38} />
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* chart + right rail */}
      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Reveal delay={120}>
          <div className="panel panel-pad h-full">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold"><Activity size={16} className="text-gold" /> Service pulse</h2>
                <p className="text-[11px] text-faint">Hourly rollup · updated 12s ago</p>
              </div>
              <div className="inline-flex rounded-xl border border-line bg-black/25 p-1">
                {RANGES.map((x) => (
                  <button key={x.id} onClick={() => setRange(x.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${range === x.id ? 'bg-white/10 text-cream' : 'text-dim hover:text-cream'}`}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            <AreaChart data={r.data} labels={r.labels} color={r.color} height={220} format={r.fmt} />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Peak today', '2,912', 'at 21:30'],
                ['Avg zap time', '0.9s', '+0.1s'],
                ['Buffer events', '0.42%', '−0.11%'],
                ['Streams healthy', '98.6%', '4 offline'],
              ].map(([a, b, c]) => (
                <div key={a} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-faint">{a}</div>
                  <div className="num text-sm font-extrabold">{b}</div>
                  <div className="text-[10px] text-faint">{c}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={160}>
            <div className="panel panel-pad">
              <SectionHead title="Collection 1–10" sub={`${BRAND.cycle.month} · JazzCash ${BRAND.jazzcash}`} />
              <div className="flex items-center gap-4">
                <Ring value={78} size={112} tone="#f5b83d" label="78%" sub="collected" />
                <div className="flex-1 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-dim">Target</span><b className="num">{rs(1286400)}</b></div>
                  <div className="flex justify-between"><span className="text-dim">Received</span><b className="num text-emeraldsoft">{rs(1002340)}</b></div>
                  <div className="flex justify-between"><span className="text-dim">Pending</span><b className="num text-goldsoft">{rs(284060)}</b></div>
                  <Progress value={78} tone="#f5b83d" />
                  <p className="text-[10px] text-faint">4 resellers · 8 days left</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="panel panel-pad">
              <SectionHead title="Edge nodes" sub="4 of 4 reporting" icon={Server} />
              <div className="space-y-2.5">
                {NODES.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.025] px-3 py-2">
                    <span className="text-base" aria-hidden>{n.flag === 'PK' ? '🇵🇰' : n.flag === 'AE' ? '🇦🇪' : '🇩🇪'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-xs">{n.name}</b>
                        <span className={`text-[10px] font-bold ${n.status === 'healthy' ? 'text-emeraldsoft' : 'text-goldsoft'}`}>{n.cpu}%</span>
                      </div>
                      <Progress value={n.cpu} height={4} tone={n.status === 'healthy' ? '#14b87a' : '#f5b83d'} className="mt-1.5" />
                      <div className="mt-1 flex justify-between text-[10px] text-faint">
                        <span>{fmt(n.conns)} conns</span><span>{n.bw}/{n.max} Gbps</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* bottom row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal delay={140}>
          <div className="panel panel-pad h-full">
            <SectionHead title="Top channels" sub="Last 24h · live viewers" actions={<Link href="/channels" className="text-[11px] font-bold text-gold">All <ChevronRight size={11} className="inline" /></Link>} />
            <div className="space-y-2.5">
              {TOP_CHANNELS.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="num w-4 text-[11px] font-bold text-faint">{i + 1}</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-black"
                    style={{ background: `linear-gradient(140deg,${c.tint[0]},${c.tint[1]})` }}>{c.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-xs">{c.name}</b>
                      <span className="num shrink-0 text-[11px] text-dim">{c.viewers}</span>
                    </div>
                    <Progress value={(c.viewers / 270) * 100} height={4} tone={c.tint[0]} className="mt-1.5" />
                  </div>
                  {c.premium && <Badge tone="gold">PRO</Badge>}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <div className="panel panel-pad h-full">
            <SectionHead title="Recent activity" sub="Everything that moved" />
            <ol className="relative ml-1 space-y-3 border-l border-line pl-4">
              {ACTIVITY.slice(0, 6).map((a, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[22px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-[#04100a] ${a.kind === 'alert' ? 'bg-red-400' : a.kind === 'pay' ? 'bg-emerald' : 'bg-gold'}`} />
                  <p className="text-[11px] leading-snug text-cream/90">{a.text}</p>
                  <p className="text-[10px] text-faint">{a.t} ago · {a.meta}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <div className="panel panel-pad h-full">
            <SectionHead title="Payments to approve" sub="WhatsApp proof received" actions={<Badge tone="gold" dot>{PENDING_PAYMENTS.length}</Badge>} />
            <div className="space-y-2">
              {PENDING_PAYMENTS.map((p) => (
                <div key={p.id} className="rounded-xl border border-line bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className="block text-xs">{p.reseller}</b>
                      <span className="text-[10px] text-faint">{p.method} · {p.txn} · {p.at}</span>
                    </div>
                    <b className="num text-sm text-emeraldsoft">{rs(p.amount)}</b>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Btn size="sm" variant="primary" className="flex-1" onClick={() => setToast(`${p.reseller} marked paid — account restored`)}>Approve</Btn>
                    <Btn size="sm" className="flex-1" onClick={() => setToast('Asked for a clearer screenshot')}>Ask proof</Btn>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/billing" className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-line py-2 text-[11px] font-bold text-dim hover:text-gold">
              Open billing <ChevronRight size={12} />
            </Link>
          </div>
        </Reveal>
      </div>

      {/* live strip */}
      <Reveal delay={240}>
        <div className="panel panel-pad relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald/10 blur-3xl" />
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2"><Radio size={15} className="text-emerald" /><b className="text-sm">Live right now</b><EQ bars={4} color="#14b87a" /></span>
            <span className="text-[11px] text-dim">1,842 viewers across 2,140 unique devices</span>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
              {[['🇵🇰 Pakistan', 68], ['🇦🇪 UAE', 14], ['🇸🇦 KSA', 9], ['🌍 Other', 9]].map(([n, v]) => (
                <span key={n} className="rounded-full border border-line bg-white/[0.04] px-2.5 py-1">{n} <b className="num">{v}%</b></span>
              ))}
              <Link href="/watch" className="btn btn-sm btn-gold"><Zap size={12} /> Player preview</Link>
            </div>
          </div>
        </div>
      </Reveal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
