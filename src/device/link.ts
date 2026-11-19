/*
 * การเชื่อมต่อบอร์ด ESP32 (WebSocket) ปิดไว้เป็นค่าเริ่มต้น เชื่อมต่อเมื่อผู้ใช้เปิดใช้งานและใส่ที่อยู่เอง
 * - ไม่มีการเชื่อมต่อออกนอกเครื่องจนกว่าจะเปิดใช้ (ที่อยู่บอร์ดมาจากผู้ใช้เท่านั้น)
 * - ส่งได้เฉพาะข้อความใน protocol.ts (เช็กสถานะและสั่งกล้อง) ไม่มีคำสั่งควบคุมเครื่อง
 * - ค่าที่มาจากบอร์ดในระยะนี้มีแค่สถานะ ความหน่วงที่แอปวัดเอง และชื่อ/เวอร์ชันที่บอร์ดแจ้ง ไม่ถูกนำเข้ารัน
 */
import { useSyncExternalStore } from 'react';
import { decode, encode, validateUrl, PROTOCOL_VERSION, type CamState } from './protocol';

export type LinkState = 'off' | 'connecting' | 'online' | 'error';

export interface DeviceState {
  enabled: boolean;
  url: string;
  camWithTimer: boolean;
  state: LinkState;
  error: string | null;
  rttMs: number | null;
  lastSeen: number | null;
  board: string | null;
  fw: string | null;
  cam: CamState | null;
  log: { t: number; dir: 'tx' | 'rx' | 'sys'; text: string }[];
}

const KEY = 'proto_device_v1';
const HEARTBEAT_MS = 5000;
const TIMEOUT_MS = 12000;

function load(): Pick<DeviceState, 'enabled' | 'url' | 'camWithTimer'> {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (j && typeof j === 'object') return { enabled: !!j.enabled, url: typeof j.url === 'string' ? j.url : '', camWithTimer: !!j.camWithTimer };
  } catch { /* ignore */ }
  return { enabled: false, url: '', camWithTimer: false };
}

let state: DeviceState = { ...load(), state: 'off', error: null, rttMs: null, lastSeen: null, board: null, fw: null, cam: null, log: [] };
const listeners = new Set<() => void>();
let ws: WebSocket | null = null;
let hb: number | undefined;
let retry: number | undefined;
let backoff = 2000;
let pingId = 0;
const pingSent = new Map<number, number>();
let userStopped = true;

function emit() { listeners.forEach((l) => l()); }
function set(p: Partial<DeviceState>) { state = { ...state, ...p }; emit(); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ enabled: state.enabled, url: state.url, camWithTimer: state.camWithTimer })); } catch { /* ignore */ } }
function log(dir: 'tx' | 'rx' | 'sys', text: string) { set({ log: [...state.log.slice(-29), { t: Date.now(), dir, text }] }); }

function clearTimers() { window.clearInterval(hb); window.clearTimeout(retry); hb = undefined; retry = undefined; }

function send(m: Parameters<typeof encode>[0]): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const text = encode(m);
  ws.send(text);
  log('tx', text);
  return true;
}

function scheduleRetry() {
  if (userStopped || !state.enabled) return;
  window.clearTimeout(retry);
  retry = window.setTimeout(open, backoff);
  backoff = Math.min(30000, backoff * 2);
}

function fail(msg: string) {
  clearTimers();
  try { ws?.close(); } catch { /* ignore */ }
  ws = null;
  set({ state: 'error', error: msg });
  log('sys', msg);
  scheduleRetry();
}

