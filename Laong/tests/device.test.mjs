// ทดสอบสัญญาของข้อความระหว่างเว็บกับบอร์ด ESP32 (ไม่ต้องมีบอร์ด)
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, mkdtempSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
async function load(entry) {
  mkdirSync(join(root, '.test-tmp'), { recursive: true });
  const dir = mkdtempSync(join(root, '.test-tmp', 'd-'));
  const outfile = join(dir, 'bundle.mjs');
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent' });
  return import(pathToFileURL(outfile).href);
}
const p = await load('src/device/protocol.ts');

test('encode: ส่งได้เฉพาะเช็กสถานะและสั่งกล้อง', () => {
  assert.equal(p.encode({ t: 'ping', id: 1 }), '{"t":"ping","id":1}');
  assert.ok(p.encode({ t: 'cam.start', run: 'R-1' }).includes('cam.start'));
  for (const t of ['heater', 'pump', 'fan', 'set', 'relay', 'power', 'cmd']) {
    assert.throws(() => p.encode({ t }), /ไม่อยู่ในรายการ/, `ต้องปฏิเสธ ${t}`);
  }
});

test('ALLOWED_OUT ไม่มีคำสั่งควบคุมเครื่อง', () => {
  assert.deepEqual([...p.ALLOWED_OUT].sort(), ['cam.snap', 'cam.start', 'cam.stop', 'hello', 'ping', 'status']);
});

test('decode: ข้อความที่ถูกต้องอ่านได้ ข้อความผิดรูปแบบถูกทิ้ง ไม่เดาค่า', () => {
  assert.deepEqual(p.decode('{"t":"pong","id":7}'), { t: 'pong', id: 7 });
  assert.equal(p.decode('{"t":"pong"}'), null);
  assert.equal(p.decode('{"t":"pong","id":"x"}'), null);
  assert.equal(p.decode('ไม่ใช่ json'), null);
  assert.equal(p.decode('{"t":"unknown"}'), null);
  assert.equal(p.decode('{"t":"cam","state":"on-fire"}'), null);
  assert.equal(p.decode('x'.repeat(2500)), null);
  assert.equal(p.decode(null), null);
  const h = p.decode('{"t":"hello","board":"ESP32","fw":"0.1.0","cam":"ready"}');
  assert.deepEqual(h, { t: 'hello', board: 'ESP32', fw: '0.1.0', cam: 'ready' });
  const s = p.decode('{"t":"status","cam":"bogus"}');
  assert.equal(s.cam, undefined);
});

test('validateUrl: ที่อยู่ที่ใช้ได้ และข้อความผิดพลาดบอก 3 ส่วน', () => {
  assert.equal(p.validateUrl('ws://192.168.1.50:81', 'http:').ok, true);
  assert.equal(p.validateUrl('wss://board.local', 'https:').ok, true);
  for (const bad of ['', 'http://x', 'ws://', 'ws://a b', 'ws://user@host']) {
    const r = p.validateUrl(bad, 'http:');
    assert.equal(r.ok, false, bad);
    assert.ok(r.what && r.why && r.fix);
  }
  const mixed = p.validateUrl('ws://192.168.1.50:81', 'https:');
  assert.equal(mixed.ok, false);
  assert.match(mixed.why, /https/);
});
