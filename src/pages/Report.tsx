// ขั้น 5 รายงาน: ผูกกับรันเดียวเสมอ ส่งออก CSV, JSON, Word และพิมพ์รายงานหรือป้าย
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MODEL_VERSION } from '../core/adapter';
import { checkFormula, type FormulaCheck } from '../core/integrity';
import { markOnboarding, setState, useAppState } from '../data/store';
import { download, exportRunDocx, pointsCsv, runSummaryCsv } from '../lib/export';
import { predictionError, STATUS_LABEL } from '../lib/runs';
import { fmtDate, fmtDateTime } from '../lib/util';
import { Btn, Chip, DT, Metric, Notice, Panel, PageHead, SelectField, Val } from '../ui/kit';
import { useSelectedRun } from './History';
import { READ_BAND_C } from '../config/synthetic';

export function useFormulaCheck() {
  const [c, setC] = useState<FormulaCheck>({ state: 'checking', actual: null, expected: '' });
  useEffect(() => { let on = true; checkFormula().then((r) => { if (on) setC(r); }); return () => { on = false; }; }, []);
  return c;
}

export default function Report() {
  const runs = useAppState((s) => s.runs);
  const run = useSelectedRun();
  const check = useFormulaCheck();
  const [note, setNote] = useState<string | null>(null);

  if (!run) return <div className="page"><PageHead title="รายงาน" /><Notice kind="info" title="ยังไม่มีรัน">ปิดรันแรกแล้วกลับมาออกรายงานได้</Notice></div>;

  const err = predictionError(run);
  const say = (t: string) => { setNote(t); markOnboarding('export'); };
  const doPrint = (mode: 'report' | 'label') => {
    document.body.dataset.print = mode;
    const clear = () => { delete document.body.dataset.print; window.removeEventListener('afterprint', clear); };
    window.addEventListener('afterprint', clear);
    setTimeout(() => { window.print(); markOnboarding('export'); }, 50);
  };

  return (
    <div className="page">
      <PageHead title="รายงาน" lead="รายงานผูกกับรันที่เลือกเพียงรันเดียว ผลทำนายของรันอื่นจะไม่ถูกนำมาวางคู่กับผลแล็บของรันนี้"
        actions={<div style={{ minWidth: 240 }}><SelectField id="rep-run" label="เลือกรัน" value={run.id} onChange={(v) => setState({ selectedRunId: v })} options={runs.map((r) => ({ value: r.id, label: `${r.id} · ${fmtDate(r.dateISO)}${r.sample ? ' (ตัวอย่าง)' : ''}` }))} /></div>} />

      <Panel title="ส่งออก" className="no-print">
        <div className="row">
          <Btn variant="primary" icon="download" onClick={() => { download(`${run.id}-สรุป.csv`, runSummaryCsv(run), 'text/csv;charset=utf-8'); say('ส่งออก CSV สรุปแล้ว ช่องที่ไม่มีค่าเป็นช่องว่าง'); }}>ส่งออก CSV สรุป</Btn>
          <Btn icon="download" onClick={() => { download(`${run.id}-รายนาที.csv`, pointsCsv(run), 'text/csv;charset=utf-8'); say('ส่งออก CSV รายนาทีแล้ว'); }}>CSV รายนาที</Btn>
          <Btn icon="report" onClick={() => { exportRunDocx(run); say('ส่งออกไฟล์ Word แล้ว'); }}>ส่งออก Word</Btn>
          <Btn icon="download" onClick={() => { download(`${run.id}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), note: run.sample ? 'ข้อมูลตัวอย่าง' : null, run }, null, 2), 'application/json'); say('ส่งออก JSON แล้ว ค่าว่างเป็น null'); }}>ส่งออก JSON</Btn>
          <Btn icon="print" onClick={() => doPrint('report')}>พิมพ์รายงาน</Btn>
          <Btn icon="print" onClick={() => doPrint('label')}>พิมพ์ป้ายตัวอย่าง</Btn>
        </div>
        {note ? <Notice kind="ok" title={note} role="status" /> : null}
      </Panel>

      <article className="ld-panel report-sheet" aria-label={`รายงานรัน ${run.id}`}>
        <div className="stack">
          <div className="row-between">
            <div className="stack-sm">
              <h2 className="ld-panel__title">รายงานรัน {run.id}</h2>
              <span className="cap">{fmtDateTime(run.dateISO)} · {run.materialName} · {STATUS_LABEL[run.status]}</span>
            </div>
            {run.sample ? <span className="soon" style={{ borderStyle: 'solid' }}>ข้อมูลตัวอย่าง</span> : null}
          </div>
          {run.sample ? <Notice kind="warn" title="ข้อมูลตัวอย่างสมมติ">ตัวเลขในรันนี้ไม่ใช่ผลทดลองจริง ใช้ดูรูปแบบรายงานเท่านั้น</Notice> : null}

          <h3 className="h3">1. แผนการทดลอง</h3>
          <div className="result-grid">
            <Metric label="Tin ที่ตั้ง" value={run.inputs.tin} unit="°C" kind="assumed" />
            <Metric label="อัตราป้อน" value={run.inputs.feedMlMin} unit="mL/min" kind={run.inputs.feedKind} />
            <Metric label="TS" value={run.inputs.solidsFrac === null ? null : run.inputs.solidsFrac * 100} unit="%" kind={run.inputs.solidsKind} />
            <Metric label="อัตราลมของโปรไฟล์" value={run.inputs.airFlow} unit="m³/h" kind="assumed" />
          </div>

          <h3 className="h3">2. ผลทำนายเทียบกับค่าที่อ่านได้</h3>
          <div className="result-grid">
            <Metric label="Tout ทำนาย (eta)" value={run.predicted.eta} unit="°C" kind="predicted" />
            <Metric label="Tout ทำนาย (UA)" value={run.predicted.ua} unit="°C" kind="predicted" />
            <Metric label="Tout ที่อ่านได้" value={run.measuredTout} unit="°C" kind="observed" />
            <Metric label="predictionError" value={err} unit="°C" kind="calculated" hint={err === null ? 'ยังไม่มีค่า จนกว่าจะมีค่าที่อ่านได้จริง' : `แนวอ่านผลราว ${READ_BAND_C} °C`} />
          </div>

          <h3 className="h3">3. ผลแล็บ</h3>
          <div className="result-grid">
            <Metric label="ความชื้น" value={run.lab.moisture} unit="%" kind="measured" />
            <Metric label="โปรตีน" value={run.lab.protein} unit="%" kind="measured" />
            <Metric label="aw" value={run.lab.aw} kind="measured" digits={2} />
            <Metric label="การละลาย" value={run.lab.solubility} unit="%" kind="measured" />
            <Metric label="สี L*" value={run.lab.L} kind="measured" />
            <Metric label="สี a*" value={run.lab.a} kind="measured" />
            <Metric label="สี b*" value={run.lab.b} kind="measured" />
          </div>

          <h3 className="h3">4. การตรวจสอบโมเดล</h3>
          <Notice kind="unvalidated" title="ผลทำนายยัง UNVALIDATED">ห้ามใช้ตัดสินใจหน้างานโดยไม่ตรวจกับค่าที่อ่านได้ ผลทำนายใช้ค่าโปรไฟล์เครื่องตัวอย่าง ไม่ใช่ค่าคาลิเบรตจริง</Notice>
          <dl className="kv">
            <dt>เวอร์ชันโมเดล</dt><dd><span className="ld-num">{run.predicted.modelVersion ?? MODEL_VERSION}</span></dd>
            <dt>ไฟล์สูตรตรงกับ hash ต้นฉบับ</dt>
            <dd>{check.state === 'match' ? <Chip kind="validated" extra="hash ตรง" /> : check.state === 'checking' ? <span className="muted">กำลังตรวจ</span> : check.state === 'mismatch' ? <Chip kind="unvalidated" extra="hash ไม่ตรง" /> : <Chip kind="missing" extra="ตรวจไม่ได้ในเบราว์เซอร์นี้" />}</dd>
            <dt>โมเดลปรับค่าให้อยู่ในขอบเขต</dt><dd>{run.predicted.extrapolated ? 'ใช่' : 'ไม่ใช่'}</dd>
            <dt>เหตุการณ์ผิดปกติระหว่างรัน</dt><dd>{run.events.length ? run.events.map((e) => e.label).join(', ') : 'ไม่มี'}</dd>
          </dl>
          {run.points.length ? (
            <details className="inline-details"><summary><span>ค่าที่จดระหว่างรัน</span><span className="cap">{run.points.length} จุด</span></summary><div className="inline-details__body"><DT caption="ค่าที่จดระหว่างรัน">
              <thead><tr><th className="ld-num">นาที</th><th className="ld-num">Tin (°C) <Chip kind="observed" /></th><th className="ld-num">Tout (°C) <Chip kind="observed" /></th></tr></thead>
              <tbody>{[...run.points].sort((a, b) => a.tMin - b.tMin).map((p) => <tr key={p.id}><td data-label="นาที" className="ld-num">{p.tMin.toFixed(1)}</td><td data-label="Tin (Observed)" className="ld-num">{p.tin === null ? 'ยังไม่มีค่า' : p.tin.toFixed(1)}</td><td data-label="Tout (Observed)" className="ld-num">{p.tout === null ? 'ยังไม่มีค่า' : p.tout.toFixed(1)}</td></tr>)}</tbody>
            </DT></div></details>
          ) : <p className="muted">รันนี้ไม่มีจุดที่จด</p>}
        </div>
      </article>

      {createPortal(
        <div className="print-label ld-root" aria-hidden="true">
          <div className="print-label__box">
            <h2>{run.id}</h2>
            <p>{run.materialName}</p>
            <p>วันที่ {fmtDate(run.dateISO)}</p>
            <p>เครื่อง {run.profileId}</p>
            {run.sample ? <p><strong>ข้อมูลตัวอย่าง</strong></p> : null}
          </div>
        </div>, document.body)}
    </div>
  );
}
