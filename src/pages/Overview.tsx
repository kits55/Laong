// ภาพรวม: งานถัดไปงานเดียว ผลล่าสุดพร้อมกราฟ และทางลัดไปลิ้นชักตั้งค่า (เครื่อง บอร์ด ป้าย เพิ่มเติม)
import { useEffect, useState } from 'react';
import { go, type Path } from '../app/router';
import { StatusPill } from './History';
import { SOON } from '../app/upcoming';
import { setState, useAppState, useProfile } from '../data/store';
import { openDrawer, type DrawerTab } from '../data/ui';
import { CAM_LABEL, LINK_LABEL, useDevice } from '../device/link';
import { Icon, type IconName } from '../ui/icons';
import { Btn, DT, PageHead, Panel, Val } from '../ui/kit';
import { PointsChart } from '../ui/charts';
import { fmtDate } from '../lib/util';
import { predictionError, STATUS_LABEL, withinBand } from '../lib/runs';
import { READ_BAND_C } from '../config/synthetic';
import type { Num } from '../core/types';
import type { Cur, RunRecord } from '../data/types';

/* แถบสถานะรัน: หยดค่อย ๆ เล็กลงตามลำดับงาน บอกสถานะด้วยคำและเครื่องหมาย ไม่ใช้สีอย่างเดียว */
const FLOW: { label: string; to: Path }[] = [
  { label: 'ก่อนทดลอง', to: '/pre' },
  { label: 'ระหว่างทดลอง', to: '/run' },
  { label: 'หลังทดลอง', to: '/post' },
  { label: 'ประวัติ', to: '/history' },
  { label: 'รายงาน', to: '/report' },
];

