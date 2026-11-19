// ตรวจข้อความหน้าจอ: ห้ามใช้ em dash และ en dash (กติกาข้อ 8.5 ของบรีฟ) ในโค้ดของแอป
// ข้ามไฟล์สูตรต้นฉบับ (src/core/original, physics.gen.js) เพราะห้ามแก้ ข้อความจากสูตรถูกแปลงตอนแสดงผลด้วย cleanText
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SKIP = ['original', 'physics.gen.js', 'node_modules'];
let bad = 0;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    if (SKIP.includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|css|html)$/.test(f)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (/[—–]/.test(line)) { bad++; console.log(`${relative(root, p)}:${i + 1}: ${line.trim().slice(0, 100)}`); }
    });
  }
}
walk(join(root, 'src'));
walk(join(root, 'index.html').replace('index.html', '') + 'src');
if (bad) { console.error(`พบเครื่องหมายขีดยาว ${bad} บรรทัด`); process.exit(1); }
console.log('ไม่พบ em dash หรือ en dash ในโค้ดของแอป');
