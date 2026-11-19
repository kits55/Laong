// ตั้งค่าน้องละออง: ค่าที่ผู้ใช้เลือก (เก็บในเบราว์เซอร์) และรายชื่อพื้นที่สำหรับอากาศ
// ที่ตั้ง: ไม่เก็บพิกัดดิบ ถ้าใช้ตำแหน่งปัจจุบันจะปัดเหลือทศนิยม 1 ตำแหน่ง (ราว 11 กม.) ก่อนเก็บและก่อนส่ง
export type MascotPlace =
  | { kind: 'default' }
  | { kind: 'province'; id: string }
  | { kind: 'gps'; lat: number; lon: number };

export interface MascotPrefs {
  hidden: boolean;
  /** พักท่าขยับเอง (idle) ไม่กระทบท่าตามการลากและท่าอากาศ */
  paused: boolean;
  weatherOn: boolean;
  place: MascotPlace;
}

export const DEFAULT_MASCOT: MascotPrefs = { hidden: false, paused: false, weatherOn: true, place: { kind: 'default' } };

export interface Place { id: string; name: string; lat: number; lon: number }

/** กรุงเทพฯ เป็นค่าเริ่มต้น ไม่ต้องขอสิทธิ์ตำแหน่ง */
export const DEFAULT_PLACE: Place = { id: 'bkk', name: 'กรุงเทพฯ', lat: 13.76, lon: 100.5 };

/** พิกัดโดยประมาณของตัวเมือง รายชื่อบางส่วน (ยังไม่ครบ 77 จังหวัด) ใช้ดึงอากาศเท่านั้น */
export const PROVINCES: Place[] = [
  { id: 'cnx', name: 'เชียงใหม่', lat: 18.79, lon: 98.98 },
  { id: 'cri', name: 'เชียงราย', lat: 19.91, lon: 99.83 },
  { id: 'lpg', name: 'ลำปาง', lat: 18.29, lon: 99.49 },
  { id: 'plk', name: 'พิษณุโลก', lat: 16.83, lon: 100.26 },
  { id: 'nsw', name: 'นครสวรรค์', lat: 15.7, lon: 100.12 },
  { id: 'kkc', name: 'ขอนแก่น', lat: 16.44, lon: 102.83 },
  { id: 'udn', name: 'อุดรธานี', lat: 17.41, lon: 102.79 },
  { id: 'nrt', name: 'นครราชสีมา', lat: 14.98, lon: 102.1 },
  { id: 'ubn', name: 'อุบลราชธานี', lat: 15.24, lon: 104.85 },
  { id: 'ayt', name: 'พระนครศรีอยุธยา', lat: 14.35, lon: 100.57 },
  { id: 'pte', name: 'ปทุมธานี', lat: 14.02, lon: 100.53 },
  { id: 'nbi', name: 'นนทบุรี', lat: 13.86, lon: 100.51 },
  { id: 'spk', name: 'สมุทรปราการ', lat: 13.6, lon: 100.6 },
  { id: 'cbi', name: 'ชลบุรี', lat: 13.36, lon: 100.98 },
  { id: 'ryg', name: 'ระยอง', lat: 12.68, lon: 101.28 },
  { id: 'rbr', name: 'ราชบุรี', lat: 13.53, lon: 99.81 },
  { id: 'kri', name: 'กาญจนบุรี', lat: 14.02, lon: 99.53 },
  { id: 'pbi', name: 'เพชรบุรี', lat: 13.11, lon: 99.94 },
  { id: 'pkn', name: 'ประจวบคีรีขันธ์', lat: 11.81, lon: 99.8 },
  { id: 'sni', name: 'สุราษฎร์ธานี', lat: 9.14, lon: 99.33 },
  { id: 'nst', name: 'นครศรีธรรมราช', lat: 8.43, lon: 99.96 },
  { id: 'pkt', name: 'ภูเก็ต', lat: 7.88, lon: 98.39 },
  { id: 'sgk', name: 'สงขลา', lat: 7.01, lon: 100.47 },
];

/** ปัดพิกัดเหลือทศนิยม 1 ตำแหน่ง */
export function coarse(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resolvePlace(p: MascotPlace): { name: string; lat: number; lon: number } {
  if (p.kind === 'gps') return { name: 'ตำแหน่งปัจจุบัน', lat: p.lat, lon: p.lon };
  if (p.kind === 'province') {
    const f = PROVINCES.find((x) => x.id === p.id);
    if (f) return f;
  }
  return DEFAULT_PLACE;
}

export function isPlace(v: unknown): v is MascotPlace {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.kind === 'default') return true;
  if (o.kind === 'province') return typeof o.id === 'string';
  if (o.kind === 'gps') return Number.isFinite(o.lat) && Number.isFinite(o.lon);
  return false;
}
