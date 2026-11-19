/*
 * ชั้นเชื่อม (adapter) บาง ๆ ระหว่าง UI กับสูตรต้นฉบับ
 * - รับค่าจาก UI, ตรวจว่าครบและเป็นตัวเลข, ส่งเข้า PHYSICS ตรง ๆ แล้วส่งผลกลับพร้อมป้ายที่มา
 * - ไม่คำนวณสูตรซ้ำ ไม่แตะ DOM ไม่แตะ storage
 * - ค่าว่างไม่ถูกแปลงเป็น 0 ถ้าขาดค่าจะคืน errors แทนการคำนวณ
 */
import { createPhysics, PHYSICS_HASH } from './physics.gen.js';
import type { Num } from './types';
import { INPUT_LIMITS, type Material } from '../config/synthetic';
import { cleanText } from '../lib/util';

const core = createPhysics();
export const PHYSICS = core.PHYSICS;
export const MODEL_VERSION: string = PHYSICS.MODEL_VERSION;
export const EXPECTED_PHYSICS_HASH: string = PHYSICS_HASH;
export const T_FLOOR: number = core.T_FLOOR;

export interface FieldError {
  field: string;
  what: string; // เกิดอะไร
  why: string; // ทำไม
  fix: string; // ต้องทำอะไร
}

export interface Step {
  key: string;
  label: string;
  value: number;
  unit: string;
  note: string;
}

export interface ModelResult {
  model: 'eta' | 'ua';
  tout: number;
  raw: number;
  extrapolated: boolean;
  reason: string;
  steps: Step[];
}

export interface PredictInput {
  tin: Num;
  feedMlMin: Num;
  solidsFrac: Num; // 0 ถึง 1
  airFlow: Num;
  eta: Num;
  ua: Num;
  tfeed: Num;
  troom: Num;
}

export interface Prediction {
  kind: 'predicted';
  validation: 'unvalidated';
  modelVersion: string;
  eta: ModelResult | null;
  ua: ModelResult | null;
}

export type PredictOutcome =
  | { ok: true; prediction: Prediction }
  | { ok: false; errors: FieldError[] };

const need = (v: Num): v is number => v !== null && Number.isFinite(v);

export function validatePredictInputs(i: PredictInput, which: 'eta' | 'ua' | 'both' = 'both'): FieldError[] {
  const e: FieldError[] = [];
  if (!need(i.tin)) {
    e.push({ field: 'tin', what: 'ยังไม่มีค่า Tin', why: 'ระบบต้องใช้ Tin เพื่อคำนวณ Tout', fix: 'กรอก Tin ก่อน ระบบจึงจะคำนวณ Tout ให้' });
  } else if (i.tin < INPUT_LIMITS.tinMin || i.tin > INPUT_LIMITS.tinMax) {
    e.push({
      field: 'tin',
      what: `Tin ${i.tin} °C อยู่นอกช่วงที่กรอกได้`,
      why: `ช่วงที่รับในต้นแบบคือ ${INPUT_LIMITS.tinMin} ถึง ${INPUT_LIMITS.tinMax} °C เพื่อกันกรอกผิดหน่วย`,
      fix: 'ตรวจค่าที่อ่านจากหน้าจอเครื่องแล้วกรอกใหม่',
    });
  }
  if (!need(i.feedMlMin)) {
    e.push({ field: 'feed', what: 'ยังไม่มีอัตราป้อน', why: 'น้ำที่ต้องระเหยคำนวณจากอัตราป้อน', fix: 'กรอกอัตราป้อน (mL/min) หรือ Pump % ที่ใช้' });
  } else if (i.feedMlMin <= 0 || i.feedMlMin > INPUT_LIMITS.feedMax) {
    e.push({
      field: 'feed',
      what: `อัตราป้อน ${i.feedMlMin} mL/min อยู่นอกช่วงที่กรอกได้`,
      why: `ต้องมากกว่า 0 และไม่เกิน ${INPUT_LIMITS.feedMax} mL/min ในต้นแบบ`,
      fix: 'ตรวจหน่วยของค่าที่กรอก',
    });
  }
  if (!need(i.solidsFrac)) {
    e.push({ field: 'ts', what: 'ยังไม่มีค่าของแข็ง (TS)', why: 'ปริมาณของแข็งกำหนดน้ำที่ต้องระเหย', fix: 'กรอก TS เป็นเปอร์เซ็นต์ หรือเลือกใช้ °Brix เป็น Proxy เอง' });
  } else if (i.solidsFrac <= 0 || i.solidsFrac >= 1) {
    e.push({ field: 'ts', what: 'TS ต้องมากกว่า 0 และน้อยกว่า 100 %', why: 'สูตรใช้สัดส่วนของแข็งในสารป้อน', fix: 'กรอก TS เป็นเปอร์เซ็นต์ เช่น 15' });
  }
  if (!need(i.airFlow) || i.airFlow < INPUT_LIMITS.airMin) {
    e.push({ field: 'air', what: 'ยังไม่มีอัตราลมของโปรไฟล์เครื่อง', why: 'สูตรต้องใช้อัตราลมของเครื่องที่เลือก', fix: 'เลือกโปรไฟล์เครื่องที่มีค่าลม หรือแก้ในหน้าภาพรวม' });
  }
  if (which !== 'ua' && !need(i.eta)) {
    e.push({ field: 'eta', what: 'โปรไฟล์นี้ยังไม่มีค่า eta', why: 'โมเดล eta ต้องใช้ค่าจากโปรไฟล์ที่ตรงกับเครื่อง', fix: 'เลือกโปรไฟล์ที่มีค่า eta' });
  }
  if (which !== 'eta' && !need(i.ua)) {
    e.push({ field: 'ua', what: 'โปรไฟล์นี้ยังไม่มีค่า UA', why: 'โมเดล UA ต้องใช้ค่าจากโปรไฟล์ที่ตรงกับเครื่อง', fix: 'เลือกโปรไฟล์ที่มีค่า UA' });
  }
  return e;
}

