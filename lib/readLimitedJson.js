// Parse untrusted JSON with a strict wire-size cap, including chunked requests without a
// Content-Length. Built-in Request.json() reads the entire attacker-controlled body first.
export async function readLimitedJson(req, maxBytes = 8192) {
  if (Number(req.headers.get('content-length')) > maxBytes) throw new Error('Request is too large');
  if (!req.body) throw new Error('Empty request');
  const reader = req.body.getReader();
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Request is too large');
      parts.push(Buffer.from(value));
    }
  } catch (e) { try { await reader.cancel(); } catch { /* ignore */ } throw e; }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
