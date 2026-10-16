import crypto from 'crypto';
import { NextResponse, after } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { validateCustomer, normalizePhone } from '@/lib/validate';
import { SITE, shippingFor } from '@/lib/config';
import { sendCapi } from '@/lib/capi';
import { DEAL_MAX_QTY, dealOff } from '@/lib/deal';
import { priceCoupon } from '@/lib/coupons';
import { optionsOf, validVariant } from '@/lib/options';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { findWorkerByCode } from '@/lib/workerAuth';
import { getWorkerSettings } from '@/lib/workerSettings';
import { PAY_METHODS, payMethod, prepaidOff, cleanPayRef } from '@/lib/payments';
import { archiveDocs } from '@/lib/archive';
import { cleanWorkerCode, effectiveTier, lineEarning, MAX_MARKUP_PCT } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Best-effort anti-spam (per server instance): only orders that were really placed are counted, so typing mistakes,
// coupon tries and test attempts can never lock a real customer out. Real protection is validation + honeypot + server-side pricing.
const placed = new Map();
const recentCount = (ip) => { const now = Date.now(); const a = (placed.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000); placed.set(ip, a); return a.length; };
const countOrder = (ip) => { const a = placed.get(ip) || []; a.push(Date.now()); placed.set(ip, a); if (placed.size > 5000) placed.clear(); };

