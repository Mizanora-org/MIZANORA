// Client-side Meta Pixel helpers. Every call is a safe no-op when the Pixel ID is not set.
import { trackEvent } from './track';
export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
export const pixelEnabled = Boolean(PIXEL_ID);

export function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function fbq(...args) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') window.fbq(...args);
}

export function pageView() {
  if (pixelEnabled) fbq('track', 'PageView');
}

// Browser event + the same event sent from the server (Conversions API) with one shared eventID for de-duplication.
function track(name, params, serverToo = true) {
  if (!pixelEnabled) return;
  const eventId = newId();
  fbq('track', name, params, { eventID: eventId });
  if (serverToo) {
    try {
      fetch('/api/meta', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: name, eventId, sourceUrl: window.location.href,
          customData: params, fbp: getCookie('_fbp'), fbc: getCookie('_fbc'),
        }),
      });
    } catch (_) { /* tracking must never break the shop */ }
  }
}

const money = (n) => Number(n) || 0;

export function viewContent(p) {
  trackEvent('pv', p.id);
  track('ViewContent', { content_ids: [p.id], content_name: p.name, content_type: 'product', value: money(p.price), currency: 'PKR' });
}

export function addToCart(p, qty = 1) {
  trackEvent('cart', p.id);
  track('AddToCart', { content_ids: [p.id], content_name: p.name, content_type: 'product', value: money(p.price) * qty, currency: 'PKR' });
}

export function addToWishlist(p) {
  trackEvent('ev', 'wish');
  track('AddToWishlist', { content_ids: [p.id], content_name: p.name, content_type: 'product', value: money(p.price), currency: 'PKR' });
}

export function search(term) {
  track('Search', { search_string: String(term).slice(0, 80), content_type: 'product' });
}

export function completeRegistration() {
  track('CompleteRegistration', { status: true, content_name: 'Mizanora account' });
}

export function contact(source = 'whatsapp') {
  trackEvent('ev', 'wa');
  track('Contact', { content_name: source });
}

export function initiateCheckout(items, total) {
  trackEvent('ev', 'checkout');
  track('InitiateCheckout', {
    content_ids: items.map((i) => i.id), content_type: 'product',
    contents: items.map((i) => ({ id: i.id, quantity: i.qty })),
    num_items: items.reduce((s, i) => s + i.qty, 0), value: money(total), currency: 'PKR',
  });
}

// Purchase: fired once per order, ONLY from the thank-you page. The server sends the matching
// Conversions API event from /api/orders using eventID = orderId, so Meta de-duplicates the two.
export function purchase(order) {
  if (!pixelEnabled || !order || !order.orderId) return;
  const key = `mz_px_purchase_${order.orderId}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch (_) { /* ignore */ }
  fbq('track', 'Purchase', {
    value: money(order.total), currency: 'PKR',
    content_ids: order.items.map((i) => i.id), content_type: 'product',
    contents: order.items.map((i) => ({ id: i.id, quantity: i.qty })),
    num_items: order.items.reduce((s, i) => s + i.qty, 0), order_id: order.orderId,
  }, { eventID: order.orderId });
}
