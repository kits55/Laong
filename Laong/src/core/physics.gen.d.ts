// ชนิดข้อมูลของไฟล์ที่ห่อสูตร (physics.gen.js สร้างโดย scripts/gen-core.mjs)
export function createPhysics(): {
  PHYSICS: any;
  TG_WATER: number;
  TG_MD_DRY: number;
  TG_COMP: Record<string, { lo: number; mid: number; hi: number; label: string }>;
  CP_AIR: number;
  CP_W: number;
  CP_SOL: number;
  RHO_AIR: number;
  T_FLOOR: number;
  lambda: (t: number) => number;
};
export const PHYSICS_HASH: string;
export const TG_HASH: string;
