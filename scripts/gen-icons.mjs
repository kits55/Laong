// สร้างไอคอน PNG ของแอป (ลายหยดละอองสามหยดขนาดลดหลั่น) โดยไม่ใช้ไลบรารีภาพ
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const BG = [0x0a, 0x51, 0x59];
const FG = [0xff, 0xff, 0xff];
// วงกลมในพื้นที่ 0..1 (x, y, r, ความทึบ)
const DROPS = [[0.36, 0.40, 0.25, 1], [0.66, 0.60, 0.15, 0.82], [0.83, 0.82, 0.085, 0.62]];

function render(size, pad) {
  const px = Buffer.alloc(size * size * 4);
  const S = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + 0.5) / S) / size, v = (y + (sy + 0.5) / S) / size;
      // ย่อลายเข้ากลางตาม pad (maskable ต้องเว้นขอบ)
      const uu = (u - 0.5) / (1 - 2 * pad) + 0.5, vv = (v - 0.5) / (1 - 2 * pad) + 0.5;
      let a = 0;
      for (const [cx, cy, cr, op] of DROPS) {
        const d = Math.hypot(uu - cx, vv - cy);
        if (d <= cr) a = Math.max(a, op);
      }
      r += BG[0] * (1 - a) + FG[0] * a; g += BG[1] * (1 - a) + FG[1] * a; b += BG[2] * (1 - a) + FG[2] * a;
    }
    const i = (y * size + x) * 4, n = S * S;
    px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n; px[i + 3] = 255;
  }
  return px;
}

function png(size, px) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size, pad] of [['icon-192.png', 192, 0.06], ['icon-512.png', 512, 0.06], ['icon-maskable-512.png', 512, 0.2]]) {
  writeFileSync(join(out, name), png(size, render(size, pad)));
  console.log('สร้าง', name);
}
