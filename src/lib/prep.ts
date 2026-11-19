// แปลงช่องกรอกของขั้น 1 เป็นค่าที่ส่งเข้า adapter พร้อมที่มาของค่า (ไม่คำนวณสูตรเอง)
import { SAMPLE_MATERIALS, type Material, type Profile } from '../config/synthetic';
import { predictTout, type FieldError, type PredictInput } from '../core/adapter';
import type { Kind, Num } from '../core/types';
import type { PreInputs } from '../data/types';
import { isBadNumber, parseNum } from './util';

export interface Derived {
  material: Material;
  tin: Num;
  feedMlMin: Num;
  feedKind: 'assumed' | 'proxy';
  solidsFrac: Num;
  solidsKind: 'measured' | 'assumed' | 'proxy';
  input: PredictInput;
  errors: FieldError[];
  key: string;
}

export function materialOf(id: string): Material {
  return SAMPLE_MATERIALS.find((m) => m.id === id) ?? SAMPLE_MATERIALS[0];
}

export function derivePre(pre: PreInputs, profile: Profile): Derived {
  const material = materialOf(pre.materialId);
  const tin = parseNum(pre.tin);
  const feedKind = pre.feedMode === 'pump' ? 'proxy' : 'assumed';
  const pumpPct = parseNum(pre.pump);
  const feedMlMin = pre.feedMode === 'pump' ? (pumpPct === null ? null : pumpPct * profile.pumpFactor) : parseNum(pre.feedMl);
  const solidsKind = pre.tsSource === 'brix' ? 'proxy' : pre.tsSource;
  const raw = parseNum(pre.tsSource === 'brix' ? pre.brix : pre.ts);
  const solidsFrac = raw === null ? null : raw / 100;
  const input: PredictInput = { tin, feedMlMin, solidsFrac, airFlow: profile.airFlow, eta: profile.eta, ua: profile.ua, tfeed: profile.tfeed, troom: profile.troom };
  const errors: FieldError[] = [];
  const bad = (field: string, text: string, label: string) => {
    if (isBadNumber(text)) errors.push({ field, what: `${label} ไม่ใช่ตัวเลข`, why: 'ช่องนี้รับเฉพาะตัวเลข เช่น 160 หรือ 12.5', fix: 'ลบตัวอักษรออกแล้วกรอกใหม่' });
  };
  bad('tin', pre.tin, 'Tin');
  bad('feed', pre.feedMode === 'pump' ? pre.pump : pre.feedMl, pre.feedMode === 'pump' ? 'Pump %' : 'อัตราป้อน');
  bad('ts', pre.tsSource === 'brix' ? pre.brix : pre.ts, pre.tsSource === 'brix' ? '°Brix' : 'TS');
  if (!errors.length) {
    const out = predictTout(input);
    if (!out.ok) errors.push(...out.errors);
  }
  return { material, tin, feedMlMin, feedKind, solidsFrac, solidsKind, input, errors, key: JSON.stringify([pre.materialId, pre.tin, pre.feedMode, pre.feedMl, pre.pump, pre.tsSource, pre.ts, pre.brix, profile.id, profile.airFlow, profile.eta, profile.ua, profile.pumpFactor]) };
}

export const errFor = (errs: FieldError[], field: string): string | null => {
  const e = errs.find((x) => x.field === field);
  return e ? `${e.what}. ${e.why}. ${e.fix}.` : null;
};

export const SOLIDS_CHIP: Record<'measured' | 'assumed' | 'proxy', Kind> = { measured: 'measured', assumed: 'assumed', proxy: 'proxy' };
