// หน้าก่อนเข้าสู่ระบบ แยกเป็นสองหน้า
// #/welcome: ฉากเต็มจอหน้าเดียว ไม่ต้องเลื่อน  #/how: รายละเอียดวิธีทำงาน ภาพแบบเรียบชุดเดียวทั้งหน้า
// กติกา: อ้างได้เฉพาะสิ่งที่แอปทำได้จริงตอนนี้ ไม่มีตัวเลขผลทดลองจริง และไม่มีข้อความต้องห้ามตามบรีฟ 11.5
// ตัวอย่างหน้าจอในหัวหน้าสร้างจากชิ้นส่วนจริงของแอป (Metric, Chip) ด้วยข้อมูลตัวอย่าง
import { useEffect, useRef, type ReactNode } from 'react';
import { go, STEP_PATHS } from '../app/router';
import { setState, useAppState } from '../data/store';
import { MODES, type AudienceMode } from '../config/modes';
import { ThemeButton } from '../ui/ThemeButton';
import { LaongMark } from '../ui/droplets';
import { Icon } from '../ui/icons';
import { Chip, Metric } from '../ui/kit';
import type { Kind } from '../core/types';
import { Mascot, ThemedImg } from '../ui/themed';
import { HeroScene } from '../ui/heroScene';
import { LandingMascot } from '../ui/landingMascot';
import { ScrollBar, ScrollMotion } from '../ui/landingMotion';
import { GenImg } from '../ui/genImg';

// อธิบายป้ายที่มา 9 ชนิดแบบอ่านง่าย: จัดเป็น 3 คำถามที่คนหน้างานถามจริง ความหมายตรงกับ KIND_INFO แต่ใช้คำสั้นกว่า
const LEGEND_GROUPS: { q: string; rows: [Kind, string][] }[] = [
  { q: 'ตัวเลขนี้มาจากไหน', rows: [
    ['measured', 'วัดด้วยเครื่องมือหรือส่งแล็บ'],
    ['observed', 'อ่านจากหน้าจอเครื่องแล้วจดเอง'],
    ['calculated', 'ระบบคิดให้จากสูตร'],
    ['proxy', 'ใช้แทนค่าจริงไปก่อน'],
    ['assumed', 'ตั้งสมมติไว้'],
  ] },
  { q: 'ผลทำนายเชื่อได้แค่ไหน', rows: [
    ['predicted', 'โมเดลทายไว้ก่อนวัดจริง'],
    ['unvalidated', 'ยังไม่ได้เทียบกับค่าจริง อย่าใช้ตัดสินใจหน้างาน'],
    ['validated', 'เทียบกับค่าวัดจริงแล้ว'],
  ] },
  { q: 'ถ้ายังไม่มีค่า', rows: [
    ['missing', 'ช่องนั้นจะขึ้นว่า "ยังไม่มีค่า" ไม่ใช่ 0'],
  ] },
];

