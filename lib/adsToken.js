// Signed impression/click tokens: {keyId}.{campaignId}.{expiresMs}.{hmac}.
// Never fall back to a PUBLIC constant: that would let anyone forge stats writes and drain
// Firestore quota. The Admin SDK credentials are stable across production instances; an
// ephemeral key is used only for local/no-credentials mode (where serving ads is off anyway).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const localSecret = randomBytes(32);
const adsSecret = () => process.env.AD_SECRET || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || localSecret;

export function signToken(keyId, campaignId, ttlMs = 60000, secret = '') {
  const exp = Date.now() + ttlMs;
  const mac = createHmac('sha256', secret || adsSecret()).update(`${keyId}.${campaignId}.${exp}`).digest('base64url');
  return `${keyId}.${campaignId}.${exp}.${mac}`;
}

export function verifyToken(token, secret = '') {
  if (typeof token !== 'string' || token.length > 256) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [keyId, campaignId, exp, mac] = parts;
  const expiry = Number(exp);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(keyId) || !/^[a-zA-Z0-9_-]{1,80}$/.test(campaignId)
    || !/^\d{13}$/.test(exp) || !Number.isSafeInteger(expiry) || Date.now() > expiry
    || expiry > Date.now() + 2 * 60 * 60_000 + 60_000 || !/^[a-zA-Z0-9_-]{43}$/.test(mac)) return null;
  const want = createHmac('sha256', secret || adsSecret()).update(`${keyId}.${campaignId}.${exp}`).digest('base64url');
  const a = Buffer.from(want), b = Buffer.from(mac);
  return a.length === b.length && timingSafeEqual(a, b) ? { keyId, campaignId } : null;
}
