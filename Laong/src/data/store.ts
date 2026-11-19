/*
 * ที่เก็บสถานะของแอป (ไฟล์เดียว ไม่ใช้ไลบรารีเพิ่ม)
 * ข้อมูลไหลแบบนี้: หน้าจอ -> setState/updateCur -> state -> localStorage (key ขึ้นต้น proto_ เท่านั้น)
 * ร่างของรันปัจจุบัน (cur) บันทึกอัตโนมัติ 500ms หลังแก้ ปิดแท็บแล้วเปิดใหม่จะมีแถบกู้ร่าง
 */
import { useSyncExternalStore } from 'react';
import { SYNTHETIC_PROFILES, type Profile, SAMPLE_MATERIALS } from '../config/synthetic';
import type { Amendment, Cur, DraftFile, Plan, RunRecord, Session } from './types';
import { buildSeedRuns } from './seed';
import { freshCur, runFromCur } from '../lib/runs';
import { DEFAULT_MODE, isMode, type AudienceMode } from '../config/modes';
import { DEFAULT_MASCOT, isPlace, type MascotPrefs } from '../config/mascot';

export const KEYS = {
  mascot: 'proto_mascot',
  mode: 'proto_mode',
  runs: 'proto_runs',
  draft: 'proto_run_draft_v1',
  session: 'proto_session',
  theme: 'proto_theme',
  profiles: 'proto_machine_profiles_v1',
  activeProfile: 'proto_active_machine_profile_v1',
  onboarding: 'proto_onboarding_v1',
  plans: 'proto_experiment_plans_v1',
} as const;

export type Theme = 'auto' | 'light' | 'dark';

export interface AppState {
  session: Session | null;
  mode: AudienceMode;
  mascot: MascotPrefs;
  theme: Theme;
  profiles: Profile[];
  activeProfileId: string;
  runs: RunRecord[];
  plans: Plan[];
  onboarding: Record<string, boolean>;
  cur: Cur;
  pendingDraft: DraftFile | null;
  selectedRunId: string | null;
  savedTick: number; // เพิ่มทุกครั้งที่บันทึกร่าง ใช้โชว์ป้าย "บันทึกร่างแล้ว"
  savedAt: string | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* เต็มหรือถูกปิด ไม่ทำอะไร */
  }
}
function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function init(): AppState {
  const profiles = read<Profile[]>(KEYS.profiles, SYNTHETIC_PROFILES);
  const activeProfileId = read<string>(KEYS.activeProfile, profiles[0].id);
  const storedRuns = read<RunRecord[] | null>(KEYS.runs, null);
  const runs = storedRuns ?? buildSeedRuns();
  if (storedRuns === null) write(KEYS.runs, runs);
  const draft = read<DraftFile | null>(KEYS.draft, null);
  const hasDraft = !!draft && draft.cur && draft.cur.touched;
  return {
    session: read<Session | null>(KEYS.session, null),
    mode: (() => { const m = read<unknown>(KEYS.mode, DEFAULT_MODE); return isMode(m) ? m : DEFAULT_MODE; })(),
    mascot: (() => {
      const m = read<Partial<MascotPrefs> | null>(KEYS.mascot, null);
      return {
        hidden: m?.hidden === true,
        paused: m?.paused === true,
        weatherOn: m?.weatherOn !== false,
        place: isPlace(m?.place) ? m!.place! : DEFAULT_MASCOT.place,
      };
    })(),
    theme: read<Theme>(KEYS.theme, 'auto'),
    profiles,
    activeProfileId: profiles.some((p) => p.id === activeProfileId) ? activeProfileId : profiles[0].id,
    runs,
    plans: read<Plan[]>(KEYS.plans, []),
    onboarding: read<Record<string, boolean>>(KEYS.onboarding, {}),
    cur: freshCur(profiles.some((p) => p.id === activeProfileId) ? activeProfileId : profiles[0].id),
    pendingDraft: hasDraft ? (draft as DraftFile) : null,
    selectedRunId: null,
    savedTick: 0,
    savedAt: null,
  };
}

let state: AppState = init();
const listeners = new Set<() => void>();
let draftTimer: number | undefined;

function notify() { listeners.forEach((l) => l()); }

