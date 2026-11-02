'use client';
import { useMemo, useState } from 'react';
import {
  UserPlus, Download, MessageCircle, Search, ChevronRight, Crown, TrendingUp, TrendingDown,
  Wallet, Users2, BadgeCheck, Phone, MapPin, Smartphone, Send,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Drawer, Modal, Toast, Progress, SectionHead, Avatar, Hint } from '@/components/ui';
import { Spark, Ring } from '@/components/charts';
import { RESELLERS, USERS, BRAND, rs } from '@/lib/data';

const STATUS = {
  paid: { tone: 'live', label: 'Paid' },
  due: { tone: 'gold', label: 'Partial' },
  overdue: { tone: 'off', label: 'Overdue' },
};

export default function ResellersPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState('');

  const list = useMemo(() => RESELLERS.filter((r) => {
    if (filter === 'due' && r.status === 'paid') return false;
    if (filter === 'paid' && r.status !== 'paid') return false;
    if (q && !`${r.name} ${r.city} ${r.phone}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, filter]);

  const totals = useMemo(() => ({
    clients: RESELLERS.reduce((s, r) => s + r.clients, 0),
    due: RESELLERS.reduce((s, r) => s + r.due, 0),
    collected: RESELLERS.reduce((s, r) => s + r.collected, 0),
  }), []);

  const picked = open ? RESELLERS.find((r) => r.id === open) : null;
  const pickedUsers = picked ? USERS.filter((u) => u.resellerId === picked.id) : [];

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Resellers</h1>
            <p className="mt-1 text-sm text-dim">{RESELLERS.length} partners · {totals.clients.toLocaleString()} connections · unlimited clients each</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setToast('CSV exported · resellers_cycle_nov.csv')}><Download size={15} /> Export</Btn>
            <Btn variant="gold" onClick={() => setInvite(true)}><UserPlus size={15} /> Invite reseller</Btn>
          </div>
        </div>
      </Reveal>

      {/* economy strip */}
      <Reveal delay={40}>
        <div className="panel panel-pad relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Connection fee</p>
              <p className="num text-2xl font-black">Rs {BRAND.fee.total}</p>
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="flex h-3 overflow-hidden rounded-full">
                <span className="bg-emerald" style={{ width: `${(BRAND.fee.reseller / BRAND.fee.total) * 100}%` }} />
                <span className="bg-gold" style={{ width: `${(BRAND.fee.admin / BRAND.fee.total) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-bold">
                <span className="text-emeraldsoft">Reseller Rs {BRAND.fee.reseller}</span>
                <span className="text-goldsoft">Admin Rs {BRAND.fee.admin}</span>
              </div>
            </div>
            <div className="flex gap-6">
              <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Wholesale / month</p><p className="num text-lg font-black">Rs {BRAND.wholesale}</p></div>
              <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Retail cap</p><p className="num text-lg font-black">Rs {BRAND.retailCap}</p></div>
              <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-faint">Reseller margin</p><p className="num text-lg font-black text-emeraldsoft">Rs {BRAND.retailCap - BRAND.wholesale}</p></div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* summary */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Users2, RESELLERS.length, 'Active resellers', 'emerald'],
          [Smartphone, totals.clients.toLocaleString(), 'Connections', 'gold'],
          [Wallet, rs(totals.due), `Due by 10 ${BRAND.cycle.month}`, 'violet'],
          [BadgeCheck, rs(totals.collected), 'Collected', 'info'],
        ].map(([Icon, v, l, tone], i) => {
          const c = { emerald: '#14b87a', gold: '#f5b83d', violet: '#a78bfa', info: '#4cc3ff' }[tone];
          return (
            <Reveal key={l} delay={60 + i * 45}>
              <div className="panel panel-pad">
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${c}1c`, color: c }}><Icon size={16} /></span>
                <div className="num mt-3 text-xl font-black">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-faint">{l}</div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* toolbar */}
      <Reveal delay={100}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Name, city or phone…" />
          </div>
          {[['all', 'All'], ['due', 'Pending'], ['paid', 'Paid']].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`chip ${filter === id ? 'active' : ''}`}>{label}</button>
          ))}
        </div>
      </Reveal>

      {/* table */}
      <Reveal delay={130}>
        <div className="panel overflow-hidden">
          <div className="max-h-[60vh] overflow-auto scroll-thin">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Reseller</th><th>Clients</th><th>Trend</th><th>Due</th><th>Collected</th>
                  <th>Status</th><th>WhatsApp</th><th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const pct = r.due ? Math.round((r.collected / r.due) * 100) : 0;
                  const st = STATUS[r.status];
                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} tone={r.tier === 'Platinum' ? 'gold' : r.tier === 'Gold' ? 'violet' : 'emerald'} />
                          <div>
                            <b className="flex items-center gap-1 text-xs">{r.name}{r.tier === 'Platinum' && <Crown size={11} className="text-gold" />}</b>
                            <span className="flex items-center gap-1 text-[10px] text-faint"><MapPin size={9} />{r.city} · {r.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num text-xs">{r.clients}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${r.growth >= 0 ? 'text-emeraldsoft' : 'text-red-300'}`}>
                          {r.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(r.growth)}%
                        </span>
                      </td>
                      <td className="num text-xs">{rs(r.due)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} height={5} tone={pct === 100 ? '#14b87a' : pct > 40 ? '#f5b83d' : '#ff5a6a'} className="w-20" />
                          <span className="num text-[10px] text-faint">{pct}%</span>
                        </div>
                      </td>
                      <td><Badge tone={st.tone} dot>{st.label}</Badge></td>
                      <td>
                        <button onClick={(e) => { e.stopPropagation(); setToast(`Reminder sent to ${r.name} on WhatsApp`); }}
                          className="btn btn-sm btn-ghost gap-1"><MessageCircle size={11} className="text-[#25D366]" />{' '}{r.status === 'paid' ? 'Receipt' : 'Remind'}</button>
                      </td>
                      <td className="text-right"><ChevronRight size={14} className="text-faint" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      {/* drawer */}
      <Drawer open={!!picked} onClose={() => setOpen(null)} title={picked?.name || ''} sub={picked ? `${picked.tier} · joined ${picked.joined} · ${picked.city}` : ''}>
        {picked && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[[rs(picked.due), 'Due this cycle'], [rs(picked.collected), 'Collected'], [picked.clients, 'Clients'], [`${picked.credits}`, 'Credits left']].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-line bg-white/[0.03] p-3">
                  <div className="num text-base font-extrabold">{v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-faint">{l}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold">Collection progress</span>
                <Badge tone={STATUS[picked.status].tone}>{STATUS[picked.status].label}</Badge>
              </div>
              <Progress value={picked.due ? (picked.collected / picked.due) * 100 : 0} className="mt-2" tone="#f5b83d" height={7} />
              <p className="mt-1.5 text-[10px] text-faint">Window 1–10 {BRAND.cycle.month} · auto-suspend on the 12th</p>
            </div>

            <div className="flex gap-2">
              <Btn variant="primary" className="flex-1" onClick={() => setToast('Marked paid — account restored')}>Mark paid</Btn>
              <Btn className="flex-1" onClick={() => setToast('WhatsApp reminder sent')}><Send size={13} /> Remind</Btn>
            </div>

            <div>
              <SectionHead title={`Clients (${pickedUsers.length})`} sub="Live sample from this reseller" />
              <div className="space-y-1.5">
                {pickedUsers.slice(0, 6).map((u) => (
                  <div key={u.id} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: u.status === 'active' ? '#14b87a' : u.status === 'expiring' ? '#f5b83d' : '#ff5a6a' }} />
                    <b className="flex-1 truncate text-[11px]">{u.name}</b>
                    <Badge tone="muted">{u.protocol}</Badge>
                    <span className="num text-[10px] text-faint">{u.daysLeft}d</span>
                  </div>
                ))}
                {!pickedUsers.length && <p className="text-[11px] text-faint">No sample clients loaded for this partner.</p>}
              </div>
            </div>

            <div>
              <SectionHead title="Ledger" sub="Credits + fee splits" />
              <div className="space-y-1.5 text-[11px]">
                {[
                  ['Connection fee × 4 (Rs 30 each)', '+Rs 120'],
                  ['Credits purchased (50)', '+Rs 5,000'],
                  ['Wholesale charges (214 conns)', '−Rs 21,400'],
                  ['Collected via JazzCash', '+Rs 21,400'],
                ].map(([a, b]) => (
                  <div key={a} className="flex justify-between rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                    <span className="text-dim">{a}</span>
                    <span className={`num font-bold ${b.startsWith('+') ? 'text-emeraldsoft' : 'text-goldsoft'}`}>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <Hint>Reseller apna plan (price, devices, payment numbers) baad mein bhi update kar sakta hai — recharge video khud re-render hoti hai.</Hint>
          </div>
        )}
      </Drawer>

      <Modal open={invite} onClose={() => setInvite(false)} title="Invite a reseller" sub="WhatsApp verification + admin approval; unlimited clients after approval.">
        <div className="space-y-3">
          <input className="input" placeholder="Business name" />
          <input className="input" placeholder="WhatsApp number (03XX-XXXXXXX)" />
          <input className="input" placeholder="City" />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs"><input type="checkbox" defaultChecked className="h-4 w-4 accent-[#f5b83d]" /> Send OTP on WhatsApp</label>
            <label className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs"><input type="checkbox" className="h-4 w-4 accent-[#f5b83d]" /> Start with 2 trial credits</label>
          </div>
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setInvite(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={() => { setInvite(false); setToast('Invite sent — OTP on WhatsApp'); }}><Phone size={14} /> Send invite</Btn>
          </div>
        </div>
      </Modal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}
