// ตรวจว่าไฟล์สูตรที่ติดมากับแอป ตรงกับ hash ที่บรีฟกำหนด (ตรวจในเบราว์เซอร์ตอนใช้งาน)
import physicsRaw from './original/physics-model.js?raw';
import tgRaw from './original/tg-constants-from-reference-data.js?raw';
import { EXPECTED_PHYSICS_HASH, sha256Hex } from './adapter';
import { PHYSICS } from './adapter';

export interface FormulaCheck {
  state: 'checking' | 'match' | 'mismatch' | 'unavailable';
  actual: string | null;
  expected: string;
}

export async function checkFormula(): Promise<FormulaCheck> {
  const actual = await sha256Hex(physicsRaw);
  if (actual === null) return { state: 'unavailable', actual: null, expected: EXPECTED_PHYSICS_HASH };
  return { state: actual === EXPECTED_PHYSICS_HASH ? 'match' : 'mismatch', actual, expected: EXPECTED_PHYSICS_HASH };
}

export async function checkTgFile(): Promise<string | null> {
  return sha256Hex(tgRaw);
}

/** ทดสอบย้อนกลับกับกรณีตัวอย่างสมมติ: solveUA ย้อนจาก outletTempUA ได้ UA เดิม และ solveEta ย้อนจาก outletTemp ได้ eta เดิม */
export function roundTripTest() {
  let uaOk = 0, uaTotal = 0, etaOk = 0, etaTotal = 0;
  for (const tin of [120, 150, 180]) for (const F of [4, 8, 12]) for (const S of [0.1, 0.15, 0.2]) for (const air of [18, 22, 30]) {
    for (const ua of [4, 8, 12]) {
      const fwd = PHYSICS.outletTempUA(tin, F, S, air, ua);
      if (fwd.extrapolated) continue;
      uaTotal++;
      const back = PHYSICS.solveUA(tin, fwd.Tout, F, S, air);
      if (back.ok && Math.abs(back.ua - ua) < 1e-6) uaOk++;
    }
    for (const eta of [0.5, 0.62, 0.75]) {
      const fwd = PHYSICS.outletTemp(tin, F, S, air, eta);
      if (fwd.extrapolated) continue;
      etaTotal++;
      const back = PHYSICS.solveEta(tin, fwd.Tout, F, S, air);
      if (back.eta !== null && Math.abs(back.eta - eta) < 1e-6) etaOk++;
    }
  }
  return { uaOk, uaTotal, etaOk, etaTotal };
}
