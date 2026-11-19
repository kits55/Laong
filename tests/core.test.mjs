// ทดสอบแกนสูตร: hash ของไฟล์ต้นฉบับ, สูตรย้อนกลับ, ขอบเขต clamp
// รันด้วย npm test (ใช้ node:test ในตัว ไม่ต้องติดตั้งเพิ่ม)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPhysics } from '../src/core/physics.gen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (f) => createHash('sha256').update(readFileSync(join(root, 'src/core/original', f))).digest('hex');
const { PHYSICS: P } = createPhysics();

test('hash ของ physics-model.js ตรงกับบรีฟ', () => {
  assert.equal(sha('physics-model.js'), '1df5e55204b51c11f8e78bed9ce84ef6f616d666ebceb45d15b979bbb7648f83');
});

test('hash ของไฟล์ต้นฉบับใน handoff ตรงกับสำเนาในโปรเจกต์ (ถ้ามีโฟลเดอร์ handoff)', (t) => {
  const handoff = 'C:/Users/teera/Downloads/handoff-cc/formulas/physics-model.js';
  try {
    const h = createHash('sha256').update(readFileSync(handoff)).digest('hex');
    assert.equal(h, sha('physics-model.js'));
  } catch (e) {
    if (e.code === 'ENOENT') t.skip('ไม่พบโฟลเดอร์ handoff บนเครื่องนี้');
    else throw e;
  }
});

test('ย้อนกลับ: solveUA คืน UA เดิมจาก outletTempUA', () => {
  let ok = 0, total = 0;
  for (const tin of [120, 150, 180]) for (const F of [4, 8, 12]) for (const S of [0.1, 0.15, 0.2]) for (const air of [18, 22, 30]) for (const ua of [4, 8, 12]) {
    const fwd = P.outletTempUA(tin, F, S, air, ua);
    if (fwd.extrapolated) continue;
    total++;
    const back = P.solveUA(tin, fwd.Tout, F, S, air);
    if (back.ok && Math.abs(back.ua - ua) < 1e-6) ok++;
  }
  assert.ok(total > 30, `จำนวนกรณีน้อยเกินไป ${total}`);
  assert.equal(ok, total);
});

test('ย้อนกลับ: solveEta คืน eta เดิมจาก outletTemp', () => {
  let ok = 0, total = 0;
  for (const tin of [120, 150, 180]) for (const F of [4, 8, 12]) for (const S of [0.1, 0.15, 0.2]) for (const air of [18, 22, 30]) for (const eta of [0.5, 0.62, 0.75]) {
    const fwd = P.outletTemp(tin, F, S, air, eta);
    if (fwd.extrapolated) continue;
    total++;
    const back = P.solveEta(tin, fwd.Tout, F, S, air);
    if (back.eta !== null && Math.abs(back.eta - eta) < 1e-6) ok++;
  }
  assert.ok(total > 30, `จำนวนกรณีน้อยเกินไป ${total}`);
  assert.equal(ok, total);
});

test('ขอบเขต: ภาระน้ำสูงเกินไปถูก clamp ที่ T_FLOOR และติด extrapolated', () => {
  const r = P.outletTemp(100, 40, 0.05, 10, 0.6);
  assert.equal(r.extrapolated, true);
  assert.equal(r.Tout, 25);
});

test('ข้อมูลทดสอบ: ไม่มีค่าคาลิเบรตจริงในไฟล์ config (ตรวจว่าทุกโปรไฟล์เป็น sample)', async () => {
  const src = readFileSync(join(root, 'src/config/synthetic.ts'), 'utf8');
  const profiles = src.match(/sample: (true|false)/g) ?? [];
  assert.ok(profiles.length >= 3);
  assert.ok(profiles.every((p) => p === 'sample: true'));
});
