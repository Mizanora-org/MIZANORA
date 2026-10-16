import { inAppBrowser } from './authErrors';

// MICROPHONE, DONE PROPERLY.
// Browsers only show the permission popup when the page really asks for the microphone, so the assistant asks with
// getUserMedia first (that is also what makes the "Allow" popup appear on the first tap), remembers the answer, and
// explains in plain Roman Urdu what to do when it is blocked.
export const recognizer = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const micSupported = () => Boolean(recognizer());
export const isSecure = () => (typeof window === 'undefined' ? true : window.isSecureContext !== false);

// 'granted' | 'denied' | 'prompt' | 'unknown' (browsers without the Permissions API)
export async function micPermission() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
    const s = await navigator.permissions.query({ name: 'microphone' });
    return s.state || 'unknown';
  } catch { return 'unknown'; }
}

// Ask for the microphone for real (this is what pops the Allow dialog), then release it at once.
// The voice recogniser opens its own stream afterwards, so keeping this one would only drain the battery.
export async function askMic() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, reason: 'unsupported' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    return { ok: true };
  } catch (e) {
    const name = String((e && e.name) || '');
    const reason = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nodevice'
        : name === 'NotReadableError' || name === 'AbortError' ? 'busy' : 'error';
    return { ok: false, reason, name };
  }
}

// Plain-language help for every case, with the exact steps for this device.
export function micHelp(reason) {
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const app = typeof window !== 'undefined' && inAppBrowser();
  const browser = ios ? 'Safari' : 'Chrome';
  const steps = [];
  if (app) steps.push('Aap Facebook / Instagram ke andar wale browser me hain. Upar ke ⋯ menu se “Open in ' + browser + '” chunein - in-app browser me mic aksar band hota hai.');
  if (reason === 'denied') {
    steps.push(`${ios ? 'Safari' : 'Chrome'} me address bar ke bagal wale icon (🔒 / ⓘ / AA) par tap karein.`);
    steps.push('“Microphone” ko **Allow** kar dein, phir is page ko refresh karein.');
    if (ios) steps.push('iPhone: Settings → Safari → Microphone → Ask (ya Allow).');
    else steps.push('Android: Settings → Apps → Chrome → Permissions → Microphone → Allow.');
  } else if (reason === 'nodevice') {
    steps.push('Is device par koi microphone nahi mila. Headphone ya mic laga kar dobara koshish karein.');
  } else if (reason === 'busy') {
    steps.push('Microphone kisi doosre app ne pakra hua hai (call, recording app). Wo band karein aur retry karein.');
  } else if (reason === 'unsupported') {
    steps.push('Is browser me awaaz se sunna support nahi karta. Chrome (Android) ya Safari (iPhone) istemal karein.');
  } else {
    steps.push('Ek dafa page refresh karein, phir mic button dabayein aur popup par **Allow** karein.');
  }
  steps.push('Aap chahein to bas likh kar bhi pooch sakte hain - assistant kaam karti rahegi.');
  return { title: reason === 'denied' ? 'Microphone band hai' : 'Microphone nahi chala', steps };
}

// Speech-recognition error codes -> something a shopper understands.
export function srMessage(code) {
  const map = {
    'not-allowed': 'Microphone ki ijazat nahi mili. Mic button dabayein aur Allow karein.',
    'service-not-allowed': 'Is browser me voice service band hai - kisi doosre browser me kholein ya likh kar poochein.',
    'audio-capture': 'Microphone nahi mila. Mic ya headphone check karein.',
    'no-speech': 'Awaz nahi aayi - thora qareeb se dobara boliye.',
    network: 'Internet thora kamzor hai, dobara boliye ya likh dein.',
    aborted: '',
    busy: 'Ruk kar dobara boliye.',
  };
  return map[code] || 'Awaaz nahi sun saki, dobara koshish karein.';
}
