// การเคลื่อนไหวของพื้นที่ทำงาน ใช้ Web Animations API ของเบราว์เซอร์ ไม่ต้องลงไลบรารีเพิ่ม
// เส้นโค้งเดียวทั้งแอป เล่นครั้งเดียว ข้ามทั้งหมดเมื่อผู้ใช้ตั้ง reduced motion

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Track = [number, number];
type Keys = { x?: Track; y?: Track; opacity?: Track; scale?: Track };
type Opts = { duration?: number; delay?: number; ease?: number[] | string };

/** แทน animate() ของ motion ที่สคริปต์เดิมเรียกผ่าน window.animateLaong (ค่าเวลาเป็นวินาที) */
export function animateLaong(el: Element, keys: Keys, opts: Opts = {}) {
  if (calm() || !(el instanceof HTMLElement || el instanceof SVGElement)) return;
  const frame = (i: 0 | 1): Keyframe => {
    const f: Keyframe = {};
    const t: string[] = [];
    if (keys.x) t.push(`translateX(${keys.x[i]}px)`);
    if (keys.y) t.push(`translateY(${keys.y[i]}px)`);
    if (keys.scale) t.push(`scale(${keys.scale[i]})`);
    if (t.length) f.transform = t.join(' ');
    if (keys.opacity) f.opacity = keys.opacity[i];
    return f;
  };
  const easing = Array.isArray(opts.ease) ? `cubic-bezier(${opts.ease.join(',')})` : opts.ease ?? EASE;
  return el.animate([frame(0), frame(1)], { duration: (opts.duration ?? 0.3) * 1000, delay: (opts.delay ?? 0) * 1000, easing });
}

/** เปลี่ยนหน้า: เนื้อหาขึ้นมาเบา ๆ (แบบเดียวกับเวอร์ชัน Vercel) */
export function pageIn(main: HTMLElement) {
  if (calm()) return;
  main.getAnimations().forEach((a) => a.cancel());
  main.animate([{ opacity: 0.65, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: EASE });
}

/** ส่วนเสริมของ LaOng: แถวในตารางและรายการไล่ขึ้นทีละแถว ตัวเลขสรุปนับขึ้นครั้งเดียว เล่นเฉพาะตอนเปิดหน้า */
export function enterDetails(main: HTMLElement) {
  if (calm()) return;
  const rows = main.querySelectorAll<HTMLElement>('.run-table tbody tr, .machine-row, .alert-list li, .visit-list li');
  rows.forEach((row, i) => {
    row.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 360, delay: 60 + Math.min(i, 10) * 40, easing: EASE, fill: 'backwards' });
  });
  main.querySelectorAll<HTMLElement>('.metrics strong').forEach((el) => countUp(el));
}

function countUp(el: HTMLElement) {
  const text = el.textContent?.trim() ?? '';
  if (!/^\d{1,4}$/.test(text)) return;
  const to = Number(text);
  if (to === 0) return;
  const t0 = performance.now();
  el.setAttribute('aria-label', text);
  const tick = (t: number) => {
    if (!el.isConnected) return;
    const p = Math.min(1, (t - t0) / 600);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = text; el.removeAttribute('aria-label'); }
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}
