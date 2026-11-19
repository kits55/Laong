// ชนิดข้อมูลของรัน ร่าง และเซสชันของต้นแบบ
// ช่องกรอกเก็บเป็นข้อความ (string) ว่างคือยังไม่มีค่า เพื่อไม่ให้ค่าว่างกลายเป็น 0
import type { Kind, Num } from '../core/types';
import type { Prediction } from '../core/adapter';

export type Role = 'operator' | 'reviewer' | 'admin';
export interface Session { name: string; role: Role; email: string; at: string }

export interface PreInputs {
  materialId: string;
  tin: string;
  feedMode: 'ml' | 'pump';
  feedMl: string;
  pump: string;
  tsSource: 'measured' | 'assumed' | 'brix';
  ts: string;
  brix: string;
  md: string; // % มอลโตเดกซ์ทริน
  moisture: string; // % ความชื้นเป้าหมายของผง
  k: string;
  stickyOffset: string;
}

export interface PredSnapshot {
  at: string;
  inputsKey: string;
  profileId: string;
  tin: number;
  feedMlMin: number;
  feedKind: Extract<Kind, 'assumed' | 'proxy'>;
  solidsFrac: number;
  solidsKind: Extract<Kind, 'measured' | 'assumed' | 'proxy'>;
  prediction: Prediction;
}

export interface Point {
  id: string;
  tMin: number; // นาทีนับจากเริ่มจับเวลา
  tin: Num;
  tout: Num;
  pump: Num;
  how: 'live' | 'retro' | 'steady3';
}

export interface RunEvent { id: string; tMin: number; label: string; note: string; ts: string }
export interface Segment { id: string; label: string; startMin: number; endMin: Num }

export interface TimerState { status: 'idle' | 'running' | 'paused' | 'stopped'; startedAt: number | null; accMs: number }

export interface LabInputs { moisture: string; protein: string; aw: string; solubility: string; L: string; a: string; b: string }
export interface PostInputs {
  status: '' | 'success' | 'partial' | 'failed';
  feedMassG: string;
  powderG: string;
  lab: LabInputs;
  checklist: Record<string, boolean>;
  consent: 'undecided' | 'yes' | 'no';
}

export interface Cur {
  id: string;
  profileId: string;
  pre: PreInputs;
  predicted: PredSnapshot | null;
  preChecks: Record<string, boolean>;
  timer: TimerState;
  segmentLabel: string;
  segments: Segment[];
  points: Point[];
  events: RunEvent[];
  feedTest: { vol: string; sec: string };
  post: PostInputs;
  done: { 1: boolean; 2: boolean; 3: boolean };
  touched: boolean;
  startedISO: string | null;
}

export interface LabValues { moisture: Num; protein: Num; aw: Num; solubility: Num; L: Num; a: Num; b: Num }

export interface Amendment {
  id: string;
  at: string;
  by: string;
  field: string;
  from: string | null;
  to: string | null;
  reason: string;
}

export type RunStatus = 'success' | 'partial' | 'failed' | 'open';

export interface RunRecord {
  id: string;
  label: string;
  dateISO: string;
  sample: boolean;
  profileId: string;
  materialId: string;
  materialName: string;
  inputs: {
    tin: Num;
    feedMlMin: Num;
    feedKind: Extract<Kind, 'assumed' | 'proxy'>;
    solidsFrac: Num;
    solidsKind: Extract<Kind, 'measured' | 'assumed' | 'proxy'>;
    airFlow: Num;
  };
  predicted: { eta: Num; ua: Num; extrapolated: boolean; modelVersion: string | null };
  measuredTout: Num; // ค่าเฉลี่ย Tout ช่วงนิ่งที่คนจดจากหน้าจอเครื่อง (Observed)
  steadyReached: boolean | null;
  points: Point[];
  events: RunEvent[];
  durationMin: Num;
  lab: LabValues;
  massBalance: { feedMassG: Num; powderG: Num };
  status: RunStatus;
  checklist: Record<string, boolean>;
  consent: 'undecided' | 'yes' | 'no';
  amendments: Amendment[];
}

export interface DraftFile { savedAt: string; cur: Cur }

export interface Plan {
  id: string;
  name: string;
  seed: number;
  createdAt: string;
  rows: { n: number; tin: number; feed: number; ts: number; tout: Num; flag: string }[];
}
