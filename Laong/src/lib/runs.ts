// ฟังก์ชันอ่านค่าจากรัน (ไม่แตะ DOM ไม่แตะ storage ไม่ใช่สูตรฟิสิกส์)
import { STEADY, READ_BAND_C, SAMPLE_MATERIALS, type Profile } from '../config/synthetic';
import type { Num } from '../core/types';
import type { Cur, LabValues, Point, PreInputs, RunRecord, PredSnapshot } from '../data/types';
import { mean, parseNum, runId } from './util';

export interface SteadyInfo { reached: boolean; window: Point[]; mean: Num; spread: Num; count: number }

/** Tout 3 ค่าล่าสุด (ที่มีค่า) ห่างกันไม่เกินเกณฑ์ตัวอย่าง จึงนับว่านิ่ง */
export function steadyInfo(points: Point[]): SteadyInfo {
  const withTout = points.filter((p) => p.tout !== null).sort((a, b) => a.tMin - b.tMin);
  const win = withTout.slice(-STEADY.windowSize);
  if (win.length < STEADY.windowSize) return { reached: false, window: win, mean: null, spread: null, count: withTout.length };
  const vals = win.map((p) => p.tout as number);
  const spread = Math.max(...vals) - Math.min(...vals);
  return { reached: spread <= STEADY.maxSpreadC, window: win, mean: mean(vals), spread, count: withTout.length };
}

/** ความคลาดเคลื่อนของการทำนาย เป็น null จนกว่าจะมีค่าที่อ่านได้จริง (กฎข้อมูลข้อ 6) */
export function predictionError(run: Pick<RunRecord, 'measuredTout' | 'predicted'>): Num {
  if (run.measuredTout === null || run.predicted.eta === null) return null;
  return run.measuredTout - run.predicted.eta;
}

export function withinBand(err: Num): boolean | null {
  if (err === null) return null;
  return Math.abs(err) <= READ_BAND_C;
}

export function hasAnyLab(l: LabValues): boolean {
  return Object.values(l).some((v) => v !== null);
}

export interface Risk { level: 'danger' | 'warn' | 'info'; text: string }

/** ตรวจความเสี่ยงของรันจากข้อมูลที่มี ทุกข้อมาจากข้อเท็จจริงในรัน ไม่ใช่โมเดลใหม่ */
export function riskFlags(run: RunRecord): Risk[] {
  const out: Risk[] = [];
  if (run.measuredTout === null) out.push({ level: 'warn', text: 'ยังไม่มี Tout ที่อ่านได้ จึงเทียบกับที่ทำนายไม่ได้' });
  if (run.steadyReached === false) out.push({ level: 'warn', text: 'รันนี้ยังไม่ถึง steady state ตามเกณฑ์ตัวอย่าง ค่าเฉลี่ย Tout อาจยังเปลี่ยนอยู่' });
  if (run.predicted.extrapolated) out.push({ level: 'warn', text: 'โมเดลปรับค่าทำนายให้อยู่ในขอบเขตที่สมเหตุสมผล ผลทำนายอาจอยู่นอกช่วงที่เชื่อถือได้' });
  const err = predictionError(run);
  if (err !== null && Math.abs(err) > READ_BAND_C) out.push({ level: 'warn', text: `Tout ที่อ่านได้ต่างจากที่ทำนายเกินแนวอ่านผลราว ${READ_BAND_C} °C ควรตรวจค่าที่จดและโปรไฟล์เครื่อง` });
  if (!hasAnyLab(run.lab)) out.push({ level: 'info', text: 'ยังไม่มีผลแล็บ รายงานจะแสดงช่องแล็บเป็น ยังไม่มีค่า' });
  if (run.events.length > 0) out.push({ level: 'info', text: `มีเหตุการณ์ผิดปกติ ${run.events.length} รายการระหว่างรัน` });
  if (run.consent === 'undecided') out.push({ level: 'info', text: 'ยังไม่ได้ตัดสินใจเรื่องสิทธิ์ใช้ข้อมูลฝึกโมเดล ระบบจึงไม่ใช้ข้อมูลนี้ฝึกโมเดล' });
  if (run.sample) out.push({ level: 'info', text: 'นี่คือรันข้อมูลตัวอย่างสมมติ ใช้ดูการทำงานของหน้าจอเท่านั้น' });
  return out;
}

/** แปลงปริมาตรและเวลาจากการตวงจริง เป็นอัตราป้อน mL/min (การแปลงหน่วย ไม่ใช่สูตรในไฟล์ core) */
export function feedRateFromTest(volMl: Num, seconds: Num): Num {
  if (volMl === null || seconds === null || seconds <= 0 || volMl <= 0) return null;
  return volMl / (seconds / 60);
}