function stepsFrom(r: any, model: 'eta' | 'ua'): Step[] {
  const out: Step[] = [];
  if (model === 'eta') {
    out.push({ key: 'mAir', label: 'มวลลมที่ใช้', value: r.mAir, unit: 'kg/h', note: 'อัตราลม คูณความหนาแน่นอากาศที่สูตรกำหนด' });
  }
  if (model === 'eta') {
    out.push({ key: 'mFeed', label: 'มวลสารป้อน', value: r.mFeed, unit: 'kg/h', note: 'แปลง mL/min เป็น kg/h' });
  }
  out.push({ key: 'W', label: 'น้ำที่ต้องระเหย', value: r.W, unit: 'kg/h', note: 'มวลสารป้อน คูณสัดส่วนน้ำ' });
  out.push({ key: 'Sd', label: 'ของแข็งที่ป้อน', value: r.Sd, unit: 'kg/h', note: 'มวลสารป้อน คูณ TS' });
  out.push({ key: 'A', label: 'ความร้อนที่ลมให้ได้ต่อองศา (A)', value: r.A, unit: 'kJ/(h·K)', note: model === 'eta' ? 'eta คูณมวลลมและความจุความร้อนอากาศ' : 'มวลลมคูณความจุความร้อนอากาศ' });
  out.push({ key: 'B', label: 'ความร้อนที่สารป้อนดูดต่อองศา (B)', value: r.B, unit: 'kJ/(h·K)', note: 'น้ำและของแข็งที่ป้อน' });
  out.push({ key: 'raw', label: 'Tout ก่อนปรับขอบเขต', value: r.raw, unit: '°C', note: 'ผลตรงจากสมการ ก่อนตรวจความสมเหตุสมผล' });
  return out;
}

export function predictTout(i: PredictInput, which: 'eta' | 'ua' | 'both' = 'both'): PredictOutcome {
  const errors = validatePredictInputs(i, which);
  if (errors.length) return { ok: false, errors };
  const tin = i.tin as number, F = i.feedMlMin as number, S = i.solidsFrac as number, air = i.airFlow as number;
  const tfeed = need(i.tfeed) ? (i.tfeed as number) : 25;
  const troom = need(i.troom) ? (i.troom as number) : 25;
  let eta: ModelResult | null = null;
  let ua: ModelResult | null = null;
  if (which !== 'ua') {
    const r = PHYSICS.outletTemp(tin, F, S, air, i.eta as number, tfeed);
    eta = { model: 'eta', tout: r.Tout, raw: r.raw, extrapolated: r.extrapolated, reason: cleanText(r.reason || ''), steps: stepsFrom(r, 'eta') };
  }
  if (which !== 'eta') {
    const r = PHYSICS.outletTempUA(tin, F, S, air, i.ua as number, troom, tfeed);
    ua = { model: 'ua', tout: r.Tout, raw: r.raw, extrapolated: r.extrapolated, reason: cleanText(r.reason || ''), steps: stepsFrom(r, 'ua') };
  }
  return { ok: true, prediction: { kind: 'predicted', validation: 'unvalidated', modelVersion: MODEL_VERSION, eta, ua } };
}

