// Mock data for the MIZANORA IPTV control panel prototype.
// Everything here is deterministic so the UI looks identical on every reload.

const rnd = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const BRAND = {
  name: 'Mizanora IPTV',
  tagline: 'Broadcast control room',
  operator: 'Muaaz Iqbal',
  jazzcash: '0306-2015326',
  cycle: { from: 1, to: 10, month: 'Nov 2026' },
  fee: { total: 50, admin: 20, reseller: 30 },
  wholesale: 100,
  retailCap: 200,
};

export const KPIS = [
  { id: 'viewers', label: 'Live viewers now', value: 1842, suffix: '', delta: 12.4, hint: 'vs. yesterday', tone: 'emerald', icon: 'tv' },
  { id: 'connections', label: 'Active connections', value: 12864, suffix: '', delta: 6.1, hint: 'across 3 nodes', tone: 'gold', icon: 'activity' },
  { id: 'revenue', label: 'Month to date', value: 1286400, prefix: 'Rs ', delta: 18.9, hint: 'wholesale + fees', tone: 'violet', icon: 'wallet' },
  { id: 'collect', label: 'Collected 1–10', value: 78, suffix: '%', delta: 4.2, hint: 'Rs 10.02L of 12.86L', tone: 'info', icon: 'check' },
];

// 48 points of concurrent viewers (last 24h, every 30 min)
export const VIEWERS_SERIES = Array.from({ length: 48 }, (_, i) => {
  const base = 900 + Math.sin(i / 4.2) * 260 + Math.sin(i / 1.7) * 120;
  const spike = i > 31 && i < 39 ? 520 : 0; // prime time
  return Math.max(320, Math.round(base + spike + (i % 3) * 26));
});

export const REVENUE_SERIES = [
  { m: 'Dec', v: 420000 }, { m: 'Jan', v: 485000 }, { m: 'Feb', v: 522000 },
  { m: 'Mar', v: 640000 }, { m: 'Apr', v: 704000 }, { m: 'May', v: 812000 },
  { m: 'Jun', v: 905000 }, { m: 'Jul', v: 980000 }, { m: 'Aug', v: 1092000 },
  { m: 'Sep', v: 1148000 }, { m: 'Oct', v: 1210000 }, { m: 'Nov', v: 1286400 },
];

export const GROUPS = [
  'Pakistan', 'News', 'Sports', 'Islamic', 'Entertainment', 'Movies', 'Kids', 'Indian', 'International',
];

const CH = [
  ['PTV Home HD', 'Pakistan', 'HD', false, true, 92, 148], ['PTV Sports', 'Sports', 'HD', true, true, 88, 264],
  ['ARY News', 'News', 'HD', false, true, 96, 132], ['Geo News', 'News', 'HD', false, true, 94, 128],
  ['Hum News', 'News', 'FHD', false, false, 71, 74], ['Samaa TV', 'News', 'SD', false, true, 64, 41],
  ['Dunya News', 'News', 'HD', false, true, 82, 52], ['Express News', 'News', 'HD', false, true, 79, 47],
  ['ARY Digital', 'Entertainment', 'HD', false, true, 90, 186], ['HUM TV', 'Entertainment', 'FHD', true, true, 93, 210],
  ['GEO Entertainment', 'Entertainment', 'HD', false, true, 87, 96], ['Green Entertainment', 'Entertainment', 'HD', true, true, 85, 88],
  ['A-Plus TV', 'Entertainment', 'HD', false, true, 80, 61], ['Express Entertainment', 'Entertainment', 'SD', false, true, 62, 33],
  ['Madani Channel', 'Islamic', 'HD', false, true, 95, 58], ['Makkah Live', 'Islamic', '4K', false, true, 98, 121],
  ['Madinah Live', 'Islamic', '4K', false, true, 97, 104], ['Paigham TV', 'Islamic', 'HD', false, true, 90, 44],
  ['Saudi Quran TV', 'Islamic', 'HD', false, true, 94, 66], ['Peace TV Urdu', 'Islamic', 'HD', false, true, 84, 39],
  ['Ten Sports', 'Sports', 'FHD', true, true, 81, 198], ['Star Sports 1', 'Sports', 'HD', true, true, 78, 176],
  ['A Sports', 'Sports', 'HD', true, false, 66, 84], ['WWE Network', 'Sports', 'FHD', true, true, 74, 92],
  ['Star Plus', 'Indian', 'FHD', true, true, 89, 254], ['Sony Max', 'Movies', 'FHD', true, true, 86, 168],
  ['Star Gold', 'Movies', 'HD', true, true, 83, 141], ['Zee Cinema', 'Movies', 'HD', true, true, 80, 108],
  ['HBO HD', 'Movies', 'FHD', true, true, 92, 122], ['Netflix Feed 1', 'Movies', '4K', true, true, 88, 96],
  ['Cartoon Network', 'Kids', 'HD', false, true, 86, 74], ['Nickelodeon', 'Kids', 'HD', false, true, 78, 48],
  ['Pogo', 'Kids', 'SD', false, false, 58, 22], ['Discovery HD', 'International', 'FHD', true, true, 87, 63],
  ['National Geographic', 'International', 'FHD', true, true, 84, 57], ['BBC World News', 'News', 'HD', false, true, 91, 49],
  ['Al Jazeera Arabic', 'News', 'HD', false, true, 88, 71], ['PTV National', 'Pakistan', 'HD', false, true, 89, 82],
  ['Sindh TV', 'Pakistan', 'SD', false, true, 60, 19], ['Khyber TV', 'Pakistan', 'SD', false, true, 59, 21],
];