export const emptyLab = (): LabValues => ({ moisture: null, protein: null, aw: null, solubility: null, L: null, a: null, b: null });

export function labFromInputs(l: Cur['post']['lab']): LabValues {
  return {
    moisture: parseNum(l.moisture), protein: parseNum(l.protein), aw: parseNum(l.aw),
    solubility: parseNum(l.solubility), L: parseNum(l.L), a: parseNum(l.a), b: parseNum(l.b),
  };
}

export function defaultPre(materialId = SAMPLE_MATERIALS[0].id): PreInputs {
  const m = SAMPLE_MATERIALS.find((x) => x.id === materialId) ?? SAMPLE_MATERIALS[0];
  return {
    materialId: m.id, tin: '', feedMode: 'ml', feedMl: '', pump: '', tsSource: 'measured', ts: '', brix: '',
    md: String(m.defaultMd), moisture: '4', k: '4', stickyOffset: '20',
  };
}

export const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'powder', label: 'เก็บผงจากไซโคลนและชั่งน้ำหนักแล้ว' },
  { key: 'labels', label: 'ติดป้ายตัวอย่างและเก็บในภาชนะปิด' },
  { key: 'clean', label: 'ล้างระบบป้อนและท่อเรียบร้อย' },
  { key: 'power', label: 'ปิดเครื่องตามขั้นตอนแล้ว' },
  { key: 'notes', label: 'จดเหตุการณ์ผิดปกติครบแล้ว' },
];

export const EVENT_LABELS = ['ท่อป้อนอุดตัน', 'ผงติดผนัง', 'ลมตก', 'ไฟตก', 'หัวพ่นผิดปกติ', 'อื่น ๆ'];
export const SEGMENT_LABELS = ['อุ่นเครื่อง', 'ป้อนน้ำ', 'ป้อนสาร', 'ล้างระบบ'];

export function freshCur(profileId: string): Cur {
  return {
    id: runId(), profileId, pre: defaultPre(), predicted: null, preChecks: {},
    timer: { status: 'idle', startedAt: null, accMs: 0 },
    segmentLabel: SEGMENT_LABELS[0], segments: [], points: [], events: [],
    feedTest: { vol: '', sec: '' },
    post: { status: '', feedMassG: '', powderG: '', lab: { moisture: '', protein: '', aw: '', solubility: '', L: '', a: '', b: '' }, checklist: {}, consent: 'undecided' },
    done: { 1: false, 2: false, 3: false }, touched: false, startedISO: null,
  };
}

export function elapsedMs(t: Cur['timer'], now = Date.now()): number {
  return t.accMs + (t.status === 'running' && t.startedAt ? now - t.startedAt : 0);
}

export function runFromCur(cur: Cur, profile: Profile, snap: PredSnapshot | null, materialName: string): RunRecord {
  const st = steadyInfo(cur.points);
  const measured = st.mean === null ? null : Math.round(st.mean * 10) / 10;
  const lab = labFromInputs(cur.post.lab);
  const durationMs = elapsedMs(cur.timer);
  return {
    id: cur.id,
    label: cur.id,
    dateISO: cur.startedISO ?? new Date().toISOString(),
    sample: false,
    profileId: cur.profileId,
    materialId: cur.pre.materialId,
    materialName,
    inputs: {
      tin: snap?.tin ?? null,
      feedMlMin: snap?.feedMlMin ?? null,
      feedKind: snap?.feedKind ?? 'assumed',
      solidsFrac: snap?.solidsFrac ?? null,
      solidsKind: snap?.solidsKind ?? 'assumed',
      airFlow: profile.airFlow,
    },
    predicted: {
      eta: snap?.prediction.eta?.tout ?? null,
      ua: snap?.prediction.ua?.tout ?? null,
      extrapolated: !!(snap?.prediction.eta?.extrapolated || snap?.prediction.ua?.extrapolated),
      modelVersion: snap?.prediction.modelVersion ?? null,
    },
    measuredTout: measured,
    steadyReached: cur.points.length ? st.reached : null,
    points: cur.points,
    events: cur.events,
    durationMin: durationMs > 0 ? Math.round((durationMs / 60000) * 10) / 10 : null,
    lab,
    massBalance: { feedMassG: parseNum(cur.post.feedMassG), powderG: parseNum(cur.post.powderG) },
    status: cur.post.status === '' ? 'open' : cur.post.status,
    checklist: cur.post.checklist,
    consent: cur.post.consent,
    amendments: [],
  };
}

export const STATUS_LABEL: Record<RunRecord['status'], string> = {
  success: 'จบรันสำเร็จ',
  partial: 'จบก่อนกำหนด',
  failed: 'รันไม่สำเร็จ',
  open: 'ยังไม่ปิดรัน',
};
