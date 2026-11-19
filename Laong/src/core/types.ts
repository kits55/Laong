// ชนิดป้ายที่มาของข้อมูล 9 ชนิดตามกฎข้อมูลข้อ 4 ของบรีฟ ห้ามเพิ่มหรือเปลี่ยนความหมาย
export type Kind =
  | 'measured'
  | 'observed'
  | 'calculated'
  | 'predicted'
  | 'proxy'
  | 'assumed'
  | 'validated'
  | 'unvalidated'
  | 'missing';

export type Num = number | null;

export const KIND_INFO: Record<Kind, { word: string; glyph: string; meaning: string }> = {
  measured: { word: 'Measured', glyph: '●', meaning: 'ค่าที่วัดจริงด้วยเครื่องมือหรือแล็บ' },
  observed: { word: 'Observed', glyph: '◐', meaning: 'ค่าที่คนอ่านหรือจดจากหน้าจอเครื่อง' },
  calculated: { word: 'Calculated', glyph: 'ƒ', meaning: 'ค่าที่คำนวณจากสูตรของระบบ' },
  predicted: { word: 'Predicted', glyph: '◇', meaning: 'ค่าที่โมเดลทำนายก่อนมีค่าวัดจริง' },
  proxy: { word: 'Proxy', glyph: '≈', meaning: 'ค่าที่ใช้แทนค่าจริง ต้องติดป้ายทุกครั้ง' },
  assumed: { word: 'Assumed', glyph: '?', meaning: 'ค่าที่สมมติไว้' },
  validated: { word: 'Validated', glyph: '✓', meaning: 'ผ่านการตรวจกับค่าวัดจริงแล้ว' },
  unvalidated: { word: 'Unvalidated', glyph: '!', meaning: 'ผลคำนวณที่ยังไม่ผ่านการตรวจสอบ ห้ามใช้ตัดสินใจหน้างาน' },
  missing: { word: 'Missing', glyph: '✕', meaning: 'ยังไม่มีค่า (ค่าว่าง ไม่ใช่ 0)' },
};

export const KIND_ORDER: Kind[] = [
  'measured', 'observed', 'calculated', 'predicted', 'proxy', 'assumed', 'validated', 'unvalidated', 'missing',
];
