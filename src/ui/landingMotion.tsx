// การเคลื่อนไหวตอนเลื่อนหน้า landing
// กติกา: เนื้อหาทุกอย่างมองเห็นได้แม้สคริปต์ไม่ทำงาน ไม่มีอนิเมชันวนไม่หยุด และไม่มีมาสคอตในส่วนนี้
// เมื่อผู้ใช้ตั้ง reduced motion จะเหลือเฉพาะแถบความคืบหน้ากับการติดสว่างของขั้นตอน
import { useEffect, useRef, useState } from 'react';
import { Metric } from './kit';

const STEP_EVENT = 'lp-step';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** ตัวอย่างหน้าจอของแต่ละขั้น สร้างจากชิ้นส่วนจริงของแอป (Metric, Chip) ด้วยข้อมูลตัวอย่างชุดเดียวกับรัน S-007 */
export function StepView({ at }: { at: number }) {
  switch (at) {
    case 0: return <><Metric label="Tout ที่ทำนาย" value={81.1} unit="°C" kind="predicted" /><Metric label="Tout ที่อ่านได้" value={null} unit="°C" kind="observed" /></>;
    case 1: return <><Metric label="Tin ที่จด" value={150} unit="°C" kind="observed" /><Metric label="Tout ที่จด" value={82.0} unit="°C" kind="observed" /></>;
    case 2: return <><Metric label="ผลผลิต" value={47.0} unit="%" kind="calculated" /><Metric label="ความชื้น" value={3.9} unit="%" kind="observed" /></>;
    case 3: return <><Metric label="ผลต่าง Tout" value={0.9} unit="°C" kind="calculated" /><Metric label="รันที่ปิดแล้ว" value={7} unit="รัน" kind="observed" /></>;
    default: return <ul className="lp-stage__list"><li>สรุปเป็น CSV</li><li>CSV รายนาที</li><li>พิมพ์รายงานหนึ่งรัน</li></ul>;
  }
}

/** การ์ดข้างรายการห้าขั้น: ขั้นที่เลื่อนถึงพร้อมตัวอย่างหน้าจอของขั้นนั้นและเส้นความคืบหน้า */
export function StepStage({ steps }: { steps: string[] }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setAt((e as CustomEvent<number>).detail);
    window.addEventListener(STEP_EVENT, on);
    return () => window.removeEventListener(STEP_EVENT, on);
  }, []);
  return (
    <div className="lp-stage" aria-hidden="true">
      <div className="lp-stage__t">
        <span className="lp-stage__n">{at + 1} / {steps.length}</span>
        <strong>{steps[at]}</strong>
      </div>
      <div className="lp-stage__view" key={at}><StepView at={at} /></div>
      <span className="lp-stage__line" />
      <span className="lp-stage__tag">ข้อมูลตัวอย่าง</span>
    </div>
  );
}

/** แถบความคืบหน้าใต้หัวหน้า (จอเล็กถึงกลาง) */
export function ScrollBar() {
  return <span className="lp-progress" aria-hidden="true" />;
}

/** ตัวคุมการเคลื่อนไหวทั้งหน้า (ความคืบหน้าการเลื่อน ขั้นตอนที่ติดสว่าง การเผยภาพ) วางไว้ใน .landing หนึ่งตัว */
export function ScrollMotion() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>('.landing');
    if (!host) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    const steps = host.querySelector<HTMLElement>('.lp-steps');
    const how = host.querySelector<HTMLElement>('.lp-how');
    const pin = host.querySelector<HTMLElement>('.lp-how__pin');
    let stepAt = -1;
    const stepItems = steps ? Array.from(steps.children) as HTMLElement[] : [];

    host.classList.add('lp-live');
    if (!calm) host.classList.add('lp-move');

    let raf = 0;
    const frame = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = Math.max(1, root.scrollHeight - vh);
      host.style.setProperty('--lp-p', clamp(y / max, 0, 1).toFixed(4));

      // ห้าขั้นตอนติดสว่างตามที่เลื่อนถึง
      if (steps && stepItems.length) {
        // จอใหญ่: ส่วนนี้ถูกตรึงไว้ระหว่างเลื่อน ความคืบหน้าคิดจากระยะที่ตรึง จอเล็ก: คิดจากตำแหน่งรายการ
        const pinned = !!how && !!pin && getComputedStyle(pin).position === 'sticky';
        let p: number;
        if (pinned) {
          const r = how!.getBoundingClientRect();
          const top = parseFloat(getComputedStyle(pin!).top) || 0;
          p = clamp((top - r.top) / Math.max(1, r.height - pin!.offsetHeight), 0, 1);
        } else {
          const r = steps.getBoundingClientRect();
          p = clamp((vh * 0.72 - r.top) / Math.max(1, r.height), 0, 1);
        }
        const len = stepItems.length;
        const at = Math.min(len - 1, Math.floor(p * len));
        (how ?? steps).style.setProperty('--lp-steps', p.toFixed(3));
        stepItems.forEach((li, i) => {
          li.toggleAttribute('data-on', pinned ? i <= at : p > i / len + 0.02);
          li.toggleAttribute('data-cur', pinned && i === at);
        });
        if (at !== stepAt) { stepAt = at; window.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: at })); }
      }

    };

    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();

    // จังหวะที่เล่นครั้งเดียวเมื่อเลื่อนมาถึง (ภาพค่อย ๆ เผย การ์ดโหมดกระโดดไล่กัน น้องเต้นท้ายหน้า)
    let io: IntersectionObserver | undefined;
    if (!calm && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) el.setAttribute('data-in', '');
          else if (el.dataset.lpIn === 'replay') el.removeAttribute('data-in');
        }
      }, { threshold: 0.12 });
      host.querySelectorAll('[data-lp-in]').forEach((el) => io!.observe(el));
    } else if (!calm) {
      host.querySelectorAll('[data-lp-in]').forEach((el) => el.setAttribute('data-in', ''));
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      host.classList.remove('lp-live', 'lp-move');
    };
  }, []);

  return <div ref={ref} hidden aria-hidden="true" />;
}
