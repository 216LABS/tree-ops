import { deflateSync } from 'node:zlib';

/** A tiny PNG encoder for demo pictures (no image library). Not used for real photos. */
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf: Uint8Array) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(Buffer.from(type, 'ascii'), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function makePng(w: number, h: number, px: (x: number, y: number) => [number, number, number]): Uint8Array {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** A simple yard picture: sky, lawn, a trunk and a crown, varied by seed. */
export function demoTreePng(seed: number, w = 480, h = 360): Uint8Array {
  const cx = w * (0.3 + ((seed * 37) % 40) / 100);
  const crownR = h * (0.22 + ((seed * 13) % 10) / 100);
  const crownY = h * 0.38;
  const hue = (seed * 53) % 40;
  return makePng(w, h, (x, y) => {
    const dx = x - cx;
    const dy = y - crownY;
    if (dx * dx + dy * dy < crownR * crownR) return [40 + hue, 110 + hue, 45];
    if (Math.abs(dx) < w * 0.025 && y > crownY && y < h * 0.8) return [92, 64, 40];
    if (y > h * 0.72) return [86, 140, 60];
    return [150 + Math.round((y / h) * 60), 190 + Math.round((y / h) * 40), 230];
  });
}
