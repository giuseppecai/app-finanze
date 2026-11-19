// Genera le icone PNG dell'app (una busta bianca su fondo accento) senza dipendenze.
// Uso: node scripts/make-icons.mjs  → scrive in public/
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x0e, 0x6b, 0x5c];
const FG = [0xff, 0xff, 0xff];

// Geometria in unità 24×24, come l'icona "Buste" della tab bar.
const RECT = { x: 3, y: 6, w: 18, h: 13, r: 2 };
const FLAP = [[3, 9], [12, 14], [21, 9]];
const STROKE = 2;

function sdRoundRect(px, py) {
  const cx = RECT.x + RECT.w / 2, cy = RECT.y + RECT.h / 2;
  const qx = Math.abs(px - cx) - (RECT.w / 2 - RECT.r);
  const qy = Math.abs(py - cy) - (RECT.h / 2 - RECT.r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - RECT.r;
}

function distSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inked(u, v) {
  if (Math.abs(sdRoundRect(u, v)) <= STROKE / 2) return true;
  for (let i = 0; i < FLAP.length - 1; i++) {
    if (distSegment(u, v, FLAP[i], FLAP[i + 1]) <= STROKE / 2) return true;
  }
  return false;
}

// iconFraction = quota del lato occupata dalla busta (18 unità)
function render(size, iconFraction) {
  const k = (size * iconFraction) / 18; // pixel per unità
  const ox = size / 2 - 12 * k, oy = size / 2 - 12.5 * k;
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filtro "none"
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS - ox) / k;
          const v = (y + (sy + 0.5) / SS - oy) / k;
          if (inked(u, v)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  return png(size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('apple-touch-icon.png', out), render(180, 0.56));
writeFileSync(new URL('pwa-192.png', out), render(192, 0.56));
writeFileSync(new URL('pwa-512.png', out), render(512, 0.56));
writeFileSync(new URL('pwa-maskable-512.png', out), render(512, 0.46));
console.log('Icone scritte in public/');