function open() {
  clearTimers();
  const check = validateUrl(state.url, window.location.protocol);
  if (!check.ok) { set({ state: 'error', error: `${check.what}. ${check.why}. ${check.fix}.` }); return; }
  set({ state: 'connecting', error: null });
  log('sys', `เชื่อมต่อ ${check.url}`);
  try { ws = new WebSocket(check.url); } catch { fail('เปิดการเชื่อมต่อไม่ได้. เบราว์เซอร์ไม่ยอมรับที่อยู่นี้. ตรวจที่อยู่แล้วลองใหม่.'); return; }
  const sock = ws;
  sock.onopen = () => {
    backoff = 2000;
    set({ state: 'online', error: null, lastSeen: Date.now() });
    send({ t: 'hello', app: 'laong', v: PROTOCOL_VERSION });
    send({ t: 'status' });
    hb = window.setInterval(() => {
      if (state.lastSeen && Date.now() - state.lastSeen > TIMEOUT_MS) { fail('บอร์ดไม่ตอบกลับ. อาจหลุดจากเครือข่ายหรือบอร์ดค้าง. ตรวจไฟและ Wi-Fi ของบอร์ด ระบบจะลองเชื่อมต่อใหม่เอง.'); return; }
      pingId += 1;
      pingSent.set(pingId, performance.now());
      send({ t: 'ping', id: pingId });
    }, HEARTBEAT_MS);
    // วัดความหน่วงทันทีหนึ่งครั้ง
    pingId += 1;
    pingSent.set(pingId, performance.now());
    send({ t: 'ping', id: pingId });
  };
  sock.onmessage = (ev) => {
    const raw = typeof ev.data === 'string' ? ev.data : '';
    const m = decode(raw);
    if (!m) { log('rx', '(ข้อความที่อ่านไม่ได้ ถูกทิ้ง)'); return; }
    log('rx', raw.slice(0, 200));
    const p: Partial<DeviceState> = { lastSeen: Date.now() };
    if (m.t === 'hello') { p.board = m.board ?? null; p.fw = m.fw ?? null; if (m.cam) p.cam = m.cam; }
    if (m.t === 'status' && m.cam) p.cam = m.cam;
    if (m.t === 'cam') p.cam = m.state;
    if (m.t === 'pong') { const s = pingSent.get(m.id); if (s !== undefined) { p.rttMs = Math.round(performance.now() - s); pingSent.delete(m.id); } }
    if (m.t === 'error') p.error = m.msg;
    set(p);
  };
  sock.onerror = () => { /* รายละเอียดมาที่ onclose */ };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    clearTimers();
    if (userStopped) { set({ state: 'off', error: null, rttMs: null, cam: null }); return; }
    set({ state: 'error', error: 'การเชื่อมต่อหลุด. บอร์ดอาจปิดอยู่หรืออยู่คนละเครือข่าย. ระบบจะลองเชื่อมต่อใหม่เอง.' });
    scheduleRetry();
  };
}

export const device = {
  get: () => state,
  setUrl(url: string) { set({ url }); persist(); },
  setCamWithTimer(v: boolean) { set({ camWithTimer: v }); persist(); },
  setEnabled(v: boolean) {
    set({ enabled: v });
    persist();
    if (v) device.connect(); else device.disconnect();
  },
  connect() {
    if (!state.enabled) return;
    userStopped = false;
    backoff = 2000;
    open();
  },
  disconnect() {
    userStopped = true;
    clearTimers();
    const w = ws;
    ws = null;
    try { w?.close(); } catch { /* ignore */ }
    set({ state: 'off', error: null, rttMs: null, cam: null });
  },
  ping() { pingId += 1; pingSent.set(pingId, performance.now()); return send({ t: 'ping', id: pingId }); },
  requestStatus() { return send({ t: 'status' }); },
  camStart(run: string) { return state.state === 'online' && state.camWithTimer ? send({ t: 'cam.start', run }) : false; },
  camStop() { return state.state === 'online' && state.camWithTimer ? send({ t: 'cam.stop' }) : false; },
  camSnap() { return state.state === 'online' ? send({ t: 'cam.snap' }) : false; },
};

if (typeof window !== 'undefined' && state.enabled && state.url) {
  // เปิดแอปใหม่ ถ้าเคยเปิดใช้ไว้ให้เชื่อมต่ออีกครั้ง
  setTimeout(() => device.connect(), 400);
}

export function useDevice(): DeviceState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

export const LINK_LABEL: Record<LinkState, string> = { off: 'ยังไม่เชื่อมต่อ', connecting: 'กำลังเชื่อมต่อ', online: 'เชื่อมต่อแล้ว', error: 'ผิดพลาด' };
export const CAM_LABEL: Record<CamState, string> = { none: 'ไม่พบกล้อง', ready: 'กล้องพร้อม', busy: 'กล้องกำลังทำงาน', error: 'กล้องผิดพลาด' };
