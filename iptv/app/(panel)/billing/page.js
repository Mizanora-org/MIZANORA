'use client';
import { useState } from 'react';
import {
  ReceiptText, Send, Download, MessageCircle, CheckCircle2, Clock3, AlertTriangle, Banknote,
  Smartphone, Building2, Wallet, Zap,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Toast, Progress, SectionHead, Toggle, Hint } from '@/components/ui';
import { Ring, Bars } from '@/components/charts';
import { INVOICES, PENDING_PAYMENTS, BRAND, rs } from '@/lib/data';

const TONES = { paid: 'live', partial: 'gold', overdue: 'off' };

export default function BillingPage() {
  const [toast, setToast] = useState('');
  const [automation, setAutomation] = useState({ inv: true, r3: true, r7: true, final: true, suspend: true, receipt: true });

  const totals = {
    target: INVOICES.reduce((s, i) => s + i.amount, 0),
    paid: INVOICES.reduce((s, i) => s + i.paid, 0),
    pending: INVOICES.reduce((s, i) => s + (i.amount - i.paid), 0),
    overdue: INVOICES.filter((i) => i.status === 'overdue').reduce((s, i) => s + (i.amount - i.paid), 0),
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Billing & collection</h1>
            <p className="mt-1 text-sm text-dim">Cycle {BRAND.cycle.from}–{BRAND.cycle.to} {BRAND.cycle.month} · JazzCash {BRAND.jazzcash}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setToast('14 invoices sent on WhatsApp')}><Send size={15} /> Send invoices</Btn>
            <Btn variant="gold" onClick={() => setToast('Statement exported (PDF)')}><Download size={15} /> Statement</Btn>
          </div>
        </div>
      </Reveal>

      {/* cycle tracker */}
      <Reveal delay={40}>
        <div className="panel panel-pad relative overflow-hidden">
          <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Collection window</p>
              <p className="text-lg font-black">Day 2 of 10 <span className="text-xs font-semibold text-faint">· 8 days left</span></p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <Badge tone="live" dot>Reminders on</Badge>
              <Badge tone="gold">Auto-suspend 12th</Badge>
              <Badge tone="muted">Grace 24h</Badge>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-1.5">
            {Array.from({ length: 10 }, (_, i) => {
              const d = i + 1;
              const done = d < 2;
              const today = d === 2;
              return (
                <div key={d} className="flex-1 text-center">
                  <div className={`h-10 rounded-lg border transition ${done ? 'border-emerald/40 bg-emerald/20' : today ? 'border-gold/60 bg-gold/20 glow-line' : 'border-line bg-white/[0.03]'}`} />
                  <div className={`mt-1 text-[9px] font-bold ${today ? 'text-gold' : done ? 'text-emeraldsoft' : 'text-faint'}`}>{d}</div>
                </div>
              );
            })}
            <div className="flex-1 text-center">
              <div className="h-10 rounded-lg border border-red-400/30 bg-red-500/10" />
              <div className="mt-1 text-[9px] font-bold text-red-300">12</div>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-faint">
            <span>1 — invoices out</span><span>10 — last day</span><span>12 — suspend</span>
          </div>
        </div>
      </Reveal>

      {/* totals */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Banknote, rs(totals.target), 'Cycle target', '#f5b83d'],
          [CheckCircle2, rs(totals.paid), 'Received', '#14b87a'],
          [Clock3, rs(totals.pending), 'Pending', '#4cc3ff'],
          [AlertTriangle, rs(totals.overdue), 'Overdue', '#ff5a6a'],
        ].map(([Icon, v, l, c], i) => (
          <Reveal key={l} delay={60 + i * 45}>
            <div className="panel panel-pad">
              <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${c}1c`, color: c }}><Icon size={16} /></span>
              <div className="num mt-3 text-lg font-black">{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">{l}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* invoices */}
        <Reveal delay={120}>
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold"><ReceiptText size={15} className="text-gold" /> Invoices</h2>
                <p className="text-[10px] text-faint">{INVOICES.length} resellers · due 10 {BRAND.cycle.month}</p>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => setToast('Reminders queued for partial + overdue')}><MessageCircle size={12} /> Remind pending</Btn>
            </div>
            <div className="max-h-[52vh] overflow-auto scroll-thin">
              <table className="tbl">
                <thead><tr><th>Invoice</th><th>Reseller</th><th>Conns</th><th>Amount</th><th>Collected</th><th>Status</th><th>WhatsApp</th></tr></thead>
                <tbody>
                  {INVOICES.map((inv) => (
                    <tr key={inv.id}>
                      <td className="num text-[11px] text-dim">{inv.id}</td>
                      <td>
                        <b className="block text-xs">{inv.reseller}</b>
                        <span className="text-[10px] text-faint">{inv.method}</span>
                      </td>
                      <td className="num text-xs">{inv.connections}</td>
                      <td className="num text-xs">{rs(inv.amount)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Progress value={(inv.paid / inv.amount) * 100} height={5} tone={inv.status === 'paid' ? '#14b87a' : inv.status === 'overdue' ? '#ff5a6a' : '#f5b83d'} className="w-16" />
                          <span className="num text-[10px] text-faint">{Math.round((inv.paid / inv.amount) * 100)}%</span>
                        </div>
                      </td>
                      <td><Badge tone={TONES[inv.status]} dot>{inv.status}</Badge></td>
                      <td><span className="text-[10px] text-faint">{inv.wa}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* pending + automation */}
        <div className="space-y-4">
          <Reveal delay={150}>
            <div className="panel panel-pad">
              <SectionHead title="Payment proof" sub="WhatsApp screenshots to approve" actions={<Badge tone="gold" dot>{PENDING_PAYMENTS.length}</Badge>} />
              <div className="space-y-2">
                {PENDING_PAYMENTS.map((p) => (
                  <div key={p.id} className="rounded-xl border border-line bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <b className="block text-xs">{p.reseller}</b>
                        <span className="text-[10px] text-faint">{p.method} · txn {p.txn} · {p.at}</span>
                      </div>
                      <b className="num text-sm text-emeraldsoft">{rs(p.amount)}</b>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Btn size="sm" variant="primary" className="flex-1" onClick={() => setToast(`${p.reseller} marked paid · WhatsApp receipt sent`)}>Approve</Btn>
                      <Btn size="sm" className="flex-1" onClick={() => setToast('Proof rejected — reseller notified')}>Reject</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="panel panel-pad">
              <SectionHead title="WhatsApp automation" sub="Cloud API templates" icon={MessageCircle} />
              <div className="space-y-1.5">
                {[
                  ['inv', 'Invoice on the 1st'],
                  ['r3', 'Reminder day 3 & 5'],
                  ['r7', 'Reminder day 7'],
                  ['final', 'Final notice day 9'],
                  ['suspend', 'Suspension notice day 12'],
                  ['receipt', 'Payment receipt'],
                ].map(([k, label]) => (
                  <Toggle key={k} label={label} checked={automation[k]} onChange={(v) => setAutomation((a) => ({ ...a, [k]: v }))} />
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* split */}
      <Reveal delay={200}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel panel-pad">
            <SectionHead title="Where the money goes" sub="Per active connection, per month" />
            <div className="flex items-center gap-5">
              <Ring value={100} size={104} tone="#f5b83d" label="Rs 200" sub="client pays" />
              <div className="flex-1 space-y-2 text-[11px]">
                <div className="flex justify-between"><span className="text-dim">Admin wholesale</span><b className="num">Rs 100</b></div>
                <div className="flex justify-between"><span className="text-dim">Reseller profit</span><b className="num text-emeraldsoft">Rs 100</b></div>
                <div className="flex justify-between"><span className="text-dim">Connection fee</span><b className="num">Rs 50</b></div>
                <div className="flex justify-between text-[10px] text-faint"><span>↳ Admin Rs 20</span><span>↳ Reseller Rs 30</span></div>
              </div>
            </div>
          </div>
          <div className="panel panel-pad">
            <SectionHead title="Collected per day" sub="This cycle" />
            <Bars data={[42, 128, 210, 96, 64, 120, 88, 30, 0, 0]} height={120} color="#14b87a" />
            <div className="mt-2 flex justify-between text-[10px] text-faint"><span>1 Nov</span><span>10 Nov</span></div>
          </div>
          <div className="panel panel-pad">
            <SectionHead title="Payout channels" sub="Reseller's own numbers" />
            <div className="space-y-2">
              {[[Smartphone, 'JazzCash', '0306-2015326'], [Smartphone, 'Easypaisa', '0321-8845201'], [Building2, 'Bank / Raast', 'PK36 MEZN 0000 1122']].map(([Icon, n, v]) => (
                <div key={n} className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2">
                  <Icon size={14} className="text-gold" /><b className="flex-1 text-xs">{n}</b><span className="num text-[10px] text-faint">{v}</span>
                </div>
              ))}
            </div>
            <Hint>Client ko recharge video mein yehi numbers + reseller ka naam dikhta hai.</Hint>
          </div>
        </div>
      </Reveal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