/** ย้อนหา eta และ UA จากรันที่มี Tout ที่อ่านได้ ใช้ในโต๊ะเทียบคาลิเบรต */
export function backSolve(args: { tin: Num; tout: Num; feedMlMin: Num; solidsFrac: Num; airFlow: Num; troom: Num; tfeed: Num }) {
  const { tin, tout, feedMlMin, solidsFrac, airFlow } = args;
  if (![tin, tout, feedMlMin, solidsFrac, airFlow].every(need)) return null;
  const troom = need(args.troom) ? (args.troom as number) : 25;
  const tfeed = need(args.tfeed) ? (args.tfeed as number) : 25;
  const eta = PHYSICS.solveEta(tin, tout, feedMlMin, solidsFrac, airFlow, tfeed);
  const ua = PHYSICS.solveUA(tin, tout, feedMlMin, solidsFrac, airFlow, troom, tfeed);
  return {
    eta: { value: eta.eta as Num, ok: !!eta.ok, msg: cleanText(eta.msg) },
    ua: { value: ua.ua as Num, ok: !!ua.ok, msg: cleanText(ua.msg) },
  };
}

/* ---------- Target Tout (ค้นหาแบบ grid) ----------
 * ผลเป็น "คำนวณ UNVALIDATED" เสมอ recommendations เป็น [] และ operationallyApproved เป็น false ตายตัว (กฎข้อมูลข้อ 5) */
export interface TargetCell { tin: number; feed: number; tout: number; extrapolated: boolean; diff: number }
export interface TargetToutResult {
  kind: 'calculated';
  validation: 'unvalidated';
  recommendations: [];
  operationallyApproved: false;
  modelVersion: string;
  model: 'eta' | 'ua';
  target: number;
  tolerance: number;
  cells: TargetCell[];
  matches: TargetCell[];
}

export function searchTargetTout(a: {
  target: number; tolerance: number; tinFrom: number; tinTo: number; tinStep: number;
  feedFrom: number; feedTo: number; feedStep: number; solidsFrac: number; airFlow: number;
  model: 'eta' | 'ua'; eta: Num; ua: Num; tfeed: Num; troom: Num;
}): TargetToutResult {
  const cells: TargetCell[] = [];
  const tfeed = need(a.tfeed) ? a.tfeed : 25;
  const troom = need(a.troom) ? a.troom : 25;
  for (let tin = a.tinFrom; tin <= a.tinTo + 1e-9; tin += a.tinStep) {
    for (let feed = a.feedFrom; feed <= a.feedTo + 1e-9; feed += a.feedStep) {
      const r = a.model === 'eta'
        ? PHYSICS.outletTemp(tin, feed, a.solidsFrac, a.airFlow, a.eta as number, tfeed)
        : PHYSICS.outletTempUA(tin, feed, a.solidsFrac, a.airFlow, a.ua as number, troom, tfeed);
      cells.push({ tin: Math.round(tin * 100) / 100, feed: Math.round(feed * 100) / 100, tout: r.Tout, extrapolated: !!r.extrapolated, diff: r.Tout - a.target });
    }
  }
  const matches = cells.filter((c) => !c.extrapolated && Math.abs(c.diff) <= a.tolerance).sort((x, y) => Math.abs(x.diff) - Math.abs(y.diff));
  return {
    kind: 'calculated',
    validation: 'unvalidated',
    recommendations: [],
    operationallyApproved: false,
    modelVersion: MODEL_VERSION,
    model: a.model,
    target: a.target,
    tolerance: a.tolerance,
    cells,
    matches,
  };
}

/* ---------- Tg และ Sticky point ---------- */
export interface TgBands {
  lo: number; mid: number; hi: number;
  hasBand: boolean;
  fromMeasured: boolean;
}

export function computeTg(mat: Material, mdFrac: Num, moisture: Num, k: Num): { ok: true; bands: TgBands } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  if (!need(mdFrac) || mdFrac < 0 || mdFrac > 1) errors.push({ field: 'md', what: 'ยังไม่มีสัดส่วนมอลโตเดกซ์ทริน', why: 'Tg ของผงขึ้นกับสัดส่วนที่ผสม', fix: 'กรอกเป็นเปอร์เซ็นต์ 0 ถึง 100' });
  if (!need(moisture) || moisture <= 0 || moisture >= 1) errors.push({ field: 'moisture', what: 'ยังไม่มีความชื้นเป้าหมายของผง', why: 'ความชื้นลด Tg ของผง', fix: 'กรอกความชื้นเป็นเปอร์เซ็นต์ เช่น 4' });
  if (!need(k) || k <= 0) errors.push({ field: 'k', what: 'ยังไม่มีค่า k ของ Gordon-Taylor', why: 'สมการ Gordon-Taylor ต้องใช้ค่า k', fix: 'กรอกค่า k เป็นตัวเลขมากกว่า 0' });
  if (errors.length) return { ok: false, errors };
  const r = PHYSICS.tgBand(mat, mdFrac, moisture, k);
  return { ok: true, bands: { lo: r.lo.tg, mid: r.mid.tg, hi: r.hi.tg, hasBand: !!r.hasBand, fromMeasured: !!r.fromMeasured } };
}

/* ---------- ตรวจสูตรขณะเปิดแอป (hash ของไฟล์ต้นฉบับ) ---------- */
export async function sha256Hex(text: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
