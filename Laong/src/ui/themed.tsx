// ภาพ SVG ที่มีสองธีม: วาดทั้งสองไฟล์แล้วให้ CSS ซ่อนอันที่ไม่ใช่ธีมปัจจุบัน
// ไม่ต้องรอ JavaScript จึงไม่มีภาพวูบผิดธีมตอนเปิดหน้า
const BASE = import.meta.env.BASE_URL;

interface Props {
  /** ชื่อไฟล์ใน public ไม่รวมนามสกุล และส่วนท้ายธีม */
  name: string;
  folder: 'images/art' | 'mascot';
  /** mascot: ไฟล์สว่างไม่มีส่วนท้าย ภาพอื่น: -light */
  lightSuffix?: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  /** โหลดทันที ใช้กับภาพที่สลับท่าบ่อย ไม่ให้วูบตอนเปลี่ยน */
  eager?: boolean;
}

export function ThemedImg({ name, folder, lightSuffix, alt = '', width, height, className, eager }: Props) {
  const light = lightSuffix ?? (folder === 'mascot' ? '' : '-light');
  const common = { alt, width, height, decoding: 'async' as const, loading: (eager ? 'eager' : 'lazy') as 'eager' | 'lazy' };
  return (
    <span className={`themed ${className ?? ''}`}>
      <img className="themed__light" src={`${BASE}${folder}/${name}${light}.svg`} {...common} />
      <img className="themed__dark" src={`${BASE}${folder}/${name}-dark.svg`} {...common} alt="" aria-hidden="true" />
    </span>
  );
}

/** มาสคอตท่าใดท่าหนึ่ง (ชื่อไฟล์ไม่ต้องมี mascot- นำหน้า) */
export function Mascot({ pose, size = 120, alt = '', className, eager }: { pose: string; size?: number; alt?: string; className?: string; eager?: boolean }) {
  const file = pose.startsWith('mascot-') ? pose : `mascot-${pose}`;
  return <ThemedImg name={file} folder="mascot" width={size} height={Math.round(size * 228 / 210)} alt={alt} className={className} eager={eager} />;
}
