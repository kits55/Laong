/*
 * ข้อความระหว่างเว็บ Laong กับบอร์ด ESP32 (JSON ผ่าน WebSocket) ไฟล์นี้เป็นฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องมีบอร์ด
 *
 * ขอบเขตที่ตั้งใจไว้ (ตามบรีฟ: ระบบช่วยตัดสินใจ ไม่ได้ควบคุมเครื่อง):
 * ข้อความที่เว็บส่งได้มีเฉพาะ เช็กสถานะ (hello, ping, status) และสั่งกล้องที่ต่อกับบอร์ด (cam.*)
 * ไม่มีข้อความสั่งงาน Spray Dryer (ฮีตเตอร์ ปั๊ม พัดลม) และ encode() จะปฏิเสธข้อความอื่นทุกชนิด
 */

export const PROTOCOL_VERSION = 1;

export type CamState = 'none' | 'ready' | 'busy' | 'error';

export type OutMsg =
  | { t: 'hello'; app: 'laong'; v: number }
  | { t: 'ping'; id: number }
  | { t: 'status' }
  | { t: 'cam.start'; run: string }
  | { t: 'cam.stop' }
  | { t: 'cam.snap' };

export type InMsg =
  | { t: 'hello'; board?: string; fw?: string; cam?: CamState }
  | { t: 'pong'; id: number }
  | { t: 'status'; cam?: CamState; uptimeS?: number }
  | { t: 'cam'; state: CamState; note?: string }
  | { t: 'error'; msg: string };

export const ALLOWED_OUT: readonly string[] = ['hello', 'ping', 'status', 'cam.start', 'cam.stop', 'cam.snap'];
const CAM_STATES: readonly string[] = ['none', 'ready', 'busy', 'error'];
const MAX_IN_LEN = 2000;

export function encode(m: OutMsg): string {
  if (!ALLOWED_OUT.includes(m.t)) throw new Error(`ข้อความชนิด ${String((m as { t: string }).t)} ไม่อยู่ในรายการที่ส่งได้`);
  return JSON.stringify(m);
}

const str = (v: unknown, max = 80): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const cam = (v: unknown): CamState | undefined => (typeof v === 'string' && CAM_STATES.includes(v) ? (v as CamState) : undefined);

/** อ่านข้อความจากบอร์ดอย่างปลอดภัย ข้อความที่รูปแบบไม่ตรงถูกทิ้ง (คืน null) ไม่เดาค่า */
export function decode(raw: unknown): InMsg | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_IN_LEN) return null;
  let j: any;
  try { j = JSON.parse(raw); } catch { return null; }
  if (!j || typeof j !== 'object' || typeof j.t !== 'string') return null;
  switch (j.t) {
    case 'hello': return { t: 'hello', board: str(j.board), fw: str(j.fw, 40), cam: cam(j.cam) };
    case 'pong': return typeof j.id === 'number' && Number.isFinite(j.id) ? { t: 'pong', id: j.id } : null;
    case 'status': return { t: 'status', cam: cam(j.cam), uptimeS: typeof j.uptimeS === 'number' && Number.isFinite(j.uptimeS) ? j.uptimeS : undefined };
    case 'cam': { const s = cam(j.state); return s ? { t: 'cam', state: s, note: str(j.note, 120) } : null; }
    case 'error': return { t: 'error', msg: str(j.msg, 160) ?? 'บอร์ดแจ้งข้อผิดพลาด' };
    default: return null;
  }
}

export type UrlCheck = { ok: true; url: string } | { ok: false; what: string; why: string; fix: string };

/** ตรวจที่อยู่บอร์ด: ต้องเป็น ws:// หรือ wss:// และหน้าเว็บแบบ https ใช้ได้เฉพาะ wss:// */
export function validateUrl(input: string, pageProtocol: string): UrlCheck {
  const url = input.trim();
  if (!url) return { ok: false, what: 'ยังไม่มีที่อยู่บอร์ด', why: 'ระบบต้องรู้ที่อยู่ของบอร์ดจึงจะเชื่อมต่อได้', fix: 'กรอกที่อยู่ เช่น ws://192.168.1.50:81' };
  if (!/^wss?:\/\/[^\s/?#@]+(:\d{1,5})?(\/[^\s]*)?$/i.test(url)) {
    return { ok: false, what: 'รูปแบบที่อยู่ไม่ถูกต้อง', why: 'ที่อยู่ต้องขึ้นต้นด้วย ws:// หรือ wss:// ตามด้วยไอพีหรือชื่อเครื่อง', fix: 'ตัวอย่างที่ถูก: ws://192.168.1.50:81' };
  }
  if (pageProtocol === 'https:' && /^ws:\/\//i.test(url)) {
    return { ok: false, what: 'หน้านี้เปิดแบบ https จึงใช้ ws:// ไม่ได้', why: 'เบราว์เซอร์บล็อกการเชื่อมต่อที่ไม่เข้ารหัสจากหน้า https', fix: 'ใช้ wss:// ที่บอร์ดรองรับ หรือเปิดแอปแบบ http ในเครือข่ายเดียวกับบอร์ด' };
  }
  return { ok: true, url };
}
