// ขั้น 4 ประวัติ: ตารางรัน, Run Review (เทียบผลจริงกับที่ทำนาย), ตรวจความเสี่ยง, ledger ของการแก้, amendment
import { useState } from 'react';
import { go } from '../app/router';
import { addAmendment, setState, useAppState } from '../data/store';
import type { LabValues, RunRecord } from '../data/types';
import { READ_BAND_C } from '../config/synthetic';
import { predictionError, riskFlags, STATUS_LABEL, withinBand } from '../lib/runs';
import { fmtDate, fmtDateTime, isBadNumber, parseNum } from '../lib/util';
import { Btn, Chip, DT, Metric, Notice, Panel, PageHead, SelectField, Tabs, TextField, Val } from '../ui/kit';
import { PointsChart } from '../ui/charts';
import { Icon } from '../ui/icons';

export function useSelectedRun(): RunRecord | null {
  const runs = useAppState((s) => s.runs);
  const sel = useAppState((s) => s.selectedRunId);
  return runs.find((r) => r.id === sel) ?? runs[0] ?? null;
}

const AMEND_FIELDS: { key: keyof LabValues | 'measuredTout'; label: string; unit: string }[] = [
  { key: 'moisture', label: 'ความชื้น (ผลแล็บ)', unit: '%' },
  { key: 'protein', label: 'โปรตีน (ผลแล็บ)', unit: '%' },
  { key: 'aw', label: 'aw (ผลแล็บ)', unit: '' },
  { key: 'solubility', label: 'การละลาย (ผลแล็บ)', unit: '%' },
  { key: 'measuredTout', label: 'Tout ที่อ่านได้', unit: '°C' },
];

