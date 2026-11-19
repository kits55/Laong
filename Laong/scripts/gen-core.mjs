// สร้าง src/core/physics.gen.js โดยห่อไฟล์สูตรต้นฉบับไว้ด้านนอก ไม่แก้เนื้อไฟล์
// 1) ตรวจ sha256 ของ physics-model.js ก่อนห่อ ถ้าไม่ตรงให้หยุด
// 2) ห่อไฟล์ tg-constants + physics-model.js ตรงตัวไว้ในฟังก์ชันเดียว แล้ว export ออกมา
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src', 'core', 'original');

const EXPECTED = {
  'physics-model.js': '1df5e55204b51c11f8e78bed9ce84ef6f616d666ebceb45d15b979bbb7648f83',
  // ค่านี้คำนวณจากไฟล์ที่ส่งมาในแพ็ก ไม่มีค่าอ้างอิงในบรีฟ
  'tg-constants-from-reference-data.js': 'c3fe5299bd832188987c867d5a6d93f1ff44d972f83a25c7700c458271872a76',
};

const read = (name) => readFileSync(join(dir, name));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let ok = true;
for (const [name, expected] of Object.entries(EXPECTED)) {
  const actual = sha(read(name));
  const match = actual === expected;
  console.log(`${match ? 'OK  ' : 'FAIL'} ${name} ${actual}`);
  if (!match) ok = false;
}
if (!ok) {
  console.error('\nhash ของไฟล์สูตรไม่ตรง หยุดทำงาน ห้ามแก้ไฟล์ใน src/core/original ถ้าคิดว่าต้องแก้ ให้เขียนข้อเสนอแยกให้พ้อย');
  process.exit(1);
}

const tg = read('tg-constants-from-reference-data.js').toString('utf8');
const physics = read('physics-model.js').toString('utf8');

const out = `// สร้างโดย scripts/gen-core.mjs ห้ามแก้ไฟล์นี้
// ห่อไฟล์ต้นฉบับสองไฟล์ตรงตัวไว้ด้านนอก ไม่แก้เนื้อ สมการอยู่ใน src/core/original/
// hash ที่ตรวจก่อนห่อ: physics-model.js ${EXPECTED['physics-model.js']}
/* eslint-disable */
export function createPhysics() {
// ---- เริ่ม tg-constants-from-reference-data.js (ตรงตัว) ----
${tg}
// ---- จบ tg-constants-from-reference-data.js ----
// ---- เริ่ม physics-model.js (ตรงตัว) ----
${physics}
// ---- จบ physics-model.js ----
return { PHYSICS, TG_WATER, TG_MD_DRY, TG_COMP, CP_AIR, CP_W, CP_SOL, RHO_AIR, T_FLOOR, lambda };
}
export const PHYSICS_HASH = '${EXPECTED['physics-model.js']}';
export const TG_HASH = '${EXPECTED['tg-constants-from-reference-data.js']}';
`;
writeFileSync(join(root, 'src', 'core', 'physics.gen.js'), out);
console.log('สร้าง src/core/physics.gen.js แล้ว');
