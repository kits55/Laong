// ค่าตัวอย่างสมมติทั้งไฟล์ ไม่ใช่ค่าคาลิเบรตจริงของเครื่องใด (กฎ core ข้อ 5)
// เมื่อเจ้าของส่งค่าจริงผ่านช่องทางของทีม ให้เปลี่ยนที่ไฟล์นี้ไฟล์เดียว ห้ามใส่ค่าจริงลงใน repo นี้โดยไม่ได้รับอนุมัติ

export const SYNTHETIC_NOTE = 'ข้อมูลตัวอย่าง';

export interface Profile {
  id: string;
  name: string;
  code: string; // รหัสเครื่องตัวอย่าง (Machine ID จริงยังไม่มี spec)
  airFlow: number; // m3/h ค่าสมมติ
  eta: number; // ค่าสมมติ
  ua: number; // kJ/(h·K) ค่าสมมติ
  troom: number; // °C
  tfeed: number; // °C
  pumpFactor: number; // mL/min ต่อ 1% ของปั๊ม ค่าสมมติจากโต๊ะเทียบน้ำ (Proxy)
  sample: boolean;
}

export const SYNTHETIC_PROFILES: Profile[] = [
  { id: 'syn-a', name: 'เครื่องตัวอย่าง A', code: 'SYN-A', airFlow: 22, eta: 0.62, ua: 8.0, troom: 25, tfeed: 25, pumpFactor: 0.25, sample: true },
  { id: 'syn-b', name: 'เครื่องตัวอย่าง B', code: 'SYN-B', airFlow: 20, eta: 0.58, ua: 8.8, troom: 25, tfeed: 25, pumpFactor: 0.25, sample: true },
  { id: 'syn-c', name: 'เครื่องตัวอย่าง C', code: 'SYN-C', airFlow: 24, eta: 0.66, ua: 7.4, troom: 25, tfeed: 25, pumpFactor: 0.25, sample: true },
];

// ขอบเขตกรอกค่า (ค่าสมมติ ใช้กันกรอกผิด ไม่ใช่ขีดจำกัดของเครื่องจริง)
export const INPUT_LIMITS = {
  tinMin: 40,
  tinMax: 250,
  feedMax: 60,
  pumpMax: 100,
  airMin: 1,
  airMax: 200,
};

// เกณฑ์ steady state ตัวอย่าง: Tout 3 ค่าล่าสุดห่างกันไม่เกินค่านี้ (รอยืนยันกับ run-protocol.js)
export const STEADY = { windowSize: 3, maxSpreadC: 1.0 };

// แนวอ่านผลที่ปลื้มยอมรับราว 5 °C (คำบอกของพ้อย) ใช้อ่านผล ไม่ใช่ค่าที่ระบบเคลมว่าแม่น
export const READ_BAND_C = 5;

export interface Material {
  id: string;
  name: string;
  sugars?: { sucrose: number; glucose: number; fructose: number };
  citricPctSolids?: number;
  fiberPctSolids?: number;
  tgDry?: number;
  defaultTs: number; // % ของแข็ง
  defaultMd: number; // % มอลโตเดกซ์ทริน
}

export const SAMPLE_MATERIALS: Material[] = [
  {
    id: 'juice-mix',
    name: 'น้ำผลไม้รวม (ตัวอย่างสมมติ)',
    sugars: { sucrose: 50, glucose: 25, fructose: 25 },
    citricPctSolids: 4,
    fiberPctSolids: 6,
    defaultTs: 15,
    defaultMd: 40,
  },
  { id: 'bean-extract', name: 'สารสกัดถั่ว (ตัวอย่างสมมติ)', tgDry: 169, defaultTs: 12, defaultMd: 30 },
];

// ค่าตั้งต้นของ Gordon-Taylor และความชื้นเป้าหมาย เป็นค่าตัวอย่างสมมติ
export const DEFAULT_GT_K = 4;
export const DEFAULT_TARGET_MOISTURE_PCT = 4;
// ส่วนต่างจาก Tg ถึงจุดเริ่มติดผนัง (Sticky point) เป็นค่าสมมติรอยืนยัน
export const DEFAULT_STICKY_OFFSET_C = 20;
