// Discount tokens must never be signable with a public default, especially during a quota outage.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
delete process.env.DEAL_SECRET;
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.GEMINI_API_KEY;
const { makeDeal, dealOff, makeNeg, readNeg } = await import('../lib/deal.js');
const oldPublicToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = crypto.createHash('sha256').update('mz-deal|mizanora').digest();
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
};
const forged = oldPublicToken({ t: 'deal', pid: 'sku-1', base: 1500, off: 1000, exp: Date.now() + 3600000 });
assert.equal(dealOff(forged, 'sku-1', 1500), 0, 'old public secret must not sign a valid discount');
assert.deepEqual(readNeg(oldPublicToken({ t: 'neg', asks: { sku: 999 }, exp: Date.now() + 3600000 })), {}, 'old key cannot forge bargaining history');
const legit = makeDeal('sku-1', 250, 1500);
assert.equal(dealOff(legit, 'sku-1', 1500), 250);
assert.equal(dealOff(legit, 'sku-1', 1000), 0, 'a price change invalidates old discounts');
assert.equal(dealOff(legit, 'sku-2', 1500), 0, 'discount is product-bound');
assert.equal(dealOff(`${legit}.extra`, 'sku-1', 1500), 0, 'malformed token rejected');
assert.equal(dealOff('A'.repeat(20000), 'sku-1'), 0, 'huge token rejected');
assert.deepEqual(readNeg(makeNeg({ 'sku-1': 2 })), { 'sku-1': 2 });
console.log('Assistant deals: public fallback forgery denied; legitimate product-bound discounts and negotiations work.');
