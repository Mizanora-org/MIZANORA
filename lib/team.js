// THE MIZANORA TEAM - one place to edit who is who. The public /team page reads this file.
// Add a real person by copying a row below (name, role, line). Team roles with no single name stay as "team" rows, which is honest.

export const FOUNDER = {
  name: 'Muaaz Iqbal',
  role: 'Founder & Developer',
  city: 'Kasur, Punjab, Pakistan',
  emoji: '🛠️',
  // v36: the shop's OWN copies come first now - see lib/founderPhotos.js and public/img/muaaz/.
  // The links below are kept only as a last-resort fallback (used if the manifest is missing).
  // Left here because they are already indexed; self-hosted pictures are preferred everywhere.
  photos: [
    'https://i.ibb.co/Kj0c67jy/file-0000000071bc8211be27cfb9f09fc98a.png',
    'https://i.ibb.co/RpLFTKfG/file-00000000eca48208bff02ce8e3e3bdf0.png',
  ],
  // The page where all his pictures live (also in the image sitemap).
  gallery: '/muaaz-iqbal#photos',
  phone: '03062015326',          // the shop's WhatsApp support line (also in config)
  whatsapp: '923062015326',
  // Shown on /team, in the footer and in the about page. Keep it short.
  bio: 'Muaaz Iqbal is a developer, an AI researcher and a marketer from Kasur who thinks big. He built Mizanora from scratch: the website, the phone-friendly design, the AI assistant (Noor) with Urdu voice, the worker program, the admin AI manager and the zero-Firebase catalogue that keeps the shop running even when the free limit is finished. He is also studying ICS (Intermediate in Computer Science) at Islamia Graduate College and keeps learning, testing and improving Mizanora every day.',
  // The longer story used by the "Who is Muaaz Iqbal" blog posts.
  tags: ['Developer', 'AI researcher', 'Marketer', 'Founder of Mizanora', 'Student, ICS'],
  built: [
    'The whole Mizanora web app (Next.js)',
    'Assistant Noor: Urdu + English voice help',
    'Admin AI manager for running the shop',
    'Worker program: links, wallets, payouts, own prices',
    'Zero-Firebase catalogue (data/catalog files)',
  ],
};

// Team rows shown as cards. `icon` is a lucide icon name used by the page.
export const TEAM = [
  { icon: 'MessageCircle', name: 'Customer Support', role: 'WhatsApp support team', line: 'Order help, size and stock questions, delivery follow-up. One real person replies, not a robot.' },
  { icon: 'Package', name: 'Dispatch & Packing', role: 'Warehouse team', line: 'Checks every parcel before it leaves, packs glass and fragile items with extra care.' },
  { icon: 'Megaphone', name: 'Workers Programme', role: 'Worker leads & training', line: 'Approves new workers, shares caption and photo kits, keeps the programme fair.' },
  { icon: 'ShieldCheck', name: 'Quality & Photos', role: 'Catalogue team', line: 'Keeps photos honest, hides a product the moment its photo stops working, checks sizes and specs.' },
  { icon: 'Code2', name: 'Developers', role: 'Product & tools', line: 'Improves the assistant, the admin panel and the free-quota architecture every week.' },
  { icon: 'Heart', name: 'Community', role: 'Reviews & trust', line: 'Reads every customer review and passes real feedback straight to Muaaz.' },
];

// Where to find Muaaz Iqbal online (shown on /muaaz-iqbal, in its structured data and in the footer credit).
export const FOUNDER_LINKS = [
  ['LinkedIn', 'https://pk.linkedin.com/in/muaaz-iqbal-744b25430'],
  ['GitHub', 'https://github.com/muaaziqbalvip'],
  ['Asaan Lang', 'https://asaan-lang.vercel.app'],
  ['YouTube', 'https://www.youtube.com/@MuaazIqbalofficial'],
  ['X @MizanoraApps', 'https://x.com/MizanoraApps'],
  ['Instagram @mizanora', 'https://www.instagram.com/mizanora'],
];

export const CREDIT = `Built and maintained by ${FOUNDER.name} - ${FOUNDER.role} of Mizanora.`;

// Small helper for the page: initials for an avatar bubble.
export const initialsOf = (name) =>
  String(name || 'Mizanora')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('');
