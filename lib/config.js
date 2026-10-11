export const SITE = {
  name: 'MIZANORA',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://mizanora.vercel.app').replace(/\/$/, ''),
  tagline: 'Shop Smart. Shop Halal.',
  description:
    'Mizanora is a Pakistani online store. Order quality products with cash on delivery across Pakistan, or order on WhatsApp. Shop smart. Shop halal.',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '923062015326',
  email: 'mezanora.market@gmail.com',
  city: 'Kasur, Punjab, Pakistan',
  currency: 'PKR',
  shippingFee: Number(process.env.NEXT_PUBLIC_SHIPPING_FEE || 0),
  // Optional: delivery becomes free when the cart subtotal reaches this amount (0 = off). Example: 5000
  freeShippingOver: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_OVER || 0),
  adminEmails: (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean),
  announcement: process.env.NEXT_PUBLIC_ANNOUNCEMENT || 'Cash on delivery across Pakistan  |  Honest prices  |  Support on WhatsApp',
  social: [
    { id: 'whatsapp', label: 'WhatsApp Support', url: 'https://wa.me/923062015326', note: 'Chat with our support team' },
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/mezanora.market', note: '@mezanora.market' },
    { id: 'facebook', label: 'Facebook', url: process.env.NEXT_PUBLIC_FACEBOOK_URL || '', note: 'Mezanora page' },
    { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@mizanora.market', note: '@mizanora.market' },
    { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@MIZANORA', note: 'MIZANORA MARKET' },
  ],
};

export const waLink = (msg = '') =>
  `https://wa.me/${SITE.whatsapp}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;

export const absUrl = (path = '/') => `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;

// Delivery charge for a cart subtotal (before any promo discount). Used by the cart, checkout AND the server, so they always agree.
export const shippingFor = (subtotal) => (SITE.freeShippingOver > 0 && subtotal >= SITE.freeShippingOver ? 0 : SITE.shippingFee);