function LandingLegend() {
  return (
    <div className="lp-legend">
      {LEGEND_GROUPS.map((g) => (
        <section key={g.q} className="lp-legend__g" aria-label={g.q}>
          <h3>{g.q}</h3>
          <ul>
            {g.rows.map(([k, t]) => (
              <li key={k}><Chip kind={k} /><span>{t}</span></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const SECTIONS = [
  { id: 'lp-how', label: 'วิธีทำงาน' },
  { id: 'lp-trust', label: 'ที่มาของตัวเลข' },
  { id: 'lp-modes', label: 'โหมดผู้ใช้' },
] as const;

function scrollToId(id: string, smooth = true) {
  const el = document.getElementById(id);
  if (!el) return;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calm || !smooth ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

/** ไปหน้าวิธีทำงาน ถ้าระบุส่วน จะเลื่อนไปที่ส่วนนั้นหลังเปิดหน้า */
function openHow(section?: string) {
  window.location.hash = section ? `/how?s=${section}` : '/how';
}

const FACTS: { title: string; body: string }[] = [
  { title: 'ช่วยตัดสินใจ ไม่ควบคุมเครื่อง', body: 'ไม่มีการส่งคำสั่งไปยังเครื่องจริง คนยังเป็นผู้ตัดสินใจทุกขั้น' },
  { title: 'ร่างบันทึกอัตโนมัติ', body: 'ปิดแท็บหรือไฟดับก็กลับมาต่อรันเดิมได้' },
  { title: 'ใช้ได้ทุกหน้าจอ', body: 'มือถือ แท็บเล็ต และจอตั้งโต๊ะ ติดตั้งเป็นแอปและเปิดแบบออฟไลน์ได้' },
  { title: 'ข้อมูลอยู่ในเครื่องนี้', body: 'ต้นแบบนี้ไม่มีบัญชีจริง ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่างและเก็บในเบราว์เซอร์' },
];

const FINE = 'ต้นแบบระยะ A ใช้ข้อมูลตัวอย่าง ผลคำนวณทุกอย่างยังไม่ผ่านการตรวจสอบ ห้ามใช้ตัดสินใจหน้างาน';

/** ตัวอย่างหน้าจอรันในแอป ใช้ชิ้นส่วนจริง (Metric) ด้วยข้อมูลตัวอย่าง ป้ายที่มาเป็นตัวหนังสือเงียบ ไม่ใช่กล่อง */
const READINGS: [string, number, number][] = [['10:05', 150, 81.6], ['10:10', 150, 82.0], ['10:15', 151, 82.4]];
function ProductPreview() {
  return (
    <figure className="lp-preview" aria-label="ตัวอย่างหน้าจอรันในแอป ข้อมูลตัวอย่าง">
      <div className="lp-preview__bar">
        <span className="lp-preview__title"><span className="mono">R-018</span> ถั่วลายเสือ · เครื่อง SYN-A</span>
        <span className="lp-preview__live">กำลังรัน · นาทีที่ 15</span>
      </div>
      <div className="lp-preview__metrics">
        <Metric label="Tout ที่ทำนาย" value={81.1} unit="°C" kind="predicted" />
        <Metric label="Tout ล่าสุดที่จด" value={82.4} unit="°C" kind="observed" />
      </div>
      <table className="lp-preview__table">
        <caption>ค่าที่จดหน้าเครื่อง</caption>
        <thead><tr><th scope="col">เวลา</th><th scope="col">Tin (°C)</th><th scope="col">Tout (°C)</th></tr></thead>
        <tbody>{READINGS.map(([t, tin, tout]) => <tr key={t}><td className="mono">{t}</td><td>{tin}</td><td>{tout.toFixed(1)}</td></tr>)}</tbody>
      </table>
      <figcaption className="lp-preview__note">Tout ที่ทำนายยังไม่ผ่านการตรวจสอบ (Unvalidated) · ข้อมูลตัวอย่าง</figcaption>
    </figure>
  );
}

function useEnter() {
  const session = useAppState((s) => s.session);
  return {
    enter: () => go(session ? '/' : '/login'),
    label: session ? 'ไปที่แอป' : 'เข้าสู่ระบบ',
    pickMode: (m: AudienceMode) => { setState({ mode: m }); go(session ? '/' : '/login'); },
  };
}

/** แถบบนใช้ร่วมสองหน้า: อยู่บนฉากเข้ม (หัวหน้า) เป็นโทนเข้มกลืนกับฉาก เลื่อนพ้นฉากแล้วกลับเป็นสีตามธีม */
function LpHead({ onNav, scene, children }: { onNav: (id: string) => void; scene: string; children?: ReactNode }) {
  const { enter, label } = useEnter();
  const head = useRef<HTMLElement>(null);
  useEffect(() => {
    const h = head.current;
    const hero = document.querySelector(scene);
    if (!h || !hero) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      h.toggleAttribute('data-on-hero', hero.getBoundingClientRect().bottom > h.offsetHeight);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    return () => { window.removeEventListener('scroll', kick); window.removeEventListener('resize', kick); if (raf) cancelAnimationFrame(raf); };
  }, [scene]);
  return (
    <header className="lp-head" ref={head} data-on-hero="">
      <a className="lp-brand" href="#/welcome" aria-label="LaOng หน้าแรก">
        <LaongMark size={32} />
        <span><strong>LaOng</strong><small>SprayDry Copilot</small></span>
      </a>
      <nav className="lp-nav" aria-label="หัวข้อวิธีทำงาน">
        {SECTIONS.map((s) => <button key={s.id} type="button" onClick={() => onNav(s.id)}>{s.label}</button>)}
      </nav>
      <div className="lp-head__right">
        <ThemeButton />
        <button type="button" className="ld-btn ld-btn--primary" onClick={enter}>{label}</button>
      </div>
      {children}
    </header>
  );
}

/** หน้าแรก: ฉากเต็มจอหน้าเดียว ข้อความ ปุ่มสองปุ่ม การ์ดรัน และน้องละออง */
export default function Landing() {
  const { enter, label } = useEnter();
  return (
    <div className="ld-root landing landing--welcome">
      <LpHead scene=".lp-stage-hero" onNav={openHow} />
      <main id="main-content">
        <section className="lp-stage-hero" data-lp="hero" aria-labelledby="lp-h1">
          <HeroScene />
          <div className="lp-hero">
            <div className="lp-hero__body">
              <h1 id="lp-h1">จดค่า ทำนาย Tout และทบทวนรัน ในที่เดียว</h1>
              <p className="lp-lead">LaOng (ละออง) ช่วยทีมที่ใช้ Spray Dryer จดค่าหน้าเครื่อง ประเมิน Tout ก่อนรัน เก็บผลแล็บ และส่งออกรายงาน โดยไม่ต้องตามรวบรวมข้อมูลจากหลายที่</p>
              <div className="lp-cta">
                <button type="button" className="ld-btn ld-btn--primary lp-btn" onClick={enter}><Icon name="play" size={18} />{label}</button>
                <button type="button" className="ld-btn lp-btn" onClick={() => openHow()}>ดูวิธีทำงาน</button>
              </div>
            </div>
            <div className="lp-hero__visual">
              <LandingMascot />
              <ProductPreview />
            </div>
          </div>
          <p className="lp-hero__fine">{FINE}</p>
        </section>
      </main>
    </div>
  );
}

/** ค่าตัวอย่างของรัน R-018 ในแต่ละขั้น ชุดเดียวกับการ์ดรันบนหน้าแรก */
type Reading = { label: string; value: number | null; unit: string; kind: Kind; digits?: number };
const RUN_STEPS: Reading[][] = [
  [{ label: 'Tout ที่ทำนาย', value: 81.1, unit: '°C', kind: 'predicted' }, { label: 'Tout ที่อ่านได้', value: null, unit: '°C', kind: 'missing' }],
  [{ label: 'Tin ที่จด', value: 150, unit: '°C', kind: 'observed' }, { label: 'Tout ที่จด', value: 82.4, unit: '°C', kind: 'observed' }],
  [{ label: 'ผลผลิต', value: 47.0, unit: '%', kind: 'calculated' }, { label: 'ความชื้น', value: 3.9, unit: '%', kind: 'measured' }],
  [{ label: 'ผลต่าง Tout ทำนายกับจด', value: 1.3, unit: '°C', kind: 'calculated' }, { label: 'รันที่ปิดแล้ว', value: 7, unit: 'รัน', kind: 'observed', digits: 0 }],
  [],
];
const EXPORTS = ['CSV สรุปรัน', 'CSV รายนาที', 'พิมพ์รายงานหนึ่งรัน'];

/** แผงรันเดียว: รัน R-018 เดินผ่านห้าขั้นเป็นเส้นเวลา ค่าทุกตัวมีป้ายที่มา */
function RunTimeline() {
  return (
    <figure className="lp-run" data-lp-in="once" aria-label="ตัวอย่างรัน R-018 ผ่านห้าขั้น ข้อมูลตัวอย่าง">
      <div className="lp-run__bar">
        <span><span className="mono">R-018</span> ถั่วลายเสือ · เครื่อง SYN-A</span>
        <span className="lp-run__tag">ข้อมูลตัวอย่าง</span>
      </div>
      <ol className="lp-run__list">
        {STEP_PATHS.map((s, i) => (
          <li key={s.path} style={{ ['--i' as string]: i }}>
            <span className="lp-run__node" aria-hidden="true" />
            <div className="lp-run__t">
              <span className="lp-run__n mono">{s.n}</span>
              <strong>{s.title}</strong>
              <span>{s.sub}</span>
            </div>
            <div className="lp-run__vals">
              {RUN_STEPS[i].length ? RUN_STEPS[i].map((r) => (
                <div key={r.label} className="lp-run__val">
                  <span className="lp-run__label">{r.label}</span>
                  {r.value === null
                    ? <span className="lp-run__empty">ยังไม่มีค่า</span>
                    : <span className="lp-run__num"><span className="mono">{r.value.toFixed(r.digits ?? 1)}</span><small>{r.unit}</small></span>}
                  <Chip kind={r.kind} />
                </div>
              )) : (
                <ul className="lp-run__exports">{EXPORTS.map((e) => <li key={e}>{e}</li>)}</ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="lp-run__note">Tout ที่ทำนายยังไม่ผ่านการตรวจสอบ (Unvalidated) จนกว่าจะเทียบกับค่าที่อ่านได้จริง</figcaption>
    </figure>
  );
}

/** กราฟเส้น Tout ของรันตัวอย่าง: เส้นทึบคือค่าที่จด เส้นประคือค่าที่ทำนาย */
const OBS: [string, number][] = [['10:00', 81.2], ['10:05', 81.6], ['10:10', 82.0], ['10:15', 82.4]];
const PRED = 81.1;
function TrustChart() {
  const x = (i: number) => 64 + i * 140;
  const y = (v: number) => 236 - ((v - 80.5) / 2.5) * 200;
  const path = OBS.map(([, v], i) => `${i ? 'L' : 'M'}${x(i)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <figure className="lp-chart">
      <svg viewBox="0 0 520 280" role="img" aria-label="กราฟ Tout ของรัน R-018 ค่าที่จดเพิ่มจาก 81.2 เป็น 82.4 องศา ค่าที่ทำนายคือ 81.1 องศา">
        {[81, 82, 83].map((g) => (
          <g key={g} className="lp-chart__grid">
            <line x1="56" x2="504" y1={y(g)} y2={y(g)} />
            <text x="44" y={y(g) + 4} textAnchor="end">{g}</text>
          </g>
        ))}
        {OBS.map(([t], i) => <text key={t} className="lp-chart__x" x={x(i)} y="268" textAnchor="middle">{t}</text>)}
        <line className="lp-chart__pred" x1="56" x2="504" y1={y(PRED)} y2={y(PRED)} />
        <text className="lp-chart__lbl lp-chart__lbl--pred" x="504" y={y(PRED) + 18} textAnchor="end">ที่ทำนาย 81.1 · Predicted · Unvalidated</text>
        <path className="lp-chart__obs" d={path} />
        {OBS.map(([t, v], i) => <circle key={t} className="lp-chart__dot" cx={x(i)} cy={y(v)} r="4" />)}
        <text className="lp-chart__lbl" x={x(3)} y={y(82.4) - 14} textAnchor="end">ที่จด 82.4 · Observed</text>
      </svg>
      <figcaption>Tout ของรัน R-018 (°C) · ข้อมูลตัวอย่าง</figcaption>
    </figure>
  );
}

/** หน้าวิธีทำงาน: หัวหน้าโทนเข้มต่อจากหน้าแรก แล้วอ่านไล่ลงธรรมดา จุดเด่นคือแผงรันห้าขั้น */
export function HowPage() {
  const { enter, label, pickMode } = useEnter();

  // อยู่หน้านี้แล้วเปลี่ยนแค่ ?s= (ปุ่มย้อนกลับ ลิงก์) ก็เลื่อนตามด้วย
  useEffect(() => {
    let t = 0;
    const jump = () => {
      const s = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('s');
      window.clearTimeout(t);
      if (s && document.getElementById(s)) t = window.setTimeout(() => scrollToId(s, false), 60);
    };
    jump();
    window.addEventListener('hashchange', jump);
    return () => { window.clearTimeout(t); window.removeEventListener('hashchange', jump); };
  }, []);

  return (
    <div className="ld-root landing landing--how">
      <LpHead scene=".lp-howhero" onNav={(id) => scrollToId(id)}><ScrollBar /></LpHead>

      <main id="main-content">
        <section className="lp-howhero" aria-labelledby="lp-problem">
          <div className="lp-howhero__bg" aria-hidden="true">
            <GenImg name="hero-bg" ext="jpg" width={1920} height={1080} eager alt="" />
          </div>
          <div className="lp-howhero__in">
            <div className="lp-howhero__body">
              <a className="lp-back" href="#/welcome"><Icon name="chevronLeft" size={16} />หน้าแรก</a>
              <h1 id="lp-problem">ข้อมูลการทดลองกระจาย ทวนย้อนยาก</h1>
              <p>ค่าที่จดไว้หลายที่ทำให้สรุปผลแต่ละครั้งต้องตามรวบรวมกันใหม่ และเทียบรันเก่ากับรันใหม่ได้ยาก LaOng รวมการจดค่า ผลแล็บ และประวัติไว้ในที่เดียว เพื่อให้ทวนย้อนได้ว่าแต่ละรันใช้ค่าอะไรและได้ผลอย่างไร</p>
            </div>
            <div className="lp-howhero__photo">
              <GenImg name="problem-notes" ext="webp" width={1600} height={900} eager
                alt="โต๊ะแล็บข้างเครื่อง Spray Dryer มีกระดาษจดค่า โพสต์อิท และโทรศัพท์วางกระจัดกระจาย"
                fallback={<ThemedImg name="story-problem" folder="images/art" width={520} height={290} alt="กระดาษจดค่าหลายแผ่นรวมเป็นสมุดเล่มเดียว" />} />
            </div>
          </div>
        </section>

        <div className="lp-main">
          <section className="lp-section" id="lp-how" tabIndex={-1} aria-labelledby="lp-how-h">
            <h2 id="lp-how-h">หนึ่งรัน เดินห้าขั้น</h2>
            <p className="lp-sub">ทำตามลำดับ หรือกลับมาต่อจากร่างที่บันทึกไว้ได้ทุกเมื่อ</p>
            <RunTimeline />
          </section>

          <section className="lp-section lp-split" id="lp-trust" tabIndex={-1} aria-labelledby="lp-trust-h">
            <div className="lp-split__body">
              <h2 id="lp-trust-h">ทุกตัวเลขบอกที่มา</h2>
              <p>ค่าที่วัดมา จดมา คำนวณ หรือทำนาย จะมีป้ายติดคู่เสมอ ค่าที่ยังไม่มีจะแสดงว่า "ยังไม่มีค่า" ไม่ใช่ 0 และผลทำนาย Tout ติดป้าย Unvalidated ไว้จนกว่าจะตรวจกับค่าที่อ่านได้จริง</p>
            </div>
            <TrustChart />
            <LandingLegend />
          </section>

          <section className="lp-section" id="lp-modes" tabIndex={-1} aria-labelledby="lp-modes-h">
            <h2 id="lp-modes-h">ใช้ได้กับ 4 กลุ่ม</h2>
            <p className="lp-sub">เลือกโหมดที่ตรงกับคุณ เปลี่ยนภายหลังได้ในเมนูผู้ใช้</p>
            <ul className="lp-modelist">
              {MODES.map((m) => (
                <li key={m.value}>
                  <button type="button" className="lp-moderow" onClick={() => pickMode(m.value)}>
                    <span className="lp-moderow__name"><strong>{m.label}</strong><span>{m.sub}</span></span>
                    <span className="lp-moderow__tip">{m.tip}</span>
                    <span className="lp-moderow__go">เลือกโหมดนี้<Icon name="chevronRight" size={16} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="lp-section" aria-labelledby="lp-facts-h">
            <h2 id="lp-facts-h">ที่ควรรู้ก่อนใช้</h2>
            <ul className="lp-facts">
              {FACTS.map((f) => (
                <li key={f.title}>
                  <strong>{f.title}</strong>
                  <span>{f.body}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="lp-final" data-lp-in="once" aria-labelledby="lp-final-h">
            <div className="lp-final__art">
              <GenImg name="result-powder" ext="webp" className="lp-gen lp-gen--final" width={1672} height={941}
                alt="มือสวมถุงมือถือขวดผงที่ได้จากเครื่อง Spray Dryer โดยมีกราฟผลการรันอยู่ด้านหลัง" />
              <span className="lp-final__buddy"><Mascot pose="success" size={84} /></span>
            </div>
            <div>
              <h2 id="lp-final-h">ลองใช้กับข้อมูลตัวอย่าง</h2>
              <p>เลือกบทบาทและโหมด แล้วเข้าได้เลย ไม่ต้องมีบัญชี</p>
            </div>
            <button type="button" className="ld-btn ld-btn--primary lp-btn" onClick={enter}><Icon name="play" size={18} />{label}</button>
          </section>
        </div>
      </main>

      <footer className="lp-foot"><p>{FINE}</p></footer>
      <ScrollMotion />
    </div>
  );
}
