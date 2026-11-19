// เก็บไฟล์สมการแบบเข้ารหัส (AES-256-GCM) ใน git และถอดรหัสตอน build
//   node scripts/vault.mjs seal   เข้ารหัสไฟล์ในรายการ FILES ไปที่ vault/laong-private.enc (ใช้กุญแจจาก LAONG_VAULT_KEY หรือ private-data/vault.key)
//   node scripts/vault.mjs open   ถอดรหัสกลับมาเป็นไฟล์ ถ้าไฟล์ครบอยู่แล้วจะไม่ทำอะไร
// กุญแจต้องไม่อยู่ใน git: เก็บใน private-data/ (ถูก ignore) และใส่เป็น Environment Variable บน Vercel
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = join(root, 'vault', 'laong-private.enc');
const KEY_FILE = join(root, 'private-data', 'vault.key');
const FILES = [
  'src/core/original/physics-model.js',
  'src/core/original/tg-constants-from-reference-data.js',
  'src/core/physics.gen.d.ts',
  'public/laong-assets/run-prediction.js',
  'public/laong-assets/integration-test-physics.js',
];

const key = () => {
  const hex = (process.env.LAONG_VAULT_KEY || (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '')).trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Buffer.from(hex, 'hex');
};

const cmd = process.argv[2];
if (cmd === 'seal') {
  const k = key();
  if (!k) { console.error('ไม่พบกุญแจ (LAONG_VAULT_KEY หรือ private-data/vault.key)'); process.exit(1); }
  const bundle = {};
  for (const f of FILES) bundle[f] = readFileSync(join(root, f)).toString('base64');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([c.update(JSON.stringify(bundle), 'utf8'), c.final()]);
  mkdirSync(dirname(VAULT), { recursive: true });
  writeFileSync(VAULT, Buffer.concat([iv, c.getAuthTag(), enc]));
  console.log('vault sealed:', FILES.length, 'files');
} else if (cmd === 'open') {
  if (FILES.every((f) => existsSync(join(root, f)))) process.exit(0);
  const k = key();
  if (!k || !existsSync(VAULT)) { console.error('ไฟล์สมการไม่ครบ และไม่มีกุญแจหรือ vault: ตั้ง LAONG_VAULT_KEY ก่อน build'); process.exit(1); }
  const raw = readFileSync(VAULT);
  const d = createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  const bundle = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
  for (const [f, b64] of Object.entries(bundle)) {
    const p = join(root, f);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, Buffer.from(b64, 'base64'));
  }
  console.log('vault opened:', Object.keys(bundle).length, 'files');
} else { console.error('usage: vault.mjs seal|open'); process.exit(1); }
