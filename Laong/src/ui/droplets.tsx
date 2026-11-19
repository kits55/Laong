// ลายหยดละอองประจำแบรนด์: หยดที่ค่อย ๆ เล็กลงจากหัวพ่นไปทางผง
// วาดแบบกำหนดตำแหน่งตายตัว (ไม่สุ่ม) เล่นครั้งเดียวตอนโหลด ไม่วนซ้ำ

export function LaongMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="mark">
      <circle cx="10" cy="11" r="7.5" fill="currentColor" />
      <circle cx="21.5" cy="17" r="4.6" fill="currentColor" opacity="0.8" />
      <circle cx="27" cy="25" r="2.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** เส้นทางของละออง: สร้างวงกลมเรียงตามแนวโค้งจากซ้ายบนไปขวาล่าง ขนาดลดลงตามระยะ */
/**
 * ละอองที่พุ่งออกจากหัวพ่นต่อเนื่อง (ใช้เฉพาะงานตกแต่ง: หน้าเข้าสู่ระบบและสถานะว่าง)
 * เสถียร: ใช้ CSS transform กับ opacity อย่างเดียว ไม่มี JavaScript ต่อเฟรม ไม่มีการสุ่มขณะเล่น
 * หยุดเองเมื่อแท็บไม่ได้เปิดอยู่ (data-idle) และหยุดเมื่อผู้ใช้ตั้ง reduced motion (เหลือลายนิ่งเดิม)
 */
export function SprayField({ width = 640, height = 420, rays = 9, perRay = 9, originX = 0.02, originY = 0.5, spread = 0.62, className }: {
  width?: number; height?: number; rays?: number; perRay?: number; originX?: number; originY?: number; spread?: number; className?: string;
}) {
  const ox = width * originX, oy = height * originY, L = width * 0.98;
  const dots: { x: number; y: number; r: number; o: number; bx: number; by: number; dur: number; del: number; i: number }[] = [];
  let i = 0;
  for (let a = 0; a < rays; a++) {
    const ang = (a / Math.max(1, rays - 1) - 0.5) * spread * 2;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    for (let k = 0; k < perRay; k++) {
      const t = Math.min(0.98, (k + 0.6) / (perRay + 0.2) + Math.sin(a * 3.1 + k * 1.7) * 0.02);
      const dist = L * Math.pow(t, 1.05);
      dots.push({
        x: ox + cos * dist, y: oy + sin * dist, r: 11 * Math.pow(1 - t, 1.5) + 1.5, o: 0.3 + (1 - t) * 0.6,
        bx: -cos * dist * 0.32, by: -sin * dist * 0.32,
        dur: 5.6 + (k % 4) * 0.7, del: -(((a * 7 + k * 3) % 11) * 0.55 + (k % 3) * 0.2), i: i++,
      });
    }
  }
  return (
    <svg className={`spray ${className ?? ''}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {dots.map((d) => (
        <circle key={d.i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(1)} opacity={d.o.toFixed(2)}
          style={{ ['--bx' as string]: `${d.bx.toFixed(1)}px`, ['--by' as string]: `${d.by.toFixed(1)}px`, ['--dur' as string]: `${d.dur}s`, ['--del' as string]: `${d.del.toFixed(2)}s` }} />
      ))}
    </svg>
  );
}

/** เส้นทางของละออง: สร้างวงกลมเรียงตามแนวโค้งจากซ้ายบนไปขวาล่าง ขนาดลดลงตามระยะ */
export function DropletField({ width = 520, height = 320, count = 64, className }: { width?: number; height?: number; count?: number; className?: string }) {
  const dots: { x: number; y: number; r: number; o: number; i: number }[] = [];
  const rows = 7;
  const perRow = Math.ceil(count / rows);
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < perRow; c++) {
      const t = (c + row * 0.37) / (perRow + rows * 0.37); // 0 ถึง 1 ตามระยะจากหัวพ่น
      const spread = 0.12 + t * 0.9;
      const y = height * (0.08 + (row / (rows - 1)) * 0.84 * spread + (1 - spread) * 0.42 - 0.04);
      const x = 18 + t * (width - 36) + Math.sin(row * 1.7 + c * 0.9) * 6;
      const r = Math.max(1.4, 13 * Math.pow(1 - t, 1.5) + 1.4);
      dots.push({ x, y, r, o: 0.28 + (1 - t) * 0.6, i: i++ });
    }
  }
  return (
    <svg className={`droplets ${className ?? ''}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {dots.map((d) => (
        <circle key={d.i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(1)} opacity={d.o.toFixed(2)} style={{ ['--i' as string]: d.i }} />
      ))}
    </svg>
  );
}