function FlowTrack({ cur }: { cur: Cur }) {
  const running = cur.timer.status === 'running' || cur.timer.status === 'paused';
  const now = !cur.done[1] ? 0 : !cur.done[3] && (running || cur.timer.status === 'idle') ? 1 : !cur.done[3] ? 2 : 3;
  return (
    <ol className="flow" aria-label="ลำดับงานของรันนี้">
      {FLOW.map((f, i) => {
        const state = i < now ? 'done' : i === now ? 'now' : 'next';
        const word = state === 'done' ? 'เสร็จแล้ว' : state === 'now' ? (i === 1 && running ? 'กำลังรัน' : 'งานถัดไป') : 'รอ';
        return (
          <li key={f.label} className="flow__i" data-state={state} style={{ ['--k' as string]: i }}>
            <button type="button" className="flow__b" onClick={() => go(f.to)} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="flow__drop" aria-hidden="true">{state === 'done' ? <Icon name="check" size={14} /> : null}</span>
              <span className="flow__t">{f.label}</span>
              <span className="flow__s">{word}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* สเกล Tout: ที่ทำนายกับที่อ่านได้บนเส้นเดียว พร้อมแนวอ่านผล ค่าที่ไม่มีจะไม่ถูกวางตำแหน่ง */
function ToutScale({ predicted, measured, err }: { predicted: Num; measured: Num; err: Num }) {
  const vals = [predicted, measured].filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length === 0) return <p className="muted">ยังไม่มีค่า Tout ให้วางบนสเกล</p>;
  const mid = predicted ?? (measured as number);
  const lo = Math.floor(Math.min(...vals, mid - READ_BAND_C) - 3);
  const hi = Math.ceil(Math.max(...vals, mid + READ_BAND_C) + 3);
  const span = hi - lo;
  const pos = (v: number) => `${((v - lo) / span) * 100}%`;
  const step = span > 24 ? 5 : 2;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const inBand = withinBand(err);
  return (
    <div className="scale">
      <div className="scale__head">
        <span className="scale__title">Tout บนสเกลเดียว (°C)</span>
        {inBand === null ? null : (
          <span className="scale__verdict" data-in={inBand}>
            <Icon name={inBand ? 'check' : 'info'} size={16} />
            {inBand ? `ผลต่างอยู่ในแนวอ่านผลราว ${READ_BAND_C} °C` : `ผลต่างเกินแนวอ่านผลราว ${READ_BAND_C} °C`}
          </span>
        )}
      </div>
      <div className="scale__track" role="img" aria-label={`Tout ที่ทำนาย ${predicted ?? 'ยังไม่มีค่า'} องศาเซลเซียส ที่อ่านได้ ${measured ?? 'ยังไม่มีค่า'} องศาเซลเซียส`}>
        {predicted !== null ? <span className="scale__band" style={{ left: pos(predicted - READ_BAND_C), width: `${(READ_BAND_C * 2 / span) * 100}%` }} /> : null}
        {predicted !== null && measured !== null ? <span className="scale__gap" style={{ left: pos(Math.min(predicted, measured)), width: `${(Math.abs(measured - predicted) / span) * 100}%` }} /> : null}
        {ticks.map((t) => <span key={t} className="scale__tick" style={{ left: pos(t) }}><i>{t}</i></span>)}
        {predicted !== null ? <span className="scale__pt scale__pt--pred" style={{ left: pos(predicted) }} /> : null}
        {measured !== null ? <span className="scale__pt scale__pt--obs" style={{ left: pos(measured) }} /> : null}
      </div>
      <dl className="scale__read">
        <div><dt><span className="scale__key scale__key--pred" aria-hidden="true" />ที่ทำนาย</dt><dd><Val v={predicted} unit="°C" kind="predicted" /></dd></div>
        <div><dt><span className="scale__key scale__key--obs" aria-hidden="true" />ที่อ่านได้</dt><dd><Val v={measured} unit="°C" kind="observed" /></dd></div>
        <div><dt>ผลต่าง</dt><dd><Val v={err} unit="°C" kind="calculated" /></dd></div>
      </dl>
    </div>
  );
}

/* ผลต่างรายรัน: แท่งแยกซ้ายขวาจากศูนย์ พื้นจางตรงกลางคือแนวอ่านผล */
function ErrorLedger({ runs }: { runs: RunRecord[] }) {
  const rows = runs.slice(0, 6).map((r) => ({ r, e: predictionError(r) }));
  const maxAbs = Math.max(READ_BAND_C * 1.6, ...rows.map((x) => (x.e === null ? 0 : Math.abs(x.e))));
  return (
    <Panel title="ผลต่างรายรัน">
      <ul className="ledger">
        {rows.map(({ r, e }) => (
          <li key={r.id} className="ledger__row">
            <span className="ledger__id">{r.id}</span>
            <span className="ledger__bar" aria-hidden="true">
              <span className="ledger__band" style={{ width: `${(READ_BAND_C / maxAbs) * 100}%` }} />
              {e === null ? null : <span className="ledger__fill" data-dir={e >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(e) / maxAbs) * 50}%` }} />}
            </span>
            <span className="ledger__v"><Val v={e} unit="°C" kind="calculated" /></span>
          </li>
        ))}
      </ul>
      <p className="cap">แท่งไปขวาคืออ่านได้สูงกว่าที่ทำนาย ไปซ้ายคือต่ำกว่า พื้นจางตรงกลางคือแนวอ่านผลราว {READ_BAND_C} °C</p>
    </Panel>
  );
}

function nextTask(cur: Cur): { title: string; body: string; to: Path; cta: string } {
  if (!cur.done[1]) return { title: cur.touched ? 'ประเมิน Tout ก่อนรัน' : 'เริ่มรันใหม่', body: 'กรอก Tin อัตราป้อน และ TS แล้วให้ระบบประเมิน Tout ที่คาดว่าจะได้', to: '/pre', cta: 'ประเมิน Tout' };
  if (cur.timer.status === 'idle') return { title: 'เริ่มจับเวลา', body: 'ประเมิน Tout แล้ว ตอนนี้เริ่มรันและจดค่าจากหน้าจอเครื่องได้เลย', to: '/run', cta: 'ไปหน้าจับเวลา' };
  if (cur.timer.status === 'running' || cur.timer.status === 'paused') return { title: 'กลับไปจดค่าระหว่างรัน', body: 'รันยังเดินอยู่ จดค่า Tin และ Tout ต่อได้', to: '/run', cta: 'กลับไปจดค่า' };
  if (!cur.done[3]) return { title: 'บันทึกผลแล็บ', body: 'จบการจับเวลาแล้ว กรอกผลแล็บและปิดรัน', to: '/post', cta: 'ไปหน้าหลังทดลอง' };
  return { title: 'ปิดรันและดูรายงาน', body: 'บันทึกผลแล็บแล้ว ตรวจเช็กลิสต์แล้วปิดรันได้', to: '/post', cta: 'ไปปิดรัน' };
}

/* ตัวเลขนับขึ้นครั้งเดียวตอนเปิดหน้า (ปิดเมื่อผู้ใช้ตั้ง reduced motion) ตัวอ่านหน้าจอได้ค่าจริงทันที */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <><span aria-hidden="true">{n}</span><span className="sr-only">{to}</span></>;
}

function Tile({ icon, title, sub, tab }: { icon: IconName; title: string; sub: string; tab: DrawerTab }) {
  return (
    <button type="button" className="tile2" onClick={() => openDrawer(tab)}>
      <span className="tile2__ic"><Icon name={icon} size={20} /></span>
      <span className="tile2__t">{title}</span>
      <span className="tile2__s">{sub}</span>
    </button>
  );
}

export default function Overview() {
  const cur = useAppState((s) => s.cur);
  const runs = useAppState((s) => s.runs);
  const onboarding = useAppState((s) => s.onboarding);
  const profile = useProfile();
  const dev = useDevice();
  const task = nextTask(cur);
  const last = runs[0];
  const err = last ? predictionError(last) : null;

  const steps = [
    { label: 'เลือกเครื่องและบันทึกโปรไฟล์', done: !!onboarding.profile },
    { label: 'อ่านความหมายของป้ายที่มา', done: !!onboarding.legend },
    { label: 'ลองประเมิน Tout หนึ่งครั้ง', done: cur.done[1] || !!onboarding.predict },
    { label: 'ลองจับเวลาและจดค่า', done: cur.done[2] || !!onboarding.timer },
    { label: 'ส่งออกรายงานไฟล์แรก', done: !!onboarding.export },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  const chartRuns = runs.slice(0, 7).reverse();
  const cats = chartRuns.map((r) => r.id);
  const boardSub = !dev.enabled ? 'ยังไม่เปิดใช้' : dev.state === 'online' ? `${LINK_LABEL.online}${dev.cam ? ` · ${CAM_LABEL[dev.cam]}` : ''}` : LINK_LABEL[dev.state];

  const running = cur.timer.status === 'running' || cur.timer.status === 'paused';
  const openCount = runs.filter((r) => r.status === 'open').length;
  const recent = runs.slice(0, 5);

  return (
    <div className="page reveal">
      <PageHead title="วันนี้" lead={`${fmtDate(new Date().toISOString())} · ติดตามการทดลองและงานถัดไปของเครื่องที่เลือก`} />

      <div className="today">
        <section className="hero todaycard" aria-labelledby="hero-h">
          <div className="hero__body">
            <div className="machine">
              <span className="spill" data-s={running ? 'open' : 'next'}><i aria-hidden="true" />{running ? 'กำลังรัน' : 'งานถัดไป'}</span>
              <span className="machine__code">{profile.code}</span>
              <span>{profile.name}</span>
            </div>
            <h2 className="hero__greet" id="hero-h">{task.title}</h2>
            <p className="lead">{task.body}</p>
          </div>
          <div className="hero__cta">
            <Btn variant="primary" onClick={() => go(task.to)}>{task.cta}<Icon name="chevronRight" size={16} /></Btn>
            {cur.done[1] || cur.touched ? null : <Btn icon="history" onClick={() => go('/history')}>ดูประวัติรัน</Btn>}
          </div>
          <FlowTrack cur={cur} />
        </section>

        <section className="ld-panel sumcard" aria-labelledby="sum-h">
          <h2 className="sumcard__t" id="sum-h">ภาพรวมการทดลอง</h2>
          <dl className="sumcard__stats">
            <div><dd><CountUp to={runs.length} /></dd><dt>รันทั้งหมด</dt></div>
            <div><dd><CountUp to={runs.length - openCount} /></dd><dt>ปิดแล้ว</dt></div>
            <div><dd><CountUp to={openCount} /></dd><dt>ยังไม่ปิด</dt></div>
          </dl>
          {nextStep ? (
            <div className="sumcard__start">
              <div className="sumcard__row"><strong>เริ่มใช้งาน {doneCount} จาก {steps.length}</strong><Btn variant="quiet" onClick={() => openDrawer('more')}>ดูทั้งหมด</Btn></div>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="ความคืบหน้าการเริ่มใช้งาน"><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
              <span className="cap">ขั้นต่อไป: {nextStep.label}</span>
            </div>
          ) : <p className="cap">เริ่มใช้งานครบทุกขั้นแล้ว</p>}
        </section>
      </div>

      {recent.length ? (
        <section className="ld-panel listcard" aria-labelledby="recent-h">
          <div className="listcard__head">
            <div><h2 className="listcard__t" id="recent-h">การทดลองล่าสุด</h2><p className="cap">กลับไปจดค่าหรือเปิดผลที่ปิดแล้วได้จากตารางนี้</p></div>
            <Btn onClick={() => go('/history')}>ดูรายการทั้งหมด</Btn>
          </div>
          <DT caption="การทดลองล่าสุด" className="hist-table">
            <thead><tr><th>รัน</th><th>ชื่อการทดลอง</th><th>สถานะ</th><th>สร้างเมื่อ</th><th><span className="sr-only">การดำเนินการ</span></th></tr></thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={r.id} style={{ ['--i' as string]: i }}>
                  <td data-label="รัน" className="cell-left"><span className="mono">{r.id}</span></td>
                  <td data-label="ชื่อการทดลอง" className="cell-left"><strong className="rname">{r.materialName}</strong>{r.sample ? <span className="cap"> · ตัวอย่าง</span> : null}</td>
                  <td data-label="สถานะ" className="cell-left"><StatusPill status={r.status} /></td>
                  <td data-label="สร้างเมื่อ" className="cell-left">{fmtDate(r.dateISO)}</td>
                  <td data-label="เปิด" className="cell-act"><Btn className="rowbtn" onClick={() => { setState({ selectedRunId: r.id }); go('/history'); }}>ดูผล<Icon name="chevronRight" size={16} /></Btn></td>
                </tr>
              ))}
            </tbody>
          </DT>
        </section>
      ) : null}

      <div className="grid-main">
        <Panel
          title={last ? `ผลล่าสุด ${last.id}` : 'ผลล่าสุด'}
          actions={last ? <Btn variant="quiet" icon="history" onClick={() => { setState({ selectedRunId: last.id }); go('/history'); }}>ดูรายละเอียด</Btn> : null}
        >
          {last ? (
            <>
              <p className="cap">{last.materialName} · {fmtDate(last.dateISO)} · {STATUS_LABEL[last.status]}{last.sample ? ' · ข้อมูลตัวอย่าง' : ''}</p>
              <ToutScale predicted={last.predicted.eta} measured={last.measuredTout} err={err} />
              <PointsChart
                title="ทำนายกับที่อ่านได้ ของ 7 รันล่าสุด"
                yLabel="Tout (°C)"
                height={210}
                categories={cats}
                links
                lines={false}
                series={[
                  { id: 'pred', label: 'ที่ทำนาย', kind: 'predicted', marker: 'square', dashed: true, points: chartRuns.map((r) => ({ x: r.id, y: r.predicted.eta })) },
                  { id: 'obs', label: 'ที่อ่านได้', kind: 'observed', marker: 'circle', points: chartRuns.map((r) => ({ x: r.id, y: r.measuredTout })) },
                ]}
                table={
                  <DT caption="ตัวเลขของกราฟ Tout ที่ทำนายและที่อ่านได้">
                    <thead><tr><th>รัน</th><th className="ld-num">ทำนาย (°C)</th><th className="ld-num">อ่านได้ (°C)</th><th className="ld-num">ผลต่าง (°C)</th></tr></thead>
                    <tbody>
                      {chartRuns.map((r) => (
                        <tr key={r.id}>
                          <td data-label="รัน" className="cell-left">{r.id}</td>
                          <td data-label="ทำนาย" className="ld-num"><Val v={r.predicted.eta} kind="predicted" /></td>
                          <td data-label="อ่านได้" className="ld-num"><Val v={r.measuredTout} kind="observed" /></td>
                          <td data-label="ผลต่าง" className="ld-num"><Val v={predictionError(r)} kind="calculated" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </DT>
                }
              />
            </>
          ) : (
            <p className="muted">ยังไม่มีรัน เริ่มรันแรกจากปุ่มด้านบน</p>
          )}
        </Panel>

        <div className="stack">
          {runs.length ? <ErrorLedger runs={runs} /> : null}
          <div className="tiles">
            <Tile icon="settings" title="เครื่อง" sub={profile.code} tab="machine" />
            <Tile icon="wifi" title="บอร์ดและกล้อง" sub={boardSub} tab="board" />
            <Tile icon="info" title="ความหมายป้าย" sub="9 ชนิด" tab="legend" />
            <Tile icon="spark" title="กำลังจะมา" sub={`${SOON.length} รายการ`} tab="more" />
          </div>
        </div>
      </div>
    </div>
  );
}
