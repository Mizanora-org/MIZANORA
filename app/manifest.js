export default function manifest() {
  return {
    id: '/',
    name: 'MIZANORA - Shop Smart. Shop Halal.',
    short_name: 'Mizanora',
    description: 'Pakistan ka online store: 50,000+ products, cash on delivery, AI voice assistant Noor aur worker programme.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#F2F4EF',
    theme_color: '#0B6B45',
    lang: 'en-PK',
    dir: 'ltr',
    categories: ['shopping', 'lifestyle'],
    prefer_related_applications: false,
    launch_handler: { client_mode: 'navigate-existing' },
    handle_links: 'preferred',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Shop all products', short_name: 'Shop', url: '/products?source=shortcut', description: 'Browse the whole catalogue' },
      { name: 'My cart', short_name: 'Cart', url: '/cart?source=shortcut', description: 'Finish your order' },
      { name: 'Reels: watch and shop', short_name: 'Reels', url: '/reels?source=shortcut', description: 'Short product videos' },
      { name: 'Track my order', short_name: 'Track', url: '/track?source=shortcut', description: 'Where is my parcel' },
      { name: 'Earn with us', short_name: 'Earn', url: '/worker?source=shortcut', description: 'Worker dashboard' },
    ],
  };
}