const newOrderId = () => `MZ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const fail = (msg, status = 400) => NextResponse.json({ ok: false, error: msg }, { status });

export async function POST(req) {
  if (!adminReady()) return fail('The store is not fully set up yet. Please contact support on WhatsApp.', 503);

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (recentCount(ip) >= 12) return fail('You have placed several orders in a short time. Please wait a few minutes, or contact support on WhatsApp if you need more.', 429);

  let body;
  try { body = await req.json(); } catch { return fail('Invalid request'); }

  // Bots fill hidden fields. Pretend success so they do not retry.
  if (body.website) return NextResponse.json({ ok: true, order: { orderId: 'MZ-00000000', items: [], customer: {}, total: 0, shipping: 0 } });

  const { ok, clean } = validateCustomer(body.customer);
  if (!ok) return fail('Please check your delivery details and try again.');

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 15) : [];
  if (!rawItems.length) return fail('Your cart is empty.');

  try {
    const db = adminDb();
    const ids = [...new Set(rawItems.map((i) => String(i.id || '')))].filter(Boolean);
    if (!ids.length) return fail('Your cart is empty.');
    const snaps = await db.getAll(...ids.map((id) => db.collection('products').doc(id)));
    const byId = Object.fromEntries(snaps.filter((s) => s.exists).map((s) => [s.id, s.data()]));
    // Old products live in the archive files (not in Firebase): their price and options come from there. A live copy always wins.
    const missing = ids.filter((id) => !byId[id]);
    if (missing.length) { try { Object.assign(byId, await archiveDocs(missing)); } catch (e) { console.error('archive lookup failed', e.message); } }

    // Worker link (?ref=CODE): the worker is looked up here, never trusted from the browser.
    let worker = null;
    try { worker = await findWorkerByCode(db, cleanWorkerCode(body.ref)); } catch (e) { console.error('worker lookup failed', e.message); }
    const settings = await getWorkerSettings(db);
    if (!settings.programOn) worker = null;
    const wTier = worker ? effectiveTier(worker) : null;
    const affMeta = {}; // per-product affiliate switch set by the admin (kept off the order document)

    // Prices come from the database, never from the browser.
    const items = [];
    for (const r of rawItems) {
      const p = byId[String(r.id)];
      const qty = Math.floor(Number(r.qty));
      if (!p || p.active === false) return fail('One of the products is no longer available. Please refresh your cart.');
      if (p.inStock === false) return fail(`${p.name} is currently sold out.`);
      if (!(qty >= 1 && qty <= 10)) return fail('Invalid quantity.');
      const size = String(r.size || '');
      if (!validVariant(optionsOf(p), size)) return fail(`Please choose the options (for example colour and size) for ${p.name} again.`);
      // Assistant deal: a signed token made by our own server for this product (never trusted from the browser). Up to 5 pieces.
      const off = r.deal ? dealOff(r.deal, String(r.id)) : 0;
      if (r.deal && !off) return fail(`The special price for ${p.name} has expired. Please remove it from the cart and add it again.`);
      if (off && qty > DEAL_MAX_QTY) return fail(`The special price for ${p.name} is valid for up to ${DEAL_MAX_QTY} pieces.`);
      const shopPrice = Math.max(1, (Number(p.price) || 0) - off);
      affMeta[String(r.id)] = { affOn: p.affOn !== false, affRate: Number(p.affRate) || 0 };
      // An Elite worker's own profit per piece (capped), added to the price only for customers who came through that worker's link.
      const markup = wTier && wTier.custom ? Math.max(0, Math.min(Math.floor(Number(worker.markups && worker.markups[String(r.id)]) || 0), Math.floor((shopPrice * MAX_MARKUP_PCT) / 100))) : 0;
      items.push({ id: String(r.id), slug: String(r.id), name: off ? `${p.name} (special price, Rs ${off} off)` : p.name, dealOff: off, price: shopPrice + markup, shopPrice, markup, qty, size, image: (p.images && p.images[0]) || '' });
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = shippingFor(subtotal);

    // Optional: a signed-in customer's order is linked to their account so it shows in their order history.
    let uid = '', email = '';
    const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (tok) { try { const d = await getAuth(adminApp()).verifyIdToken(tok); uid = d.uid; email = String(d.email || '').toLowerCase(); } catch { /* guest order */ } }

    if (body.coupon && items.some((i) => i.dealOff)) return fail('A promo code cannot be used together with a special assistant price. Please remove one of them.');

    // Optional promo code, re-checked here with real prices (and the customer's phone for one-order-per-phone codes).
    let discount = 0, couponCode = '', couponOwner = '', couponBase = 0, couponLines = [];
    const phoneInfo = normalizePhone(clean.phone);
    if (body.coupon) {
      const r = await priceCoupon(db, body.coupon, items, { phoneLocal: phoneInfo ? phoneInfo.local : '' });
      if (!r.ok) return fail(r.error);
      discount = r.discount; couponCode = r.code; couponOwner = r.owner; couponBase = r.base; couponLines = r.lines;
    }
    // Payment method (cash on delivery, or a prepaid wallet / bank transfer that the admin switched on).
    const pm = payMethod(body.payMethod || 'COD');
    if (!pm) return fail('That payment method is not available. Please choose another one.');
    const payRef = pm.prepaid ? cleanPayRef(body.payRef) : '';
    if (pm.prepaid && !payRef) return fail('Please enter the transaction ID of your payment (at least 6 characters).');
    const prepaidDiscount = prepaidOff(subtotal - discount, pm.id);
    const total = subtotal - discount - prepaidDiscount + shipping;

    // Who earns on this order?
    //  1) the worker whose link the customer used, or
    //  2) (only if the admin switched "repeat customers" ON) the worker whose link this customer first came through, within the repeat window.
    // Never paid when: a promo code is used (no stacking), the worker orders for themselves, or the phone is the worker's own.
    const phoneKey = phoneInfo ? phoneInfo.local : '';
    let owner = worker, repeat = false, newBinding = false;
    if (settings.programOn) {
      if (!owner && settings.repeatCredit && phoneKey) {
        try {
          const b = await db.collection('workerCustomers').doc(phoneKey).get();
          if (b.exists && Date.now() - (b.data().atMs || 0) <= settings.repeatDays * 864e5) {
            const ws = await db.collection('workers').doc(b.data().workerId).get();
            if (ws.exists && ws.data().status === 'approved') { owner = { id: ws.id, ...ws.data() }; repeat = true; }
          }
        } catch (e) { console.error('repeat lookup failed', e.message); }
      }
      if (worker && phoneKey) {
        try {
          const b = await db.collection('workerCustomers').doc(phoneKey).get();
          // A brand-new customer (no earlier order with this phone) who came through a link now belongs to that worker.
          if (!b.exists) newBinding = (await db.collection('orders').where('customer.phone', '==', clean.phone).limit(1).get()).empty;
        } catch (e) { console.error('binding check failed', e.message); }
      }
    }
    const oTier = owner ? effectiveTier(owner) : null;
    let commission = null;
    if (owner && oTier && !couponCode && owner.uid !== uid && !(phoneInfo && owner.phone === phoneInfo.local)) {
      const lines = items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, ...lineEarning(oTier, i.shopPrice, i.qty, repeat ? 0 : i.markup, affMeta[i.id]) }));
      const amount = lines.reduce((s, l) => s + l.total, 0);
      if (amount > 0) commission = { amount, lines, rate: oTier.rate, tier: oTier.key, repeat };
    }
    const earner = commission ? owner : null;

    const now = Date.now();
    const base = {
      status: 'Pending', customer: clean, items, subtotal, discount, couponCode, couponOwner, couponBase, couponLines, couponTracked: Boolean(couponCode), shipping, total, paymentMethod: pm.id, paymentRef: payRef, paymentStatus: pm.prepaid ? 'awaiting-verification' : 'cod', prepaidDiscount, uid, email,
      createdAt: FieldValue.serverTimestamp(), createdAtMs: now, trackingId: '',
      workerId: earner ? earner.id : '', workerCode: earner ? earner.code : '', workerCommission: commission ? commission.amount : 0,
    };

    let orderId = '';
    for (let attempt = 0; attempt < 4 && !orderId; attempt++) {
      const id = newOrderId();
      try { await db.collection('orders').doc(id).create({ orderId: id, ...base }); orderId = id; }
      catch (e) { if (attempt === 3) throw e; } // ID collision is extremely unlikely; retry
    }

    countOrder(ip);
    if (commission) {
      try {
        const batch = db.batch();
        batch.set(db.collection('commissions').doc(orderId), {
          orderId, workerId: earner.id, workerCode: earner.code, repeat: commission.repeat, amount: commission.amount, rate: commission.rate, tier: commission.tier,
          lines: commission.lines, city: clean.city, status: 'pending', createdAtMs: now,
        });
        batch.set(db.collection('workers').doc(earner.id), { stats: { orders: FieldValue.increment(1), ...(commission.repeat ? { repeatOrders: FieldValue.increment(1) } : {}) } }, { merge: true });
        if (newBinding && worker && worker.id === earner.id && phoneKey) batch.set(db.collection('workerCustomers').doc(phoneKey), { workerId: worker.id, workerCode: worker.code, firstOrderId: orderId, atMs: now });
        await batch.commit();
      } catch (e) { console.error('commission failed', e.message); }
    }
    // Promo code bookkeeping (best effort, never blocks the order): how many orders, sales, discount given and per-product sales.
    if (couponCode) {
      try {
        const ref = db.collection('coupons').doc(couponCode);
        const inc = FieldValue.increment;
        const byProduct = {};
        for (const l of couponLines) byProduct[l.id] = { qty: inc(l.qty), amount: inc(l.amount) };
        await ref.set({ used: inc(1), revenue: inc(couponBase - discount), discountTotal: inc(discount), byProduct, lastUsedAtMs: now }, { merge: true });
        if (phoneInfo) await ref.collection('redeemed').doc(String(phoneInfo.local)).set({ orderId, atMs: now });
      } catch (e) { console.error('promo counters failed', e.message); }
    }

    // Server-side Purchase (Conversions API). Same eventID as the browser Purchase so Meta counts it once.
    const phone = normalizePhone(clean.phone);
    after(() => sendCapi({
      eventName: 'Purchase', eventId: orderId, sourceUrl: body.sourceUrl || SITE.url,
      customData: {
        value: total, currency: 'PKR', order_id: orderId, content_type: 'product',
        content_ids: items.map((i) => i.id), contents: items.map((i) => ({ id: i.id, quantity: i.qty })),
        num_items: items.reduce((s, i) => s + i.qty, 0),
      },
      ip, userAgent: req.headers.get('user-agent') || '', fbp: body.fbp, fbc: body.fbc,
      phoneWa: phone ? phone.wa : '', fullName: clean.name, city: clean.city, email, uid,
    }));

    return NextResponse.json({
      ok: true,
      order: { orderId, createdAtMs: now, status: 'Pending', customer: clean, items, subtotal, discount, couponCode, shipping, total, paymentMethod: pm.id, prepaidDiscount },
    });
  } catch (e) {
    console.error('order failed', e && e.message);
    return fail('Our order system is having a problem right now. Your order was not placed. Please try again in a minute, or send it to support on WhatsApp.', 500);
  }
}