const cid = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const TINTS = [
  ['#0d8b58', '#134e3a'], ['#f5b83d', '#7a4b06'], ['#4cc3ff', '#0b3d55'],
  ['#a78bfa', '#3b2470'], ['#ff7a8a', '#5c1a24'], ['#34d399', '#0f3b2c'],
];

export const CHANNELS = CH.map(([name, group, quality, premium, online, epg, viewers]) => {
  const h = hash(name);
  return {
    id: cid(name), name, group, quality, premium, online, epg, viewers,
    slug: cid(name), tint: TINTS[h % TINTS.length],
    sources: 1 + (h % 3),
    bitrate: 2.4 + (h % 40) / 10,
    country: group === 'Indian' ? 'IN' : group === 'International' ? 'GB' : 'PK',
    uptime: online ? 96 + (h % 39) / 10 : 41 + (h % 40),
    updated: `${1 + (h % 50)}m ago`,
  };
});

export const BOUQUETS = [
  { id: 'basic', name: 'Basic', channels: 620, vod: 1200, price: 200, cap: 200, devices: 1, color: '#14b87a', icon: 'tv' },
  { id: 'family', name: 'Family', channels: 1480, vod: 6400, price: 350, cap: 350, devices: 2, color: '#4cc3ff', icon: 'users' },
  { id: 'sports', name: 'Sports', channels: 240, vod: 0, price: 500, cap: 500, devices: 3, color: '#f5b83d', icon: 'trophy' },
  { id: 'vip', name: 'VIP 4K', channels: 2100, vod: 12800, price: 900, cap: 900, devices: 4, color: '#a78bfa', icon: 'crown' },
];

export const RESELLERS = [
  ['Barakat Vision', '0306-2015326', 'Lahore', 214, 86, 'paid'],
  ['Sky Link Cable', '0321-8845201', 'Faisalabad', 168, 62, 'paid'],
  ['Madina Digital', '0333-7719034', 'Karachi', 143, 71, 'due'],
  ['Ali Traders', '0300-5562210', 'Multan', 122, 38, 'paid'],
  ['Fast Stream PK', '0345-9982110', 'Islamabad', 118, 55, 'due'],
  ['Pak Vision HD', '0312-4400887', 'Rawalpindi', 96, 34, 'paid'],
  ['Chaudhry Network', '0301-7723411', 'Gujranwala', 88, 29, 'due'],
  ['Noor Media', '0332-1187440', 'Peshawar', 74, 41, 'paid'],
  ['Sialkot Broadband', '0346-2201983', 'Sialkot', 61, 22, 'overdue'],
  ['Bhakkar Links', '0308-6612904', 'Bhakkar', 48, 17, 'due'],
  ['Crescent TV', '0334-2019766', 'Quetta', 41, 14, 'paid'],
  ['Hyderabad Vision', '0311-7789201', 'Hyderabad', 36, 12, 'overdue'],
].map(([name, phone, city, clients, credits, status], i) => ({
  id: `r${i + 1}`, name, phone, city, clients, credits, status,
  tier: clients > 120 ? 'Platinum' : clients > 70 ? 'Gold' : 'Silver',
  due: clients * 100,
  collected: status === 'paid' ? clients * 100 : status === 'due' ? Math.round(clients * 100 * 0.45) : 0,
  joined: ['Jan 2025', 'Mar 2025', 'Jul 2025', 'Sep 2025', 'Feb 2026', 'Apr 2026'][i % 6],
  growth: [18, 9, -4, 14, 22, 6, -2, 11, 3, 16, 8, -6][i],
}));

