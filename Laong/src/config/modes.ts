// โหมดผู้ใช้ 4 แบบ: ตอนนี้เปลี่ยนเฉพาะข้อความต้อนรับ ภาพ และชุดของมาสคอต
// ยังไม่ซ่อนหรือเพิ่มฟังก์ชันตามโหมด (ตัดสินใจร่วมกับเจ้าของโครงการก่อนทำ)
export type AudienceMode = 'student' | 'university' | 'company' | 'factory';

export interface ModeInfo {
  value: AudienceMode;
  label: string;
  sub: string;
  tip: string;
  /** ชื่อไฟล์ภาพฉาก ใน public/images/art ไม่รวมส่วนท้าย -light หรือ -dark */
  art: string;
  /** ชื่อไฟล์มาสคอตแต่งตัว ใน public/mascot ไม่รวมส่วนท้าย -dark */
  mascot: string;
}

export const MODES: ModeInfo[] = [
  { value: 'student', label: 'นักเรียน', sub: 'เรียนรู้การทดลองทีละขั้น', tip: 'จดค่าไปทีละขั้น ลองกับข้อมูลตัวอย่างได้เลย ไม่มีอะไรเสียหาย', art: 'mode-student', mascot: 'mascot-mode-student' },
  { value: 'university', label: 'นักศึกษา', sub: 'ทำงานวิจัยและเก็บผลเป็นรายงาน', tip: 'เก็บผลทุกรัน เทียบค่าที่ทำนายกับค่าที่อ่านได้ แล้วส่งออกเป็นรายงาน', art: 'mode-university', mascot: 'mascot-mode-university' },
  { value: 'company', label: 'บริษัท', sub: 'ดูผลและส่งรายงานให้ทีม', tip: 'ดูผลล่าสุด เทียบรัน และส่งออกรายงานให้คนที่เกี่ยวข้อง', art: 'mode-company', mascot: 'mascot-mode-company' },
  { value: 'factory', label: 'โรงงาน', sub: 'จดค่าหน้าเครื่องให้เร็ว', tip: 'จดค่า Tin และ Tout หน้าเครื่องให้เร็ว และคำนวณอัตราป้อนจากการตวงให้', art: 'mode-factory', mascot: 'mascot-mode-factory' },
];

export const DEFAULT_MODE: AudienceMode = 'university';

export function modeInfo(m: AudienceMode): ModeInfo {
  return MODES.find((x) => x.value === m) ?? MODES[1];
}

export function isMode(v: unknown): v is AudienceMode {
  return typeof v === 'string' && MODES.some((m) => m.value === v);
}
