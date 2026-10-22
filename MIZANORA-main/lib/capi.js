import crypto from 'crypto';

const sha = (v) => (v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined);

// Meta Conversions API (server-side tracking). Safe no-op if not configured.
export async function sendCapi({ eventName, eventId, sourceUrl, customData, ip, userAgent, fbp, fbc, phoneWa, fullName, city, email, uid }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return;

  const [first, ...rest] = String(fullName || '').trim().split(/\s+/);
  const user = {
    client_ip_address: ip || undefined,
    client_user_agent: userAgent || undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    ph: phoneWa ? [sha(phoneWa)] : undefined,
    fn: first ? [sha(first)] : undefined,
    ln: rest.length ? [sha(rest.join(' '))] : undefined,
    ct: city ? [sha(city.replace(/\s+/g, ''))] : undefined,
    country: [sha('pk')],
    em: email ? [sha(email)] : undefined,
    external_id: uid ? [sha(uid)] : phoneWa ? [sha(phoneWa)] : undefined,
  };
  const body = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: sourceUrl,
      action_source: 'website',
      user_data: user,
      custom_data: customData,
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('CAPI error', res.status, await res.text());
  } catch (e) {
    console.error('CAPI failed', e.message);
  }
}
