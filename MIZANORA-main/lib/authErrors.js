// Plain-language sign-in errors for customers and the admin.
const H = {
  'auth/unauthorized-domain': (h) => `This website (${h}) is not in Firebase "Authorized domains". Firebase Console > Authentication > Settings > Authorized domains > Add domain.`,
  'auth/operation-not-allowed': () => 'This sign-in method is switched off. Firebase Console > Authentication > Sign-in method > enable Google and Email/Password.',
  'auth/invalid-api-key': () => 'NEXT_PUBLIC_FIREBASE_API_KEY in Vercel is missing or wrong.',
  'auth/configuration-not-found': () => 'Authentication is not started yet. Firebase Console > Authentication > Get started.',
  'auth/invalid-credential': () => 'Wrong email or password.',
  'auth/wrong-password': () => 'Wrong password.',
  'auth/user-not-found': () => 'No account with this email. Create one first.',
  'auth/invalid-email': () => 'This email address is not valid.',
  'auth/email-already-in-use': () => 'This email already has an account. Sign in instead, or reset your password.',
  'auth/weak-password': () => 'Choose a stronger password (at least 6 characters).',
  'auth/user-disabled': () => 'This account is disabled. Please contact support.',
  'auth/too-many-requests': () => 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': () => 'No internet, or the connection was blocked. Try again.',
  'auth/popup-blocked': () => 'The browser blocked the Google window. Allow pop-ups and try again.',
  'auth/web-storage-unsupported': () => 'This browser blocks storage. Open the site in Chrome or Safari (not inside Facebook/Instagram).',
};
export function explain(e) {
  const code = (e && e.code) || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const fn = H[code];
  return `${fn ? fn(host) : 'Something went wrong.'} [${code || (e && e.message) || 'unknown'}]`;
}
export const inAppBrowser = () => typeof navigator !== 'undefined' && /FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(navigator.userAgent);
