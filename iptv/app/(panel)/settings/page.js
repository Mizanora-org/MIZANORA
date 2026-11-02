'use client';
import { useState } from 'react';
import {
  SlidersHorizontal, Wallet, ShieldCheck, MessageCircle, Tv, Save, Plus, Trash2, Lock,
  Globe2, Fingerprint, ScanEye, Smartphone, Palette,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Toast, Toggle, SectionHead, Hint, Progress } from '@/components/ui';
import { BOUQUETS, BRAND, rs } from '@/lib/data';

export default function SettingsPage() {
  const [fee, setFee] = useState(BRAND.fee.reseller);
  const [wholesale, setWholesale] = useState(BRAND.wholesale);
  const [cap, setCap] = useState(BRAND.retailCap);
  const [toast, setToast] = useState('');
  const [sec, setSec] = useState({ twofa: true, device: true, isp: true, watermark: true, vpn: true, token: true });
  const [wa, setWa] = useState({ otp: true, invoice: true, receipt: true, expiry: true, suspend: true });

  const adminShare = BRAND.fee.total - fee;

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Settings</h1>
            <p className="mt-1 text-sm text-dim">Money rules, plans, payments, WhatsApp and security — one place.</p>
          </div>
          <Btn variant="gold" onClick={() => setToast('Settings saved')}><Save size={15} /> Save changes</Btn>
        </div>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* pricing */}
        <Reveal delay={50}>
          <div className="panel panel-pad">
            <SectionHead title="Connection fee split" sub={`Rs ${BRAND.fee.total} one-time · first month included`} icon={Wallet} />
            <div className="rounded-2xl border border-line bg-black/25 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-faint">Reseller keeps</p>
                  <p className="num text-3xl font-black text-emeraldsoft">Rs {fee}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-faint">Admin share</p>
                  <p className="num text-3xl font-black text-goldsoft">Rs {adminShare}</p>
                </div>
              </div>
              <input type="range" min={0} max={50} step={5} value={fee} onChange={(e) => setFee(Number(e.target.value))}
                className="mt-3 w-full accent-[#f5b83d]" aria-label="Reseller share of the connection fee" />
              <div className="mt-1 flex h-2.5 overflow-hidden rounded-full">
                <span className="bg-emerald transition-all" style={{ width: `${(fee / 50) * 100}%` }} />
                <span className="bg-gold transition-all" style={{ width: `${(adminShare / 50) * 100}%` }} />
              </div>
              <p className="mt-2 text-[10px] text-faint">Recommended: Rs 30 reseller / Rs 20 admin.</p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-faint">Wholesale / connection / month</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint">Rs</span>
                  <input value={wholesale} onChange={(e) => setWholesale(Number(e.target.value) || 0)} className="input pl-8" inputMode="numeric" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-faint">Retail price cap (reseller)</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint">Rs</span>
                  <input value={cap} onChange={(e) => setCap(Number(e.target.value) || 0)} className="input pl-8" inputMode="numeric" />
                </div>
              </label>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[11px]">
              Reseller margin per client: <b className="text-emeraldsoft">{rs(cap - wholesale)}</b> / month
              <span className="text-faint"> · reseller is se zyada charge nahi kar sakta</span>
            </div>
            <Hint>Pehla month fee mein shamil — admin ko sirf Rs {adminShare} milta hai, reseller ko Rs {fee}.</Hint>
          </div>
        </Reveal>

        {/* plans */}
        <Reveal delay={80}>
          <div className="panel panel-pad">
            <SectionHead title="Plans & bouquets" sub="Cap enforced inside the reseller panel" icon={Tv}
              actions={<Btn size="sm" variant="ghost" onClick={() => setToast('New plan draft created')}><Plus size={12} /> Add</Btn>} />
            <div className="space-y-2">
              {BOUQUETS.map((b) => (
                <div key={b.id} className="rounded-xl border border-line bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black" style={{ background: `${b.color}22`, color: b.color }}>
                      {b.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-xs">{b.name}</b>
                      <span className="text-[10px] text-faint">{b.channels.toLocaleString()} channels · {b.vod.toLocaleString()} VOD · {b.devices} device{b.devices > 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-right">
                      <div className="num text-xs font-extrabold">{rs(b.price)}</div>
                      <div className="text-[9px] text-faint">cap {rs(b.cap)}</div>
                    </div>
                    <button className="btn btn-icon btn-ghost" aria-label={`Delete ${b.name}`} onClick={() => setToast(`${b.name} hidden — existing clients keep access`)}><Trash2 size={13} /></button>
                  </div>
                  <Progress value={(b.price / 900) * 100} height={3} tone={b.color} className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* payments */}
        <Reveal delay={110}>
          <div className="panel panel-pad">
            <SectionHead title="Payments" sub="Reseller apni numbers set karta hai · recharge video wahi dikhati hai" icon={Wallet} />
            <div className="space-y-2">
              {[['JazzCash', '0306-2015326', 'Muaaz Iqbal'], ['Easypaisa', '0321-8845201', 'Muaaz Iqbal'], ['Bank / Raast', 'PK36 MEZN 0000 1122', 'Meezan Bank']].map(([n, num, title]) => (
                <div key={n} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
                  <Smartphone size={15} className="text-gold" />
                  <div className="min-w-0 flex-1">
                    <b className="block text-xs">{n}</b>
                    <span className="num text-[10px] text-faint">{num} · {title}</span>
                  </div>
                  <Badge tone="live" dot>on</Badge>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle label="Auto-match by amount" hint="Txn ID + last 4 digits" checked onChange={() => {}} />
              <Toggle label="Grace 24h after 10th" hint="Phir auto-suspend" checked onChange={() => {}} />
            </div>
          </div>
        </Reveal>

        {/* whatsapp */}
        <Reveal delay={140}>
          <div className="panel panel-pad">
            <SectionHead title="WhatsApp automation" sub="Cloud API · verified templates" icon={MessageCircle} />
            <div className="space-y-1.5">
              {[['otp', 'Login / reseller OTP'], ['invoice', 'Invoice on the 1st'], ['receipt', 'Payment receipt'], ['expiry', 'Expiry T-3 / T-1'], ['suspend', 'Suspension notice']].map(([k, label]) => (
                <Toggle key={k} label={label} checked={wa[k]} onChange={(v) => setWa((s) => ({ ...s, [k]: v }))} />
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-faint">
              “Assalam o Alaikum {`{{reseller}}`}, aap ka {`{{month}}`} invoice {`{{amount}}`} hai. JazzCash {BRAND.jazzcash} par jama karein — 10 tareekh aakhri din.”
            </div>
          </div>
        </Reveal>

        {/* security */}
        <Reveal delay={170}>
          <div className="panel panel-pad">
            <SectionHead title="Security" sub="Har layer — token se watermark tak" icon={ShieldCheck} />
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Toggle label="Admin 2FA" hint="TOTP" checked={sec.twofa} onChange={(v) => setSec((s) => ({ ...s, twofa: v }))} />
              <Toggle label="Device lock" hint="Per-plan limit" checked={sec.device} onChange={(v) => setSec((s) => ({ ...s, device: v }))} />
              <Toggle label="ISP / country lock" hint="Geo-block" checked={sec.isp} onChange={(v) => setSec((s) => ({ ...s, isp: v }))} />
              <Toggle label="Forensic watermark" hint="Username on screen" checked={sec.watermark} onChange={(v) => setSec((s) => ({ ...s, watermark: v }))} />
              <Toggle label="Block VPN / datacenter" hint="Anti-restream" checked={sec.vpn} onChange={(v) => setSec((s) => ({ ...s, vpn: v }))} />
              <Toggle label="60s signed URLs" hint="Per session" checked={sec.token} onChange={(v) => setSec((s) => ({ ...s, token: v }))} />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald/25 bg-emerald/[0.07] px-3 py-2 text-[10px] text-emeraldsoft">
              <Lock size={12} /> Panel credentials are encrypted at rest (AES-256-GCM) and never leave the server.
            </div>
          </div>
        </Reveal>

        {/* branding */}
        <Reveal delay={200}>
          <div className="panel panel-pad">
            <SectionHead title="Branding" sub="Panel, apps and every video asset" icon={Palette} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" defaultValue="Mizanora IPTV" aria-label="Service name" />
              <input className="input" defaultValue="dns.mizanora.tv" aria-label="DNS" />
              <input className="input" defaultValue="0306-2015326" aria-label="Support number" />
              <input className="input" defaultValue="mizanora.vercel.app" aria-label="Website" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['#14b87a', '#f5b83d', '#4cc3ff', '#a78bfa', '#ff7a8a'].map((c, i) => (
                <span key={c} className={`h-9 w-9 rounded-xl ${i === 0 ? 'ring-2 ring-white/60' : ''}`} style={{ background: c }} />
              ))}
              <span className="flex items-center gap-1 rounded-xl border border-line px-3 text-[11px] text-dim"><Globe2 size={12} /> 3 domains mapped</span>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {[[Fingerprint, 'MAC pool'], [ScanEye, 'Watermark'], [Globe2, 'Domains']].map(([Icon, l]) => (
                <div key={l} className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-2.5 py-2 text-[11px]">
                  <Icon size={13} className="text-gold" /> {l}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
