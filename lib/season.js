// Pakistan's seasons, picked automatically from the month (Asia/Karachi time).
// The whole look of the shop (falling leaves / snow / petals, hero banner, "season picks" shelf, ticker message)
// follows this file. To force one look, or to switch it off, set NEXT_PUBLIC_SEASON_THEME in Vercel to:
//   auto (default) | autumn | winter | spring | summer | off
export const SEASON_MODE = String(process.env.NEXT_PUBLIC_SEASON_THEME || 'auto').toLowerCase();

const WARM = ['jacket', 'sweater', 'hoodie', 'sweatshirt', 'shawl', 'blanket', 'razai', 'quilt', 'khes', 'khaddar', 'wool', 'woolen', 'warm', 'boot', 'boots', 'glove', 'gloves', 'cap', 'muffler', 'scarf', 'sock', 'socks', 'coat', 'thermal', 'fleece', 'cardigan', 'pullover', 'heater', 'flask', 'trouser', 'jeans', 'shoe', 'shoes', 'joota'];

export const SEASONS = {
  autumn: {
    id: 'autumn', name: 'Autumn', urdu: 'Khizan', particles: 'leaf',
    colors: ['#E8A317', '#C2410C', '#B45309', '#92400E', '#D97706', '#7C8B2E', '#A16207'],
    kicker: 'Khizan ka mausam',
    title: 'Khizan collection: garam, naram, khoobsurat',
    subtitle: 'Sardi aane se pehle apna garam libaas, shawl, jacket aur boots le lein. Cash on delivery, poore Pakistan mein.',
    ticker: 'Khizan collection is here: warm clothes, shawls, jackets and boots',
    picksTitle: 'Khizan picks: garam aur cozy',
    keywords: WARM,
    hero: 'from-[#2B1206] via-[#7A3410] to-[#C9780F]',
    tone: 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-3 sm:p-4',
    glow: '#F2B84B',
  },
  winter: {
    id: 'winter', name: 'Winter', urdu: 'Sardi', particles: 'snow',
    colors: ['#FFFFFF', '#E0F2FE', '#BAE6FD'],
    kicker: 'Sardi ka mausam',
    title: 'Sardi collection: garmi aur style ek saath',
    subtitle: 'Jackets, sweaters, shawls, gloves, boots aur razai. Thand se bachiye, cash on delivery ke saath.',
    ticker: 'Winter collection: stay warm with jackets, sweaters, shawls and boots',
    picksTitle: 'Sardi picks: thand se bachao',
    keywords: WARM,
    hero: 'from-[#06222F] via-[#0B4A5C] to-[#0B6B45]',
    tone: 'bg-gradient-to-r from-sky-50 via-cyan-50 to-sky-50 p-3 sm:p-4',
    glow: '#BAE6FD',
  },
  spring: {
    id: 'spring', name: 'Spring', urdu: 'Bahar', particles: 'petal',
    colors: ['#F9A8D4', '#FBCFE8', '#FDE68A', '#BBF7D0'],
    kicker: 'Bahar ka mausam',
    title: 'Bahar collection: halke rang, taza style',
    subtitle: 'Lawn, cotton suits, sandals aur light kapre. Mausam-e-bahar ke liye taza khareedari.',
    ticker: 'Spring collection: fresh colours, lawn suits and light wear',
    picksTitle: 'Bahar picks: halke aur taza',
    keywords: ['lawn', 'cotton', 'suit', 'kurta', 'kurti', 'sandal', 'slipper', 'chappal', 'sunglass', 'bag', 'watch', 'dupatta', 'scarf'],
    hero: 'from-[#0B4A32] via-[#0E8556] to-[#7BC96F]',
    tone: 'bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 p-3 sm:p-4',
    glow: '#FDE68A',
  },
  summer: {
    id: 'summer', name: 'Summer', urdu: 'Garmi', particles: '',
    colors: [],
    kicker: 'Garmi ka mausam',
    title: 'Garmi collection: thanda aur halka',
    subtitle: 'Cotton, lawn, sandals, caps, bottles aur garmi ki zaroorat ka har saman. Cash on delivery.',
    ticker: 'Summer collection: light cotton, lawn, sandals and cooling essentials',
    picksTitle: 'Garmi picks: thanda aur halka',
    keywords: ['lawn', 'cotton', 'sandal', 'slipper', 'chappal', 'cap', 'sunglass', 'bottle', 'cooler', 'fan', 'watch', 'kurta', 'shorts', 't-shirt', 'tshirt'],
    hero: 'from-[#073D28] via-[#0B6B45] to-[#F29F05]',
    tone: 'bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 p-3 sm:p-4',
    glow: '#FDE68A',
  },
};

// month 1-12 -> season id
const BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'summer', 'summer', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'winter'];

export function karachiMonth(date = new Date()) {
  try { return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', month: 'numeric' }).format(date)); } catch { return date.getMonth() + 1; }
}

// Returns the active season object, or null when the seasonal theme is switched off.
export function seasonFor(date = new Date()) {
  if (SEASON_MODE === 'off') return null;
  if (SEASONS[SEASON_MODE]) return SEASONS[SEASON_MODE];
  return SEASONS[BY_MONTH[karachiMonth(date) - 1]];
}

export const matchesSeason = (p, season) => {
  const text = `${p.name} ${p.category} ${(p.description || '').slice(0, 200)}`.toLowerCase();
  return season.keywords.some((k) => new RegExp(`\\b${k}`, 'i').test(text));
};
