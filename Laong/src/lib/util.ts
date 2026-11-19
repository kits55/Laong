// ฟังก์ชันช่วยเล็ก ๆ ที่ไม่แตะสูตร ไม่แตะ DOM
import type { Num } from '../core/types';

/** แปลงข้อความจากช่องกรอกเป็นตัวเลข ช่องว่างหรือไม่ใช่ตัวเลข ได้ null (ห้ามกลายเป็น 0) */
export function parseNum(s: string | number | null | undefined): Num {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** ข้อความไม่ว่างแต่ไม่ใช่ตัวเลข */
export function isBadNumber(s: string): boolean {
  const t = s.trim();
  return t !== '' && parseNum(t) === null;
}

export function fmt(n: Num | undefined, digits = 1): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return n.toFixed(digits);
}

export function uid(prefix = 'R'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase()}`;
}

/** รหัสรันที่อ่านง่าย เช่น R-1105-2358K (เดือนวัน-ชั่วโมงนาที และอักษรกันซ้ำ) */
export function runId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `R-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function fmtTime(iso: string | number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

export function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** ข้อความจากไฟล์สูตรมีเครื่องหมายขีดยาว กติกาข้อความหน้าจอห้ามใช้ จึงแปลงตอนแสดงผล ไม่แก้ไฟล์สูตร */
const DASHES = new RegExp('\\s*[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']\\s*', 'g');
export function cleanText(s: string): string {
  return s.replace(DASHES, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs) as number;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** ตัวสุ่มแบบกำหนด seed ได้ ใช้กับ DOE เพื่อให้สุ่มซ้ำได้ผลเดิม */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
