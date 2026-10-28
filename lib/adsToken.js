// Signed impression/click tokens: {keyId}.{campaignId}.{expiresMs}.{hmac}
// The track endpoints verify the HMAC, so campaign stats cannot be invented by
// calling them directly. Kept in its own file (node:crypto only) so tests and
// routes can import it without pulling in next/cache or firebase-admin.
import { createHmac } from 'node:crypto';

const adsSecret = () => process.env.AD_SECRET || 'mizanora-ads-v1';

export function signToken(keyId, campaignId, ttlMs = 60000, secret = '') {
  const exp = Date.now() + ttlMs;
  const mac = createHmac('sha256', secret || adsSecret()).update(`${keyId}.${campaignId}.${exp}`).digest('base64url');
  return `${keyId}.${campaignId}.${exp}.${mac}`;
}

export function verifyToken(token, secret = '') {
  try {
    const [keyId, campaignId, exp, mac] = String(token || '').split('.');
    if (!keyId || !campaignId || !exp || !mac) return null;
    if (Date.now() > Number(exp)) return null;
    const want = createHmac('sha256', secret || adsSecret()).update(`${keyId}.${campaignId}.${exp}`).digest('base64url');
    if (want !== mac) return null;
    return { keyId, campaignId };
  } catch { return null; }
}