export function RunReview({ run }: { run: RunRecord }) {
  const session = useAppState((s) => s.session);
  const err = predictionError(run);
  const inBand = withinBand(err);
  const [f, setF] = useState({ field: 'moisture', value: '', reason: '' });
  const [errs, setErrs] = useState<{ value?: string; reason?: string }>({});
  const flags = riskFlags(run);
  const sorted = [...run.points].sort((a, b) => a.tMin - b.tMin);
  const [tab, setTab] = useState<'cmp' | 'risk' | 'ledger'>('cmp');

  const apply = () => {
    const e: typeof errs = {};
    if (isBadNumber(f.value)) e.value = 'ค่าใหม่ไม่ใช่ตัวเลข. ช่องนี้รับเฉพาะตัวเลข. เว้นว่างถ้าต้องการล้างค่าให้เป็น ยังไม่มีค่า.';
    if (f.reason.trim().length < 5) e.reason = 'ยังไม่มีเหตุผลการแก้. ledger ต้องบอกได้ว่าแก้เพราะอะไร. เขียนเหตุผลสั้น ๆ อย่างน้อย 5 ตัวอักษร.';
    setErrs(e);
    if (e.value || e.reason) return;
    const spec = AMEND_FIELDS.find((x) => x.key === f.field)!;
    const newVal = parseNum(f.value);
    const oldVal = f.field === 'measuredTout' ? run.measuredTout : run.lab[f.field as keyof LabValues];
    addAmendment(run.id, { by: session?.name ?? 'ไม่ระบุ', field: spec.label, from: oldVal === null ? null : String(oldVal), to: newVal === null ? null : String(newVal), reason: f.reason.trim() }, (r) =>
      f.field === 'measuredTout' ? { ...r, measuredTout: newVal } : { ...r, lab: { ...r.lab, [f.field]: newVal } });
    setF({ ...f, value: '', reason: '' });
  };

  return (
    <div className="stack">
      <Panel title={`Run Review ${run.id}`} actions={<span className="cap">{fmtDateTime(run.dateISO)}</span>}>
        <div className="row">
          {run.sample ? <span className="soon" style={{ borderStyle: 'solid' }}>ข้อมูลตัวอย่าง</span> : null}
          <span className="h3">{run.materialName}</span>
          <span className="cap">{STATUS_LABEL[run.status]}</span>
        </div>
        <Tabs<'cmp' | 'risk' | 'ledger'> label="มุมมองของ Run Review" value={tab} onChange={setTab} tabs={[{ key: 'cmp', label: 'เทียบผล' }, { key: 'risk', label: 'ความเสี่ยง', badge: String(flags.filter((x) => x.level !== 'info').length || '') || undefined }, { key: 'ledger', label: 'ledger และแก้ค่า' }]} />
        <div className="tabpanel" key={tab} role="tabpanel" aria-labelledby={`pt-${tab}`}>
        {tab === 'cmp' ? (<>
        <div className="result-grid">
          <Metric label="Tout ที่ทำนาย (eta)" value={run.predicted.eta} unit="°C" kind="predicted" />
          <Metric label="Tout ที่อ่านได้" value={run.measuredTout} unit="°C" kind="observed" hint={run.measuredTout === null ? 'ยังไม่มีค่าที่จดจากหน้าจอเครื่อง' : undefined} />
          <Metric label="predictionError" value={err} unit="°C" kind="calculated" hint={err === null ? 'ยังไม่มีค่า จนกว่าจะมีค่าที่อ่านได้จริง' : 'ที่อ่านได้ ลบ ที่ทำนาย'} />
        </div>
        {inBand === true ? <Notice kind="ok" title="อยู่ในแนวอ่านผล">ผลต่างอยู่ภายในราว {READ_BAND_C} °C ที่ปลื้มยอมรับ ใช้เป็นแนวอ่าน ไม่ใช่ค่าที่ระบบเคลมว่าแม่น</Notice> : null}
        {inBand === false ? <Notice kind="warn" title="ผลต่างเกินแนวอ่านผล">ผลต่างเกินราว {READ_BAND_C} °C ตรวจค่าที่จด สภาวะเครื่อง และโปรไฟล์ที่ใช้ก่อนสรุป</Notice> : null}
        <Notice kind="unvalidated" title="ผลทำนายยัง UNVALIDATED">การเทียบรายรันเดียวไม่พอยืนยันโมเดล ใช้ประกอบการทบทวนเท่านั้น</Notice>

        <PointsChart
          title="Tout ที่จดตามเวลา เทียบกับค่าที่ทำนาย"
          yLabel="Tout (°C)"
          band={run.predicted.eta !== null ? { from: run.predicted.eta - READ_BAND_C, to: run.predicted.eta + READ_BAND_C, label: 'แนวอ่านผลรอบค่าที่ทำนาย' } : null}
          series={[{ id: 'tout', label: 'Tout ที่จด', kind: 'observed', marker: 'circle', points: sorted.map((p) => ({ x: p.tMin, y: p.tout })) }]}
          emptyText="รันนี้ไม่มีจุดที่จด จึงไม่มีกราฟ"
          table={sorted.length ? (
            <DT caption="Tout ที่จดตามเวลา">
              <thead><tr><th className="ld-num">นาที</th><th className="ld-num">Tout (°C)</th></tr></thead>
              <tbody>{sorted.map((p) => <tr key={p.id}><td data-label="นาที" className="ld-num">{p.tMin.toFixed(1)}</td><td data-label="Tout" className="ld-num"><Val v={p.tout} kind="observed" /></td></tr>)}</tbody>
            </DT>
          ) : <p className="muted">ไม่มีข้อมูล</p>}
        />
        </>) : null}
        {tab === 'risk' ? (
        <div className="stack-sm">
          {flags.map((r, i) => <Notice key={i} kind={r.level === 'info' ? 'info' : r.level === 'warn' ? 'warn' : 'danger'} title={r.text} />)}
        </div>) : null}
        {tab === 'ledger' ? (<>
        {run.amendments.length ? (
          <DT caption="ประวัติการแก้ค่า">
            <thead><tr><th>เมื่อ</th><th>โดย</th><th>รายการ</th><th className="ld-num">จาก</th><th className="ld-num">เป็น</th><th>เหตุผล</th></tr></thead>
            <tbody>
              {run.amendments.map((a) => (
                <tr key={a.id}>
                  <td data-label="เมื่อ" className="cell-left">{fmtDateTime(a.at)}</td>
                  <td data-label="โดย" className="cell-left">{a.by}</td>
                  <td data-label="รายการ" className="cell-left">{a.field}</td>
                  <td data-label="จาก" className="ld-num">{a.from === null ? 'ยังไม่มีค่า' : a.from}</td>
                  <td data-label="เป็น" className="ld-num">{a.to === null ? 'ยังไม่มีค่า' : a.to}</td>
                  <td data-label="เหตุผล" className="cell-left">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </DT>
        ) : <p className="muted">รันนี้ยังไม่เคยถูกแก้ค่า</p>}
        <div className="stack">
          <h3 className="h3">แก้ค่า (amendment)</h3>
          <p className="muted small">ค่าเดิมไม่หาย ระบบเก็บทั้งค่าเดิม ค่าใหม่ ผู้แก้ และเหตุผลไว้ใน ledger</p>
          <div className="form-grid">
            <SelectField id="am-f" label="รายการที่จะแก้" value={f.field} onChange={(v) => setF({ ...f, field: v })} options={AMEND_FIELDS.map((a) => ({ value: a.key, label: a.label }))} />
            <TextField id="am-v" label="ค่าใหม่" value={f.value} onChange={(v) => setF({ ...f, value: v })} error={errs.value} hint="เว้นว่างเพื่อล้างค่า" />
          </div>
          <TextField id="am-r" label="เหตุผลการแก้" value={f.reason} onChange={(v) => setF({ ...f, reason: v })} error={errs.reason} />
          <div className="row"><Btn icon="edit" onClick={apply}>บันทึกการแก้</Btn><Chip kind="measured" extra="ค่าแล็บ" /></div>
        </div>
        </>) : null}
        </div>
      </Panel>
    </div>
  );
}

/* จุดสถานะของรัน: บอกด้วยคำเสมอ จุดสีเป็นแค่ตัวช่วย */
export function StatusPill({ status }: { status: RunRecord['status'] }) {
  return <span className="spill" data-s={status}><i aria-hidden="true" />{STATUS_LABEL[status]}</span>;
}

export default function History() {
  const runs = useAppState((s) => s.runs);
  const selected = useSelectedRun();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | RunRecord['status']>('all');
  const query = q.trim().toLowerCase();
  const shown = runs.filter((r) => (st === 'all' || r.status === st) && (!query || r.id.toLowerCase().includes(query) || r.materialName.toLowerCase().includes(query) || r.label.toLowerCase().includes(query)));
  const filtered = query !== '' || st !== 'all';

  const open = (id: string) => {
    setState({ selectedRunId: id });
    requestAnimationFrame(() => document.getElementById('run-review')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  return (
    <div className="page">
      <PageHead title="ประวัติและรายงาน" lead="เปิดรันที่ปิดแล้วเพื่อดูผลและออกรายงาน หน้านี้ดูและทบทวนอย่างเดียว ไม่ต้องกรอกอะไรเพิ่ม"
        actions={<Btn icon="report" onClick={() => go('/report')} disabled={!selected}>ออกรายงานของรันที่เลือก</Btn>} />
      <section className="ld-panel listcard" aria-label="รายการรัน">
        <div className="filters">
          <div className="fgrp fgrp--grow">
            <label htmlFor="h-q">ค้นหาการทดลอง</label>
            <span className="finput"><Icon name="search" size={18} /><input id="h-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อการทดลองหรือรหัสรัน" autoComplete="off" /></span>
          </div>
          <div className="fgrp">
            <label htmlFor="h-s">สถานะ</label>
            <select id="h-s" className="fselect" value={st} onChange={(e) => setSt(e.target.value as typeof st)}>
              <option value="all">ทุกสถานะ</option>
              {(Object.keys(STATUS_LABEL) as RunRecord['status'][]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
            </select>
          </div>
          <button type="button" className="fclear" onClick={() => { setQ(''); setSt('all'); }} disabled={!filtered}>ล้างตัวกรอง</button>
        </div>
        <p className="listcard__count" aria-live="polite">แสดง {shown.length}{filtered ? ` จาก ${runs.length}` : ''} การทดลอง</p>
        {shown.length === 0 ? (
          <p className="listcard__empty">{runs.length === 0 ? 'ยังไม่มีรัน ปิดรันแรกแล้วจะเห็นที่นี่' : 'ไม่พบการทดลองที่ตรงกับตัวกรอง'}</p>
        ) : (
          <DT caption="ตารางรันทั้งหมด" className="hist-table">
            <thead>
              <tr><th>รัน</th><th>ชื่อการทดลอง</th><th>แบบฟอร์ม</th><th>สถานะ</th><th>สร้างเมื่อ</th><th><span className="sr-only">การดำเนินการ</span></th></tr>
            </thead>
            <tbody key={`${query}|${st}`}>
              {shown.map((r, i) => (
                <tr key={r.id} data-selected={selected?.id === r.id ? 'true' : undefined} style={{ ['--i' as string]: Math.min(i, 8) }}>
                  <td data-label="รัน" className="cell-left"><span className="mono">{r.id}</span></td>
                  <td data-label="ชื่อการทดลอง" className="cell-left"><strong className="rname">{r.materialName}</strong>{r.sample ? <span className="cap"> · ตัวอย่าง</span> : null}</td>
                  <td data-label="แบบฟอร์ม" className="cell-left hide-narrow">Spray Dryer</td>
                  <td data-label="สถานะ" className="cell-left"><StatusPill status={r.status} /></td>
                  <td data-label="สร้างเมื่อ" className="cell-left">{fmtDate(r.dateISO)}</td>
                  <td data-label="เปิด" className="cell-act">
                    <Btn className="rowbtn" aria-pressed={selected?.id === r.id} onClick={() => open(r.id)}>
                      {selected?.id === r.id ? 'กำลังดู' : 'ดูผล'}<Icon name="chevronRight" size={16} />
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </DT>
        )}
      </section>
      <div id="run-review" className="anchor">
        {selected ? <RunReview run={selected} key={selected.id} /> : <Notice kind="info" title="ยังไม่มีรัน">ปิดรันแรกแล้วจะเห็นที่นี่</Notice>}
      </div>
    </div>
  );
}
