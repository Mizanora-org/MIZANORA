// Tiny ZIP writer for the browser (no compression, no library). Files: [{ name, data: string | Uint8Array }] -> Blob.
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const u16 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255]);
const u32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };

export function makeZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const head = cat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name);
    parts.push(head, data);
    central.push(cat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name));
    offset += head.length + data.length;
  }
  const cd = cat(...central);
  const end = cat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0));
  return new Blob([...parts, cd, end], { type: 'application/zip' });
}