export const PLANS = ['Basic', 'Family', 'Sports', 'VIP 4K'];

const USER_NAMES = [
  'ali_786', 'hassan.tv', 'raza_khan', 'sana_malik', 'bilal_4k', 'zain_abbas', 'hamza.pk', 'usman_geo',
  'kamran_92', 'fahad_ali', 'noor_fatima', 'saad_mirza', 'adeel_raj', 'waleed_x', 'tahir_mehmood',
  'irfan_hd', 'shani_786', 'moiz_ali', 'arslan_k', 'daniyal_pk', 'zeeshan_b', 'omer_farooq',
  'ayesha_n', 'maria_s', 'faraz_99', 'anas_dev', 'shehryar', 'nabeel_k',
];

const pick = (a, r) => a[Math.floor(r() * a.length)];
const pad = (n) => String(n).padStart(2, '0');

export const USERS = USER_NAMES.map((name, i) => {
  const r = rnd(i * 977 + 13);
  const reseller = RESELLERS[Math.floor(r() * RESELLERS.length)];
  const days = Math.floor(r() * 60) - 6;
  const devices = 1 + Math.floor(r() * 3);
  const protocol = r() > 0.72 ? 'stalker' : 'xtream';
  return {
    id: `u${1000 + i}`,
    name,
    protocol,
    mac: protocol === 'stalker' ? `00:1A:79:${pad(Math.floor(r() * 90) + 10)}:${pad(Math.floor(r() * 90) + 10)}:${pad(Math.floor(r() * 90) + 10)}` : null,
    reseller: reseller.name,
    resellerId: reseller.id,
    plan: PLAN_OR(r),
    devices,
    maxDevices: devices + (r() > 0.7 ? 1 : 0),
    daysLeft: days,
    status: days < 0 ? 'expired' : days < 4 ? 'expiring' : r() > 0.93 ? 'suspended' : 'active',
    watching: r() > 0.55,
    channel: r() > 0.55 ? pick(CHANNELS, r).name : null,
    lastSeen: days < 0 ? `${1 + Math.floor(r() * 20)}d ago` : `${Math.floor(r() * 59)}m ago`,
    country: r() > 0.9 ? 'AE' : 'PK',
  };
});

function PLAN_OR(r) { return pick(PLANS, r); }

export const NODES = [
  { id: 'khi-1', name: 'Karachi Edge 01', flag: 'PK', region: 'Asia/Karachi', cpu: 42, ram: 61, conns: 5210, bw: 8.4, max: 12, status: 'healthy' },
  { id: 'lhe-1', name: 'Lahore LB 02', flag: 'PK', region: 'Asia/Karachi', cpu: 68, ram: 74, conns: 4380, bw: 6.9, max: 10, status: 'healthy' },
  { id: 'dxb-1', name: 'Dubai Edge 03', flag: 'AE', region: 'Asia/Dubai', cpu: 31, ram: 44, conns: 2140, bw: 3.2, max: 8, status: 'healthy' },
  { id: 'fra-1', name: 'Frankfurt Edge 04', flag: 'DE', region: 'Europe/Berlin', cpu: 87, ram: 79, conns: 1134, bw: 1.8, max: 4, status: 'warning' },
];

export const INVOICES = RESELLERS.map((res, i) => ({
  id: `INV-2601${pad(i + 1)}`,
  reseller: res.name,
  resellerId: res.id,
  connections: res.clients,
  amount: res.due,
  paid: res.collected,
  status: res.status === 'paid' ? 'paid' : res.status === 'due' ? 'partial' : 'overdue',
  dueDate: '10 Nov 2026',
  wa: res.status === 'paid' ? 'Receipt sent' : res.status === 'due' ? 'Reminder 3/5' : 'Final notice',
  method: ['JazzCash', 'Easypaisa', 'Bank / Raast'][i % 3],
}));

export const ACTIVITY = [
  { t: '2m', kind: 'pay', text: 'Barakat Vision paid Rs 21,400 via JazzCash', meta: 'TXN 7729' },
  { t: '6m', kind: 'user', text: 'ali_786 created a Stalker line (00:1A:79:42:11:08)', meta: 'Sky Link Cable' },
  { t: '11m', kind: 'alert', text: 'Frankfurt Edge 04 CPU above 85% — traffic shifted to Dubai', meta: 'auto' },
  { t: '18m', kind: 'channel', text: 'HUM News marked offline — source 2/2 failing', meta: 'health check' },
  { t: '27m', kind: 'pay', text: 'Madina Digital paid Rs 6,000 (partial)', meta: 'Easypaisa' },
  { t: '34m', kind: 'user', text: 'Trial issued to saad_mirza — 24h, 1 device', meta: 'Fast Stream PK' },
  { t: '49m', kind: 'channel', text: 'PTV Sports reconnected after 2 retries', meta: 'failover' },
  { t: '1h', kind: 'alert', text: 'Recharge video re-rendered for 12 resellers', meta: 'ffmpeg' },
];

