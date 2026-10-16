// THE MIZANORA TEAM - one place to edit who is who. The public /team page reads this file.
// Add a real person by copying a row below (name, role, line). Team roles with no single name stay as "team" rows, which is honest.

export const FOUNDER = {
  name: 'Muaaz Iqbal',
  role: 'Founder & Developer',
  city: 'Kasur, Punjab, Pakistan',
  emoji: '🛠️',
  // Shown on /team, in the footer and in the about page. Keep it short.
  bio: 'Muaaz Iqbal built Mizanora from scratch: the website, the phone-friendly design, the AI assistant (Noor), the worker program and the zero-Firebase catalogue that keeps the shop running even when the free limit is finished. Still the person who ships every update.',
  built: [
    'The whole Mizanora web app (Next.js)',
    'Assistant Noor: Urdu + English voice help',
    'Worker program: links, wallets, payouts',
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

export const CREDIT = `Built and maintained by ${FOUNDER.name} - ${FOUNDER.role} of Mizanora.`;

// Small helper for the page: initials for an avatar bubble.
export const initialsOf = (name) =>
  String(name || 'Mizanora')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('');
