const KEY = 'mz_attr';
const clip = (v) => String(v || '').slice(0, 80);
const SOCIAL = [[/facebook|fb\.|l\.facebook|m\.facebook/i, 'facebook'], [/instagram/i, 'instagram'], [/tiktok/i, 'tiktok'], [/youtube|youtu\.be/i, 'youtube'], [/google\./i, 'google'], [/whatsapp|wa\.me/i, 'whatsapp'], [/bing\./i, 'bing']];

export function saveAttribution(search, referrer) {
  const p = new URLSearchParams(search || '');
  let source = clip(p.get('utm_source') || (p.get('fbclid') ? 'facebook' : p.get('gclid') ? 'google' : p.get('ttclid') ? 'tiktok' : p.get('ref')));
  let medium = clip(p.get('utm_medium') || (p.get('fbclid') || p.get('gclid') || p.get('ttclid') ? 'paid' : ''));
  if (!source && referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (host && !host.includes(window.location.hostname)) { source = (SOCIAL.find(([re]) => re.test(host)) || [0, host.replace(/^www\./, '')])[1]; medium = medium || 'referral'; }
    } catch (_) {}
  }
  if (!source) return;
  const touch = { source, medium, campaign: clip(p.get('utm_campaign')), content: clip(p.get('utm_content')), at: Date.now() };
  const cur = readAttribution();
  const first = cur.first && Date.now() - cur.first.at < 30 * 864e5 ? cur.first : touch;
  try { localStorage.setItem(KEY, JSON.stringify({ first, last: touch })); } catch (_) {}
}

export function readAttribution() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