export function getState(): AppState { return state; }

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  const prev = state;
  state = { ...state, ...p };
  if (p.session !== undefined) (state.session ? write(KEYS.session, state.session) : remove(KEYS.session));
  if (p.mode !== undefined) write(KEYS.mode, state.mode);
  if (p.mascot !== undefined) write(KEYS.mascot, state.mascot);
  if (p.theme !== undefined) write(KEYS.theme, state.theme);
  if (p.profiles !== undefined) write(KEYS.profiles, state.profiles);
  if (p.activeProfileId !== undefined) write(KEYS.activeProfile, state.activeProfileId);
  if (p.runs !== undefined) write(KEYS.runs, state.runs);
  if (p.plans !== undefined) write(KEYS.plans, state.plans);
  if (p.onboarding !== undefined) write(KEYS.onboarding, state.onboarding);
  if (p.cur !== undefined && p.cur !== prev.cur) scheduleDraftSave();
  notify();
}

function scheduleDraftSave() {
  if (state.pendingDraft) return; // รอผู้ใช้ตัดสินใจเรื่องร่างเดิมก่อน ไม่เขียนทับ
  if (!state.cur.touched) return;
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    const at = new Date().toISOString();
    write(KEYS.draft, { savedAt: at, cur: state.cur } satisfies DraftFile);
    state = { ...state, savedTick: state.savedTick + 1, savedAt: at };
    notify();
  }, 500);
}

/** แก้ร่างของรันปัจจุบัน */
export function updateCur(fn: (c: Cur) => Cur | void) {
  const next = structuredClone(state.cur);
  const r = fn(next);
  setState({ cur: { ...((r as Cur) ?? next), touched: true } });
}

export function useAppState<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => sel(state),
    () => sel(state),
  );
}

/* ---------- การกระทำที่ใช้หลายหน้า ---------- */

export function activeProfile(s: AppState = state): Profile {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
}

export function useProfile(): Profile {
  return useAppState((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]);
}

export function useDraftRestore() {
  return {
    use() {
      const d = state.pendingDraft;
      if (!d) return;
      setState({ cur: d.cur, pendingDraft: null, activeProfileId: d.cur.profileId });
    },
    discard() {
      window.clearTimeout(draftTimer);
      remove(KEYS.draft);
      setState({ pendingDraft: null });
    },
  };
}

export function markOnboarding(key: string) {
  if (state.onboarding[key]) return;
  setState({ onboarding: { ...state.onboarding, [key]: true } });
}

export function selectProfile(id: string) {
  setState((s) => ({ activeProfileId: id, cur: { ...s.cur, profileId: id } }));
}

export function startNewRun() {
  window.clearTimeout(draftTimer);
  remove(KEYS.draft);
  setState((s) => ({ cur: freshCur(s.activeProfileId), pendingDraft: null }));
}

/** ปิดรัน: แปลงร่างเป็นบันทึกรัน เก็บเข้าประวัติ แล้วเริ่มร่างใหม่ */
export function closeCurrentRun(): RunRecord {
  const s = state;
  const profile = activeProfile(s);
  const mat = SAMPLE_MATERIALS.find((m) => m.id === s.cur.pre.materialId);
  const rec = runFromCur(s.cur, profile, s.cur.predicted, mat?.name ?? 'ไม่ระบุวัสดุ');
  window.clearTimeout(draftTimer);
  remove(KEYS.draft);
  setState({ runs: [rec, ...s.runs], cur: freshCur(s.activeProfileId), selectedRunId: rec.id });
  return rec;
}

export function addAmendment(runId: string, a: Omit<Amendment, 'id' | 'at'>, apply: (r: RunRecord) => RunRecord) {
  setState((s) => ({
    runs: s.runs.map((r) => (r.id === runId
      ? { ...apply(r), amendments: [...r.amendments, { ...a, id: `A-${r.amendments.length + 1}`.padEnd(5, '0'), at: new Date().toISOString() }] }
      : r)),
  }));
}

export function resetSampleData() {
  const runs = buildSeedRuns();
  setState({ runs, selectedRunId: null });
}

export function setMascot(patch: Partial<MascotPrefs>) {
  setState((s) => ({ mascot: { ...s.mascot, ...patch } }));
}

export function signOut() {
  setState({ session: null });
}

export function allProtoKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('proto_')) out.push(k);
    }
  } catch { /* ignore */ }
  return out;
}
