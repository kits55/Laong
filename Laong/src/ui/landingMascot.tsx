// น้องละอองบนหน้า landing: นั่งบนมุมการ์ดรันในหัวหน้า
// เปิดหน้า: ตกลงมาจากด้านบน ยุบตัวตอนแตะการ์ดแล้วเด้งเข้าที่ ทักทายครั้งเดียว
// จอคอม: หันตามเมาส์  แตะหรือคลิก: กระโดดดีใจหนึ่งครั้ง  ไม่มีท่าที่วนเองไม่หยุด
// reduced motion: ไม่ตก ไม่กระโดด แต่ยังหันตามเมาส์และเปลี่ยนท่าตอนแตะได้
import { useEffect, useRef, useState } from 'react';
import { Mascot } from './themed';

const BASE = import.meta.env.BASE_URL;
const POSES = ['hop', 'joy', 'idle', 'look-left', 'look-right', 'celebrate'];

type Phase = 'wait' | 'drop' | 'hello' | 'rest' | 'cheer';

export function LandingMascot() {
  const [phase, setPhase] = useState<Phase>('wait');
  const [look, setLook] = useState<'idle' | 'look-left' | 'look-right'>('idle');
  const [say, setSay] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => {
    // โหลดทุกท่าไว้ก่อน สลับท่าแล้วไม่วูบ
    const dark = document.documentElement.dataset.theme === 'dark' ? '-dark' : '';
    POSES.forEach((p) => { const i = new Image(); i.src = `${BASE}mascot/mascot-${p}${dark}.svg`; });

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) { setPhase('rest'); setSay(true); later(4200, () => setSay(false)); }
    else {
      later(700, () => setPhase('drop'));
      later(1400, () => { setPhase('hello'); setSay(true); });
      later(2600, () => setPhase('rest'));
      later(5600, () => setSay(false));
    }

    // หันตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์)
    if (!window.matchMedia('(pointer: fine)').matches) return () => timers.current.forEach(clearTimeout);
    let raf = 0, x = 0;
    const apply = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      setLook(Math.abs(dx) < 80 ? 'idle' : dx < 0 ? 'look-left' : 'look-right');
    };
    const onMove = (e: PointerEvent) => { x = e.clientX; if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const cheer = () => {
    if (phase === 'cheer' || phase === 'wait' || phase === 'drop') return;
    setPhase('cheer');
    setSay(false);
    later(1300, () => setPhase('rest'));
  };

  const pose = phase === 'drop' ? 'hop' : phase === 'hello' ? 'joy' : phase === 'cheer' ? 'celebrate' : look;

  return (
    <div className="lp-buddy" data-phase={phase}>
      <p className="lp-buddy__say" data-show={say ? '' : undefined} aria-hidden={!say}>สวัสดี ฉันชื่อละออง</p>
      <button ref={ref} type="button" className="lp-buddy__btn" onClick={cheer} aria-label="น้องละออง มาสคอตของ LaOng แตะเพื่อให้กระโดด">
        <span className="lp-buddy__body"><Mascot pose={pose} size={92} eager /></span>
      </button>
    </div>
  );
}
