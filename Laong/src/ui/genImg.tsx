// ภาพที่เจนจาก Higgsfield วางใน public/images/gen/ ชื่อตามที่กำหนด (.webp, .png หรือ .jpg ก็ได้)
// ถ้ายังไม่มีไฟล์ จะแสดง fallback (หรือไม่แสดงอะไร) เพื่อให้หน้าไม่มีรูปแตก
import { useState, type ReactNode } from 'react';

const BASE = import.meta.env.BASE_URL;
const EXTS = ['webp', 'png', 'jpg'];

export function GenImg({ name, alt, width, height, className, eager, fallback = null, ext }: {
  name: string; alt: string; width: number; height: number; className?: string; eager?: boolean; fallback?: ReactNode;
  /** รู้นามสกุลแน่แล้ว ระบุไว้ ไม่ต้องลองทีละแบบ (ลด 404) */
  ext?: string;
}) {
  const exts = ext ? [ext] : EXTS;
  const [i, setI] = useState(0);
  if (i >= exts.length) return <>{fallback}</>;
  return (
    <img
      className={className}
      src={`${BASE}images/gen/${name}.${exts[i]}`}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setI((n) => n + 1)}
    />
  );
}
