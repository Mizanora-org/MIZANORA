'use client';
import { useMemo, useState } from 'react';
import {
  Search, UserPlus, Upload, Copy, Ban, RotateCcw, ChevronRight, Smartphone, Tv, KeyRound,
  MonitorSmartphone, ShieldCheck, Clock3,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { Btn, Badge, Drawer, Modal, Toast, Tabs, Avatar, Progress, SectionHead, Hint } from '@/components/ui';
import { EQ } from '@/components/charts';
import { USERS, RESELLERS, PLANS, rs } from '@/lib/data';

const STATUS_TONE = { active: 'live', expiring: 'gold', expired: 'off', suspended: 'off' };

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [proto, setProto] = useState('all');
  const [open, setOpen] = useState(null);
  const [create, setCreate] = useState(false);
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState('');

  const list = useMemo(() => USERS.filter((u) => {
    if (status !== 'all' && u.status !== status) return false;
    if (proto !== 'all' && u.protocol !== proto) return false;
    if (q && !`${u.name} ${u.mac || ''} ${u.reseller} ${u.plan}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, status, proto]);

  const counts = useMemo(() => ({
    all: USERS.length,
    active: USERS.filter((u) => u.status === 'active').length,
    expiring: USERS.filter((u) => u.status === 'expiring').length,
    expired: USERS.filter((u) => u.status === 'expired').length,
  }), []);

  const picked = open ? USERS.find((u) => u.id === open) : null;

  const copy = (text, label) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(label); setToast(`${label} copied`);
    setTimeout(() => setCopied(''), 1600);
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Subscribers</h1>
            <p className="mt-1 text-sm text-dim">Xtream lines and Stalker MACs · device limits enforced in Redis.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setToast('CSV template downloaded')}><Upload size={15} /> Bulk CSV</Btn>
            <Btn variant="gold" onClick={() => setCreate(true)}><UserPlus size={15} /> Create user</Btn>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [counts.all, 'Total lines', '#e2f0e8'],
          [counts.active, 'Active', '#14b87a'],
          [counts.expiring, 'Expiring ≤ 3 days', '#f5b83d'],
          [counts.expired, 'Expired', '#ff5a6a'],
        ].map(([v, l, c], i) => (
          <Reveal key={l} delay={i * 45}>
            <div className="panel panel-pad">
              <div className="num text-2xl font-black" style={{ color: c }}>{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">{l}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={80}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Username, MAC, reseller or plan…" />
          </div>
          <Tabs items={[{ id: 'all', label: `All ${counts.all}` }, { id: 'active', label: 'Active' }, { id: 'expiring', label: 'Expiring' }, { id: 'expired', label: 'Expired' }]} value={status} onChange={setStatus} />
          <Tabs items={[{ id: 'all', label: 'Both' }, { id: 'xtream', label: 'Xtream' }, { id: 'stalker', label: 'Stalker' }]} value={proto} onChange={setProto} />
        </div>
      </Reveal>

      <Reveal delay={110}>
        <div className="panel overflow-hidden">
          <div className="max-h-[62vh] overflow-auto scroll-thin">
            <table className="tbl">
              <thead>
                <tr><th>Subscriber</th><th>Protocol</th><th>Plan</th><th>Reseller</th><th>Devices</th><th>Expiry</th><th>Now</th><th /></tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="cursor-pointer" onClick={() => setOpen(u.id)}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} tone={u.protocol === 'stalker' ? 'violet' : 'emerald'} size={30} />
                        <div>
                          <b className="block text-xs">{u.name}</b>
                          <span className="num text-[10px] text-faint">{u.mac || `user_${u.id}`} · {u.lastSeen}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={u.protocol === 'stalker' ? 'violet' : 'info'}>{u.protocol}</Badge></td>
                    <td className="text-xs text-dim">{u.plan}</td>
                    <td className="text-xs text-dim">{u.reseller}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: u.maxDevices }).map((_, i) => (
                          <span key={i} className={`h-1.5 w-4 rounded-full ${i < u.devices ? 'bg-emerald' : 'bg-white/12'}`} />
                        ))}
                        <span className="num ml-1 text-[10px] text-faint">{u.devices}/{u.maxDevices}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[u.status]} dot>
                        {u.daysLeft < 0 ? `${Math.abs(u.daysLeft)}d ago` : `${u.daysLeft}d left`}
                      </Badge>
                    </td>
                    <td>
                      {u.watching ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-emeraldsoft"><EQ bars={3} /> {u.channel}</span>
                      ) : <span className="text-[10px] text-faint">idle</span>}
                    </td>
                    <td className="text-right"><ChevronRight size={14} className="text-faint" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] text-faint">
            <span>{list.length} lines shown</span>
            <span>Concurrency: 1,842 streams · device limit enforced per plan</span>
          </div>
        </div>
      </Reveal>

      {/* drawer */}
      <Drawer open={!!picked} onClose={() => setOpen(null)} title={picked?.name || ''} sub={picked ? `${picked.protocol.toUpperCase()} · ${picked.plan} · ${picked.reseller}` : ''}>
        {picked && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[picked.status]} dot>{picked.status}</Badge>
              <Badge tone="muted">{picked.daysLeft < 0 ? 'expired' : `${picked.daysLeft} days left`}</Badge>
              <Badge tone="muted">{picked.country}</Badge>
            </div>

            <div className="rounded-xl border border-line bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold"><KeyRound size={13} className="text-gold" /> Credentials</div>
              {picked.protocol === 'stalker' ? (
                <div className="space-y-1.5">
                  <Row label="Portal" value="http://dns.mizanora.tv/c/" onCopy={() => copy('http://dns.mizanora.tv/c/', 'Portal URL')} />
                  <Row label="MAC" value={picked.mac} onCopy={() => copy(picked.mac, 'MAC')} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Row label="Server" value="http://dns.mizanora.tv:8080" onCopy={() => copy('http://dns.mizanora.tv:8080', 'Server')} />
                  <Row label="Username" value={`user_${picked.id}`} onCopy={() => copy(`user_${picked.id}`, 'Username')} />
                  <Row label="Password" value="••••••••" onCopy={() => copy('mz-demo-pass', 'Password')} />
                </div>
              )}
            </div>

            <div>
              <SectionHead title="Devices" sub={`${picked.devices} of ${picked.maxDevices} in use`} />
              <div className="space-y-1.5">
                {Array.from({ length: picked.maxDevices }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-2">
                    {i % 2 ? <MonitorSmartphone size={14} className="text-faint" /> : <Smartphone size={14} className="text-faint" />}
                    <span className="flex-1 text-[11px]">{i < picked.devices ? ['Android TV · TiviMate', 'iPhone · Smarters', 'MAG 254', 'Web player'][i] : 'free slot'}</span>
                    {i < picked.devices ? <Btn size="sm" variant="ghost" onClick={() => setToast('Device removed — slot freed')}>Remove</Btn> : <Badge tone="muted">empty</Badge>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHead title="Last 24h" sub="Watch time and errors" />
              <div className="grid grid-cols-3 gap-2">
                {[['2h 14m', 'watch time'], ['38', 'zaps'], ['0.3%', 'buffer']].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-line bg-white/[0.03] p-2.5 text-center">
                    <div className="num text-sm font-extrabold">{v}</div>
                    <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Btn variant="primary" onClick={() => setToast('Extended by 30 days')}><RotateCcw size={13} /> Extend 30d</Btn>
              <Btn variant="danger" onClick={() => setToast('Line suspended')}><Ban size={13} /> Suspend</Btn>
            </div>
            <Hint>Din 11–12 par reseller ka balance zero ho to is line par recharge video chalti hai (naam + number + voice).</Hint>
          </div>
        )}
      </Drawer>

      {/* create */}
      <Modal open={create} onClose={() => setCreate(false)} title="Create subscriber" sub="Line activates instantly — no queue." wide>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Username" defaultValue="new_user_01" />
            <input className="input" placeholder="Password" defaultValue="mz-4821" />
            <select className="input" defaultValue="Family">{PLANS.map((p) => <option key={p} className="bg-[#071410]">{p}</option>)}</select>
            <select className="input" defaultValue="Barakat Vision">{RESELLERS.map((r) => <option key={r.id} className="bg-[#071410]">{r.name}</option>)}</select>
            <select className="input" defaultValue="1 month"><option className="bg-[#071410]">1 month</option><option className="bg-[#071410]">3 months</option><option className="bg-[#071410]">12 months</option></select>
            <select className="input" defaultValue="Xtream"><option className="bg-[#071410]">Xtream</option><option className="bg-[#071410]">Stalker / MAC</option></select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[['1 device', true], ['2 devices', false], ['3 devices', false]].map(([l, on]) => (
              <label key={l} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${on ? 'border-gold/50 bg-gold/[0.07]' : 'border-line bg-white/[0.03]'}`}>
                <input type="radio" name="dev" defaultChecked={on} className="h-3.5 w-3.5 accent-[#f5b83d]" />{l}
              </label>
            ))}
          </div>
          <Hint>Retail cap Rs 200/month — reseller is se zyada set nahi kar sakta. Connection fee Rs 50 (Reseller Rs 30 / Admin Rs 20).</Hint>
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setCreate(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={() => { setCreate(false); setToast('Line created — WhatsApp sent to reseller & client'); }}><ShieldCheck size={14} /> Create & notify</Btn>
          </div>
        </div>
      </Modal>

      <Toast msg={toast} onDone={() => setToast('')} />
    </div>
  );
}

function Row({ label, value, onCopy }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/25 px-2.5 py-1.5">
      <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-faint">{label}</span>
      <code className="flex-1 truncate text-[11px] text-cream/85">{value}</code>
      <button onClick={onCopy} className="text-faint hover:text-gold" aria-label={`Copy ${label}`}><Copy size={12} /></button>
    </div>
  );
}
