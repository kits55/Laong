// ทดสอบกฎข้อมูล: ค่าว่างต้องไม่เป็น 0, ผล Target Tout ต้อง UNVALIDATED, ความคลาดเคลื่อนต้อง null จนมีค่าจริง
// ใช้ esbuild (มากับ vite) แปลงไฟล์ .ts ที่ทดสอบ เพื่อรันด้วย node ได้โดยไม่ต้องตั้งค่าเพิ่ม
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, mkdtempSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function load(entry) {
  mkdirSync(join(root, '.test-tmp'), { recursive: true });
  const dir = mkdtempSync(join(root, '.test-tmp', 't-'));
  const outfile = join(dir, 'bundle.mjs');
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', loader: { '.js': 'js' }, external: ['fflate'] });
  return import(pathToFileURL(outfile).href);
}

const adapter = await load('src/core/adapter.ts');
const exp = await load('src/lib/export.ts');
const seed = await load('src/data/seed.ts');
const runsLib = await load('src/lib/runs.ts');
const util = await load('src/lib/util.ts');

test('parseNum: ช่องว่างและข้อความไม่ใช่ตัวเลข ได้ null ไม่ใช่ 0', () => {
  assert.equal(util.parseNum(''), null);
  assert.equal(util.parseNum('   '), null);
  assert.equal(util.parseNum('abc'), null);
  assert.equal(util.parseNum(null), null);
  assert.equal(util.parseNum('0'), 0);
  assert.equal(util.parseNum('12,5'), 12.5);
});

test('predictTout: ขาด Tin แล้วไม่คำนวณ คืน errors 3 ส่วน', () => {
  const r = adapter.predictTout({ tin: null, feedMlMin: 10, solidsFrac: 0.15, airFlow: 22, eta: 0.62, ua: 8, tfeed: 25, troom: 25 });
  assert.equal(r.ok, false);
  const e = r.errors.find((x) => x.field === 'tin');
  assert.ok(e && e.what && e.why && e.fix);
});

test('predictTout: ผลเป็น predicted และ unvalidated เสมอ', () => {
  const r = adapter.predictTout({ tin: 160, feedMlMin: 10, solidsFrac: 0.15, airFlow: 22, eta: 0.62, ua: 8, tfeed: 25, troom: 25 });
  assert.equal(r.ok, true);
  assert.equal(r.prediction.kind, 'predicted');
  assert.equal(r.prediction.validation, 'unvalidated');
});

test('Target Tout: คำนวณ UNVALIDATED, recommendations เป็น [], operationallyApproved เป็น false', () => {
  const r = adapter.searchTargetTout({ target: 85, tolerance: 3, tinFrom: 140, tinTo: 180, tinStep: 10, feedFrom: 6, feedTo: 12, feedStep: 1, solidsFrac: 0.15, airFlow: 22, model: 'eta', eta: 0.62, ua: 8, tfeed: 25, troom: 25 });
  assert.equal(r.kind, 'calculated');
  assert.equal(r.validation, 'unvalidated');
  assert.deepEqual(r.recommendations, []);
  assert.strictEqual(r.operationallyApproved, false);
});

test('predictionError เป็น null จนกว่าจะมีค่าที่อ่านได้', () => {
  const runs = seed.buildSeedRuns();
  const open = runs.find((r) => r.measuredTout === null);
  assert.ok(open, 'ต้องมีรันตัวอย่างที่ยังไม่มีค่าที่อ่านได้');
  assert.equal(runsLib.predictionError(open), null);
  const done = runs.find((r) => r.measuredTout !== null);
  assert.equal(typeof runsLib.predictionError(done), 'number');
});

test('CSV: ค่าว่างออกเป็นช่องว่าง ไม่ใช่ 0 (สรุปรัน, รายนาที, ทุกรัน)', () => {
  const runs = seed.buildSeedRuns();
  const noLab = runs.find((r) => r.id === 'S-006');
  const sum = exp.runSummaryCsv(noLab);
  const moisture = sum.split('\r\n').find((l) => l.startsWith('ความชื้น,'));
  assert.equal(moisture, 'ความชื้น,,%,Measured');
  const open = runs.find((r) => r.id === 'S-007');
  const err = exp.runSummaryCsv(open).split('\r\n').find((l) => l.startsWith('predictionError,'));
  assert.equal(err, 'predictionError,,°C,Calculated');
  const all = exp.allRunsCsv(runs).split('\r\n');
  const row = all.find((l) => l.startsWith('S-007,'));
  assert.ok(!/,0(,|$)/.test(row), `พบ 0 ในแถวของรันที่ไม่มีค่า: ${row}`);
});

test('รายงานผูกกับรันเดียว: รันที่ไม่มีผลแล็บ ไม่รับผลแล็บของรันอื่น', () => {
  const runs = seed.buildSeedRuns();
  const a = runs.find((r) => r.id === 'S-006');
  const b = runs.find((r) => r.id === 'S-001');
  assert.ok(runsLib.hasAnyLab(b.lab));
  assert.equal(runsLib.hasAnyLab(a.lab), false);
  const csv = exp.runSummaryCsv(a);
  assert.ok(!csv.includes(String(b.lab.moisture)), 'ผลแล็บของรัน S-001 ปนเข้ามาในรายงาน S-006');
});

test('steadyInfo: ต้องมี Tout อย่างน้อย 3 ค่า และไม่เอา null มาคิดเป็น 0', () => {
  const pts = [
    { id: '1', tMin: 1, tin: 160, tout: 80, pump: null, how: 'live' },
    { id: '2', tMin: 2, tin: 160, tout: null, pump: null, how: 'live' },
    { id: '3', tMin: 3, tin: 160, tout: 80.5, pump: null, how: 'live' },
  ];
  const s = runsLib.steadyInfo(pts);
  assert.equal(s.reached, false);
  assert.equal(s.mean, null);
});

test('ไม่มีเครื่องหมายขีดยาว (em dash, en dash) ในข้อความที่ผ่าน cleanText', () => {
  assert.ok(!/[—–]/.test(util.cleanText('ภาระน้ำสูงเกินกำลังลมร้อน — เครื่องระเหยไม่ทัน')));
});
