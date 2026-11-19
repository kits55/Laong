// รันตัวอย่างสมมติ 7 รัน (ใช้ดูหน้าประวัติและรายงาน) ไม่ใช่ผลทดลองจริง
// ค่าทำนายคำนวณจากสูตรจริงผ่าน adapter ส่วนค่าที่ "อ่านได้" เป็นตัวเลขสมมติที่กำหนดเอง
import { SAMPLE_MATERIALS, SYNTHETIC_PROFILES } from '../config/synthetic';
import { predictTout } from '../core/adapter';
import type { Amendment, Point, RunRecord } from './types';
import { emptyLab, steadyInfo } from '../lib/runs';

interface Spec {
  id: string; date: string; material: string; profile: string; tin: number; feed: number; ts: number;
  delta: number | null; // ส่วนต่างที่สมมติระหว่างที่อ่านได้กับที่ทำนาย
  lab?: Partial<ReturnType<typeof emptyLab>>;
  status: RunRecord['status'];
  consent: RunRecord['consent'];
  events?: string[];
}

const SPECS: Spec[] = [
  { id: 'S-001', date: '2026-10-06T09:20:00', material: 'juice-mix', profile: 'syn-a', tin: 160, feed: 10, ts: 15, delta: 1.8, lab: { moisture: 4.1, aw: 0.31, solubility: 96.2, L: 82.1, a: 3.2, b: 14.5 }, status: 'success', consent: 'yes' },
  { id: 'S-002', date: '2026-10-09T13:05:00', material: 'juice-mix', profile: 'syn-a', tin: 150, feed: 9, ts: 15, delta: -2.4, lab: { moisture: 4.6, aw: 0.34, solubility: 95.1, L: 81.4, a: 3.6, b: 15.1 }, status: 'success', consent: 'yes', events: ['ผงติดผนัง'] },
  { id: 'S-003', date: '2026-10-14T10:40:00', material: 'juice-mix', profile: 'syn-b', tin: 170, feed: 10, ts: 18, delta: 3.1, lab: { moisture: 4.4, aw: 0.33, solubility: 94.8, L: 80.2, a: 3.9, b: 15.8 }, status: 'success', consent: 'undecided' },
  { id: 'S-004', date: '2026-10-17T15:10:00', material: 'bean-extract', profile: 'syn-a', tin: 160, feed: 8, ts: 12, delta: -0.9, lab: { moisture: 3.8, protein: 61.4, aw: 0.28, solubility: 88.5, L: 88.7, a: 0.9, b: 9.6 }, status: 'success', consent: 'no' },
  { id: 'S-005', date: '2026-10-21T11:30:00', material: 'bean-extract', profile: 'syn-b', tin: 175, feed: 10, ts: 12, delta: 6.2, lab: { moisture: 3.5, protein: 60.8, aw: 0.26, solubility: 87.9, L: 87.9, a: 1.1, b: 10.2 }, status: 'partial', consent: 'yes', events: ['ท่อป้อนอุดตัน', 'ลมตก'] },
  { id: 'S-006', date: '2026-10-28T09:55:00', material: 'juice-mix', profile: 'syn-a', tin: 155, feed: 9, ts: 16, delta: 0.4, status: 'success', consent: 'undecided' },
  { id: 'S-007', date: '2026-11-03T14:20:00', material: 'juice-mix', profile: 'syn-a', tin: 160, feed: 10, ts: 15, delta: null, status: 'open', consent: 'undecided' },
];

const RAMP_TOUT = [-35, -22, -12, -5, -1.5, 0.3, 0, -0.3];
const RAMP_TIN = [-40, -18, -6, -1.5, 0, 0, 0, 0];

/** คืนรันตัวอย่างเรียงใหม่สุดก่อน (runs[0] คือรันล่าสุดเสมอ) */
export function buildSeedRuns(): RunRecord[] {
  return [...SPECS].reverse().map((s) => {
    const profile = SYNTHETIC_PROFILES.find((p) => p.id === s.profile)!;
    const mat = SAMPLE_MATERIALS.find((m) => m.id === s.material)!;
    const out = predictTout({
      tin: s.tin, feedMlMin: s.feed, solidsFrac: s.ts / 100, airFlow: profile.airFlow,
      eta: profile.eta, ua: profile.ua, tfeed: profile.tfeed, troom: profile.troom,
    });
    if (!out.ok) throw new Error('seed prediction failed');
    const eta = out.prediction.eta!;
    const ua = out.prediction.ua!;
    let points: Point[] = [];
    if (s.delta !== null) {
      const m = Math.round((eta.tout + s.delta) * 10) / 10;
      points = RAMP_TOUT.map((off, i) => ({
        id: `${s.id}-p${i}`, tMin: i + 2, tin: s.tin + RAMP_TIN[i], tout: Math.round((m + off) * 10) / 10,
        pump: Math.round(s.feed / profile.pumpFactor), how: 'live' as const,
      }));
    }
    const st = steadyInfo(points);
    const amendments: Amendment[] = s.id === 'S-003'
      ? [{ id: 'A-001', at: '2026-10-15T09:10:00', by: 'ผู้ทบทวนตัวอย่าง', field: 'ความชื้น (ผลแล็บ)', from: '4.6', to: '4.4', reason: 'แก้ตัวเลขให้ตรงกับใบรายงานแล็บ' }]
      : [];
    return {
      id: s.id, label: s.id, dateISO: s.date, sample: true, profileId: s.profile, materialId: s.material, materialName: mat.name,
      inputs: { tin: s.tin, feedMlMin: s.feed, feedKind: 'assumed', solidsFrac: s.ts / 100, solidsKind: 'measured', airFlow: profile.airFlow },
      predicted: { eta: eta.tout, ua: ua.tout, extrapolated: eta.extrapolated || ua.extrapolated, modelVersion: out.prediction.modelVersion },
      measuredTout: st.mean === null ? null : Math.round(st.mean * 10) / 10,
      steadyReached: points.length ? st.reached : null,
      points,
      events: (s.events ?? []).map((label, i) => ({ id: `${s.id}-e${i}`, tMin: 5 + i * 2, label, note: '', ts: s.date })),
      durationMin: s.delta === null ? null : 38,
      lab: { ...emptyLab(), ...(s.lab ?? {}) },
      massBalance: s.delta === null || !s.lab ? { feedMassG: null, powderG: null } : { feedMassG: 380, powderG: 49 },
      status: s.status,
      checklist: (s.status === 'open' ? {} : { powder: true, labels: true, clean: true, power: true, notes: true }) as Record<string, boolean>,
      consent: s.consent,
      amendments,
    };
  });
}