export const EPG_CHANNELS = [
  { id: 'ptv-home', name: 'PTV Home HD', tint: ['#0d8b58', '#134e3a'] },
  { id: 'ary-news', name: 'ARY News', tint: ['#f5b83d', '#7a4b06'] },
  { id: 'geo-news', name: 'Geo News', tint: ['#4cc3ff', '#0b3d55'] },
  { id: 'ptv-sports', name: 'PTV Sports', tint: ['#a78bfa', '#3b2470'] },
  { id: 'hum-tv', name: 'HUM TV', tint: ['#ff7a8a', '#5c1a24'] },
  { id: 'makkah-live', name: 'Makkah Live', tint: ['#34d399', '#0f3b2c'] },
  { id: 'madani-channel', name: 'Madani Channel', tint: ['#0d8b58', '#134e3a'] },
  { id: 'star-plus', name: 'Star Plus', tint: ['#4cc3ff', '#0b3d55'] },
];

const SHOWS = [
  ['Morning News', 'news'], ['Drama: Kaisa Hai Naseeban', 'drama'], ['Sports Tonight', 'sports'],
  ['Quran Tilawat', 'islamic'], ['Movie: Sultan', 'movie'], ['Talk Show: The Debate', 'talk'],
  ['Cartoons', 'kids'], ['Documentary', 'doc'], ['Comedy Night', 'comedy'], ['Prime Time News', 'news'],
];

export const EPG = EPG_CHANNELS.map((ch, ci) => {
  const r = rnd(ci * 431 + 7);
  let at = 0;
  return {
    ...ch,
    programs: SHOWS.map((s, i) => {
      const start = at;
      const dur = [30, 60, 45, 90, 120][Math.floor(r() * 5)];
      at += dur;
      return { id: `${ch.id}-${i}`, title: s[0], genre: s[1], start, end: start + dur };
    }),
  };
});

export const ASSETS = [
  { id: 'intro', name: 'Intro ident', kind: 'intro', dur: '4.2s', size: '2.1 MB', loop: false, tone: '#f5b83d' },
  { id: 'premium', name: 'Premium unlock', kind: 'premium', dur: '8.0s', size: '3.4 MB', loop: true, tone: '#a78bfa' },
  { id: 'offline', name: 'Offline standby', kind: 'offline', dur: '12.0s', size: '4.8 MB', loop: true, tone: '#4cc3ff' },
  { id: 'recharge', name: 'Recharge (per reseller)', kind: 'recharge', dur: '15.0s', size: '6.2 MB', loop: true, tone: '#ff7a8a' },
];

export const ADS = [
  { id: 'a1', name: 'Mizanora winter jackets', type: 'Pre-roll · 6s', slots: 'All bouquets', ctr: 4.8, views: '184k', tone: '#f5b83d', live: true },
  { id: 'a2', name: 'Mizanora watches', type: 'EPG banner', slots: 'Basic, Family', ctr: 2.1, views: '96k', tone: '#14b87a', live: true },
  { id: 'a3', name: 'Local dealer — Barakat Vision', type: 'Corner QR', slots: 'Reseller: Barakat', ctr: 6.3, views: '12k', tone: '#a78bfa', live: true },
  { id: 'a4', name: 'Ramzan offer teaser', type: 'Mid-roll', slots: 'Scheduled 15 Nov', ctr: 0, views: '—', tone: '#4cc3ff', live: false },
];

export const PENDING_PAYMENTS = [
  { id: 'P-9912', reseller: 'Madina Digital', amount: 6000, method: 'JazzCash', txn: '8291042', at: '9:42 AM', proof: true },
  { id: 'P-9911', reseller: 'Fast Stream PK', amount: 5500, method: 'JazzCash', txn: '8290887', at: '9:18 AM', proof: true },
  { id: 'P-9909', reseller: 'Bhakkar Links', amount: 1700, method: 'Easypaisa', txn: '5512300', at: 'Yesterday', proof: false },
];

export const TOP_CHANNELS = CHANNELS.slice().sort((a, b) => b.viewers - a.viewers).slice(0, 6);

export const fmt = (n) => n >= 100000 ? `${(n / 100000).toFixed(2)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
export const rs = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`;
