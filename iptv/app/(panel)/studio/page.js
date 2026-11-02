'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Clapperboard, Upload, Play, Repeat, Volume2, Pencil, Megaphone, Sparkles, ExternalLink,
  MousePointerClick, Eye, Crown, WifiOff, RefreshCw, Film,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Toast, Toggle, SectionHead, Progress, Modal, Hint } from '@/components/ui';
import { EQ } from '@/components/charts';
import { ASSETS, ADS, CHANNELS } from '@/lib/data';

const KIND_ICON = { intro: Sparkles, premium: Crown, offline: WifiOff, recharge: RefreshCw };
const KIND_LABEL = { intro: 'Before every channel', premium: 'Locked premium feed', offline: 'Source is down', recharge: 'Balance / expiry' };

export default function StudioPage() {
  const [toast, setToast] = useState('');
  const [active, setActive] = useState('recharge');
  const [adOpen, setAdOpen] = useState(false);
  const [ads, setAds] = useState(ADS);
  const asset = ASSETS.find((a) => a.id === active);

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Videos & ads</h1>
            <p className="mt-1 text-sm text-dim">Intro, premium, offline and per-reseller recharge clips — plus ad slots on any channel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setToast('Uploaded — encoding HLS ladder')}><Upload size={15} /> Upload clip</Btn>
            <Btn variant="gold" onClick={() => setAdOpen(true)}><Megaphone size={15} /> New ad campaign</Btn>
          </div>
        </div>
      </Reveal>

      {/* asset cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ASSETS.map((a, i) => {
          const Icon = KIND_ICON[a.kind];
          const on = active === a.id;
          return (
            <Reveal key={a.id} delay={i * 50}>
              <button onClick={() => setActive(a.id)}
                className={`card w-full text-left ${on ? 'border-gold/60 bg-white/[0.06]' : ''}`}>
                <div className="relative mb-3 aspect-video overflow-hidden rounded-xl"
                  style={{ background: `linear-gradient(150deg,${a.tone}44,${a.tone}11 55%,#04100a)` }}>
                  <div className="absolute inset-0 grid-bg opacity-25" />
                  <div className="absolute inset-0 scan" />
                  <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-black tracking-wider">{a.dur}</span>
                  {a.loop && <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold"><Repeat size={9} /> loop</span>}
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur" style={{ color: a.tone }}>
                      <Icon size={17} />
                    </span>
                  </div>
                  <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
                    <EQ bars={5} color={a.tone} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">voice + music</span>
                  </div>
                </div>
                <b className="block text-sm">{a.name}</b>
                <span className="text-[10px] text-faint">{KIND_LABEL[a.kind]} · {a.size}</span>
              </button>
            </Reveal>
          );
        })}
      </div>

      {/* selected asset detail + preview */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Reveal delay={90}>
          <div className="panel panel-pad">
            <SectionHead title={asset.name} sub={KIND_LABEL[asset.kind]} actions={<Badge tone="gold" dot>active</Badge>} />
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-line"
              style={{ background: `radial-gradient(circle at 30% 20%,${asset.tone}33,transparent 55%), linear-gradient(150deg,#071a12,#030c08)` }}>
              <div className="absolute inset-0 grid-bg opacity-20" />
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                {asset.kind === 'intro' && (
                  <div className="pop-in">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-goldsoft to-gold text-[#241a00] shadow-goldglow float">
                      <Sparkles size={26} />
                    </div>
                    <p className="mt-3 text-lg font-black tracking-tight">MIZANORA</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold">Broadcast network</p>
                    <p className="mt-3 text-[10px] text-faint">4 second ident · skip after 2s</p>
                  </div>
                )}
                {asset.kind === 'premium' && (
                  <div className="pop-in">
                    <Crown size={30} className="mx-auto text-gold float" />
                    <p className="mt-2 text-base font-black">Premium channel</p>
                    <p className="mt-1 text-[11px] text-dim">Is plan mein shamil nahi · upgrade karein</p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-[11px] font-extrabold text-[#04210f]">
                      <Volume2 size={11} /> WhatsApp 0306-2015326
                    </span>
                  </div>
                )}
                {asset.kind === 'offline' && (
                  <div className="pop-in">
                    <WifiOff size={30} className="mx-auto text-info float" />
                    <p className="mt-2 text-base font-black">Signal restore ho raha hai</p>
                    <p className="mt-1 text-[11px] text-dim">Signal Restoring — Broadcast Standby Active</p>
                    <div className="mx-auto mt-3 h-1 w-32 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-1/2 rounded-full bg-info shimmer" />
                    </div>
                  </div>
                )}
                {asset.kind === 'recharge' && (
                  <div className="pop-in">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#9df3cd] to-emerald text-[#04170e] float">
                      <RefreshCw size={20} />
                    </div>
                    <p className="mt-2 text-base font-black">Recharge required</p>
                    <p className="text-[11px] text-dim">Barakat Vision · 0306-2015326</p>
                    <div className="mt-2 flex justify-center gap-1.5 text-[9px]">
                      {['JazzCash', 'Easypaisa', 'Bank'].map((m) => <span key={m} className="rounded bg-white/10 px-1.5 py-0.5">{m}</span>)}
                    </div>
                    <p className="mt-2 text-[10px] text-goldsoft">🔊 Voice: “Recharge ke liye 0306-2015326 par rabta karein”</p>
                  </div>
                )}
              </div>
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-black/40 px-2 py-1.5 backdrop-blur">
                <Play size={11} className="text-gold" />
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full w-1/3 rounded-full bg-gold" /></div>
                <span className="num text-[9px] text-faint">00:04 / {asset.dur}</span>
                <Volume2 size={11} className="text-faint" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => setToast('Replace clip — upload opened')}><Upload size={14} /> Replace</Btn>
              <Btn onClick={() => setToast('Text overlay editor opened')}><Pencil size={14} /> Edit overlay</Btn>
              <Link href="/watch" className="btn btn-gold"><ExternalLink size={14} /> See in player</Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={130}>
          <div className="panel panel-pad">
            <SectionHead title="Where it plays" sub="Trigger rules" />
            <div className="space-y-2 text-[11px]">
              {[
                ['Intro', 'Har channel open hone se pehle — 1 dafa per session', '#f5b83d'],
                ['Premium', 'Jab channel user ke bouquet mein nahi hai', '#a78bfa'],
                ['Offline', 'Health check fail + backup sources khatam', '#4cc3ff'],
                ['Recharge', 'Line expire, ya reseller ka balance zero (11–12 tareekh)', '#ff7a8a'],
              ].map(([a, b, c]) => (
                <div key={a} className="flex gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                  <div><b className="block">{a}</b><span className="text-faint">{b}</span></div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              <Toggle label="Skip intro after 2s" hint="Viewer ne pehle dekh li ho to skip" checked onChange={() => {}} />
              <Toggle label="Recharge voice announcement" hint="Per-reseller TTS, cached" checked onChange={() => {}} />
            </div>
            <Hint>Clips CDN par HLS mein rehte hain; gateway sirf decide karta hai kaunsa playlist bhejna hai — is liye Stalker/MAG par bhi chalta hai.</Hint>
          </div>
        </Reveal>
      </div>

      {/* ads */}
      <Reveal delay={160}>
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-extrabold"><Megaphone size={15} className="text-gold" /> Ad campaigns</h2>
              <p className="text-[10px] text-faint">Mizanora products + reseller ads · frequency capped</p>
            </div>
            <div className="flex gap-1.5">
              <Badge tone="live" dot>{ads.filter((a) => a.live).length} live</Badge>
              <Badge tone="muted">{ads.length} total</Badge>
            </div>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="tbl">
              <thead><tr><th>Campaign</th><th>Format</th><th>Slots</th><th>Views</th><th>CTR</th><th>Live</th><th /></tr></thead>
              <tbody>
                {ads.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${a.tone}22`, color: a.tone }}><Film size={14} /></span>
                        <b className="text-xs">{a.name}</b>
                      </div>
                    </td>
                    <td className="text-[11px] text-dim">{a.type}</td>
                    <td className="text-[11px] text-dim">{a.slots}</td>
                    <td><span className="inline-flex items-center gap-1 text-[11px]"><Eye size={11} className="text-faint" />{a.views}</span></td>
                    <td><span className="inline-flex items-center gap-1 text-[11px]"><MousePointerClick size={11} className="text-faint" />{a.ctr}%</span></td>
                    <td>
                      <button onClick={() => setAds((prev) => prev.map((x) => x.id === a.id ? { ...x, live: !x.live } : x))}
                        className={`relative h-5 w-9 rounded-full transition ${a.live ? 'bg-emerald' : 'bg-white/15'}`} aria-label={`Toggle ${a.name}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${a.live ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </td>
                    <td className="text-right"><Btn size="sm" variant="ghost" onClick={() => setToast('Campaign editor opened')}>Edit</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Modal open={adOpen} onClose={() => setAdOpen(false)} title="New ad campaign" sub="Pick a Mizanora product, choose the slots, set the frequency cap." wide>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Campaign name" defaultValue="Winter jackets" />
            <select className="input"><option className="bg-[#071410]">Mizanora product</option><option className="bg-[#071410]">Reseller ad</option><option className="bg-[#071410]">External banner</option></select>
            <select className="input"><option className="bg-[#071410]">Pre-roll · before channel</option><option className="bg-[#071410]">Mid-roll · channel switch</option><option className="bg-[#071410]">EPG banner</option><option className="bg-[#071410]">Corner QR overlay</option><option className="bg-[#071410]">Pause overlay</option></select>
            <select className="input"><option className="bg-[#071410]">All bouquets</option><option className="bg-[#071410]">Basic</option><option className="bg-[#071410]">Family</option><option className="bg-[#071410]">VIP 4K</option></select>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-faint">Channels</p>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto scroll-thin">
              {CHANNELS.slice(0, 14).map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2 py-1 text-[10px]">
                  <input type="checkbox" className="h-3 w-3 accent-[#f5b83d]" defaultChecked={c.group === 'Sports'} />{c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Frequency cap" defaultValue="1 per 3 channel switches" />
            <input className="input" placeholder="Schedule" defaultValue="15 Nov – 30 Nov, 18:00–24:00" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setAdOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={() => { setAdOpen(false); setToast('Campaign created — paused until approved'); }}>Create campaign</Btn>
          </div>
        </div>
      </Modal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
