// ฉากหลังของหัวหน้า landing: ภาพห้องแล็บอนาคต (เจนจาก Higgsfield) + ละอองสองชั้นวาดด้วยโค้ด
// ความลึกมาจากชั้นที่เลื่อนไม่เท่ากัน: ภาพช้าสุด ละอองไกลกลาง ละอองใกล้เร็วสุด
// การเคลื่อนไหว: ภาพค่อย ๆ ซูมออกเองครั้งเดียวตอนเปิดหน้า แล้วขยับตามการเลื่อนและเมาส์เท่านั้น ไม่มีอะไรวนไม่หยุด
// reduced motion: ภาพนิ่งทั้งหมด  ไม่มีไฟล์ภาพ: ใช้พื้นทีลเข้ม + ละออง หน้าไม่แตก
import { useEffect, useRef, useState } from 'react';
import { GenImg } from './genImg';

const BASE = import.meta.env.BASE_URL;

/** ตำแหน่งละอองแบบสุ่มคงที่ (seed) ให้ทุกครั้งที่เปิดหน้าเหมือนเดิม กระจุกทางขวาที่เครื่องอยู่ */
function droplets(seed: number, n: number, rMin: number, rMax: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => {
    const x = 760 + Math.pow(rnd(), 0.7) * 820;
    const y = 60 + rnd() * 780;
    return { x, y, r: rMin + rnd() * (rMax - rMin), o: 0.25 + rnd() * 0.5 };
  });
}
const FAR = droplets(7, 46, 1.2, 3.2);
const NEAR = droplets(29, 14, 3.5, 7.5);

function Mist({ dots, className }: { dots: typeof FAR; className: string }) {
  return (
    <svg className={className} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o} />)}
    </svg>
  );
}

/** วิดีโอสั้นจาก Seedance (ถ้ามีไฟล์ hero-bg.mp4) เล่นครั้งเดียวแล้วค้างเฟรมสุดท้าย ถ้าไม่มีไฟล์จะซ่อนตัวเอง */
function PlateVideo() {
  const [ok, setOk] = useState(true);
  const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!ok || calm) return null;
  return (
    <video className="lp-scene__video" src={`${BASE}images/gen/hero-bg.mp4`} muted playsInline autoPlay preload="auto"
      disablePictureInPicture aria-hidden="true" tabIndex={-1}
      onError={() => setOk(false)} onPlaying={(e) => e.currentTarget.setAttribute('data-ready', '')} />
  );
}

export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 759px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 759px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.setAttribute('data-move', '');
    const fine = window.matchMedia('(pointer: fine)').matches;
    let tx = 0, ty = 0, mx = 0, my = 0, raf = 0;

    const frame = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      mx += (tx - mx) * 0.08;
      my += (ty - my) * 0.08;
      el.style.setProperty('--hs', s.toFixed(4));
      el.style.setProperty('--mx', mx.toFixed(4));
      el.style.setProperty('--my', my.toFixed(4));
      // เมาส์ค่อย ๆ ตามไปจนนิ่งแล้วหยุด ไม่วนต่อ
      if (Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      if (e.clientY > r.bottom) return;
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    };
    const onLeave = () => { tx = 0; ty = 0; kick(); };

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    if (fine) { host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave); }
    kick();
    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // จอกว้าง: ภาพนิ่งคือเฟรมแรกของวิดีโอ วิดีโอเล่นต่อจากภาพนั้นพอดีจึงไม่กระตุก และเป็นตัว "เลื่อนเอง" แทนการซูมด้วย CSS
  // จอแคบ: ไม่โหลดวิดีโอ ใช้ภาพนิ่งอีกรูปที่ซูมออกเองครั้งเดียว
  const desktop = <GenImg name="hero-bg" ext="jpg" className="lp-scene__img" width={1920} height={1080} eager alt="" />;
  return (
    <div className="lp-scene" ref={ref} aria-hidden="true">
      <div className="lp-scene__plate">
        <div className={narrow ? 'lp-scene__intro' : 'lp-scene__intro lp-scene__intro--video'}>
          {narrow ? <GenImg name="hero-bg-mobile" ext="webp" className="lp-scene__img" width={1672} height={941} eager alt="" fallback={desktop} /> : desktop}
          {narrow ? null : <PlateVideo />}
        </div>
      </div>
      <Mist dots={FAR} className="lp-scene__mist lp-scene__mist--far" />
      <Mist dots={NEAR} className="lp-scene__mist lp-scene__mist--near" />
      <div className="lp-scene__scrim" />
    </div>
  );
}
