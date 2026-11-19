// ขั้นสูง (ผู้ทบทวนและผู้ดูแล): คาลิเบรต, Optimizer และค้นหา Target Tout, ข้อมูลและสำรอง, ตรวจสูตร
import { useMemo, useRef, useState } from 'react';
import { backSolve, searchTargetTout, type TargetToutResult } from '../core/adapter';
import { roundTripTest } from '../core/integrity';
import { allProtoKeys, KEYS, resetSampleData, setState, useAppState, useProfile } from '../data/store';
import { download } from '../lib/export';
import { mean, parseNum, stdev, fmtDateTime } from '../lib/util';
import { Btn, Chip, DT, Metric, Notice, NumField, Panel, PageHead, SelectField, UnvalidatedBar, Val } from '../ui/kit';
import { Icon } from '../ui/icons';
import { ThemedImg } from '../ui/themed';
import { go } from '../app/router';
import { useFormulaCheck } from './Report';
import { PointsChart } from '../ui/charts';
import { hasAnyLab } from '../lib/runs';

type TabKey = 'calib' | 'opt' | 'data' | 'check';

export default function Advanced() {
  const session = useAppState((s) => s.session);
  const [tab, setTab] = useState<TabKey>('calib');
  if (session?.role === 'operator') {
    return (
      <div className="page">
        <PageHead title="ขั้นสูง" lead="หน้านี้ซ่อนจากผู้ปฏิบัติงานหน้างาน เพื่อไม่ให้ปรับค่าที่กระทบผลโดยไม่ตั้งใจ" />
        <ThemedImg name="state-403" folder="images/art" className="state-art" width={320} height={200} alt="ไม่มีสิทธิ์เข้าหน้านี้" />
        <Notice kind="info" title="ต้องใช้บทบาทผู้ทบทวนหรือผู้ดูแล">บทบาทปัจจุบันคือผู้ปฏิบัติงาน ออกจากระบบแล้วเข้าใหม่ด้วยบทบาทตัวอย่างอื่นเพื่อดูหน้านี้
          <div className="row" style={{ marginTop: 8 }}><Btn onClick={() => { setState({ session: null }); go('/login'); }} icon="logout">ออกจากระบบ</Btn></div></Notice>
      </div>
    );
  }
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'calib', label: 'คาลิเบรต' }, { key: 'opt', label: 'Optimizer และ Target Tout' }, { key: 'data', label: 'ข้อมูลและสำรอง' }, { key: 'check', label: 'ตรวจสูตร' },
  ];
  return (
    <div className="page">
      <PageHead title="ขั้นสูง" lead="เครื่องมือเฉพาะทางสำหรับผู้ทบทวน ผลทุกอย่างในหน้านี้ยัง UNVALIDATED" />
      <div className="tabs" role="tablist" aria-label="หมวดขั้นสูง">
        {tabs.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`panel-${t.key}`} className="tab" onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
        {tab === 'calib' && <Calibration />}
        {tab === 'opt' && <Optimizer />}
        {tab === 'data' && <DataBackup />}
        {tab === 'check' && <FormulaCheckPanel />}
      </div>
    </div>
  );
}

/* ---------- คาลิเบรต: ใช้เฉพาะรันที่ตรงกับโปรไฟล์ที่เลือกเป๊ะ ไม่ scale ลม ไม่ถอยไปใช้ค่าเก่า (กฎข้อมูลข้อ 7) ---------- */
function Calibration() {
  const runs = useAppState((s) => s.runs);
  const profile = useProfile();
  const eligible = runs.filter((r) => r.profileId === profile.id && r.measuredTout !== null && r.inputs.tin !== null);
  const excluded = runs.filter((r) => r.measuredTout !== null && r.profileId !== profile.id).length;
  const rows = eligible.map((r) => ({ run: r, bs: backSolve({ tin: r.inputs.tin, tout: r.measuredTout, feedMlMin: r.inputs.feedMlMin, solidsFrac: r.inputs.solidsFrac, airFlow: r.inputs.airFlow, troom: profile.troom, tfeed: profile.tfeed }) }));
  const etas = rows.map((r) => r.bs?.eta.ok ? r.bs.eta.value : null).filter((v): v is number => v !== null);
  const uas = rows.map((r) => r.bs?.ua.ok ? r.bs.ua.value : null).filter((v): v is number => v !== null);
  const cv = (xs: number[]) => { const m = mean(xs), s = stdev(xs); return m === null || s === null || m === 0 ? null : (s / m) * 100; };
  return (
    <>
      <Panel title={`โต๊ะเทียบ eta กับ UA ของ ${profile.code}`}>
        <Notice kind="warn" title="ใช้เฉพาะรันที่ตรงกับโปรไฟล์นี้เป๊ะ">ระบบไม่ปรับสเกลลม และไม่ถอยไปใช้ค่า default เก่าเมื่อโปรไฟล์เปลี่ยน {excluded > 0 ? `มี ${excluded} รันของโปรไฟล์อื่นที่ไม่ถูกนำมาคิด` : ''}</Notice>
        {rows.length ? (
          <DT caption="eta และ UA ที่ย้อนหาจากรันที่มีค่าที่อ่านได้">
            <thead><tr><th>รัน</th><th className="ld-num">Tout อ่านได้ (°C) <Chip kind="observed" /></th><th className="ld-num">eta <Chip kind="calculated" /></th><th className="ld-num">UA (kJ/(h·K)) <Chip kind="calculated" /></th><th>หมายเหตุจากสูตร</th></tr></thead>
            <tbody>
              {rows.map(({ run, bs }) => (
                <tr key={run.id}>
                  <td data-label="รัน" className="cell-left">{run.id}</td>
                  <td data-label="Tout อ่านได้" className="ld-num"><Val v={run.measuredTout} kind="observed" /></td>
                  <td data-label="eta" className="ld-num"><Val v={bs?.eta.ok ? bs.eta.value : null} digits={3} kind="calculated" /></td>
                  <td data-label="UA" className="ld-num"><Val v={bs?.ua.ok ? bs.ua.value : null} digits={2} kind="calculated" /></td>
                  <td data-label="หมายเหตุ" className="cell-left small">{bs ? (!bs.eta.ok ? bs.eta.msg : !bs.ua.ok ? bs.ua.msg : 'ผ่านเงื่อนไขของสูตร') : 'ข้อมูลไม่ครบ'}</td>
                </tr>
              ))}
            </tbody>
          </DT>
        ) : <p className="muted">ยังไม่มีรันที่ตรงกับโปรไฟล์นี้และมีค่าที่อ่านได้</p>}
        <div className="result-grid">
          <Metric label="eta เฉลี่ย" value={mean(etas)} digits={3} kind="calculated" hint={etas.length ? `จาก ${etas.length} รัน` : undefined} />
          <Metric label="eta CV%" value={cv(etas)} unit="%" kind="calculated" hint={etas.length < 2 ? 'ต้องมีอย่างน้อย 2 รัน' : undefined} />
          <Metric label="UA เฉลี่ย" value={mean(uas)} digits={2} unit="kJ/(h·K)" kind="calculated" />
          <Metric label="UA CV%" value={cv(uas)} unit="%" kind="calculated" hint={uas.length < 2 ? 'ต้องมีอย่างน้อย 2 รัน' : undefined} />
        </div>
        <PointsChart
          title="eta ที่ย้อนหาได้ ต่อรัน"
          yLabel="eta"
          categories={rows.map((r) => r.run.id)}
          lines={false}
          series={[{ id: 'eta', label: 'eta ที่ย้อนหา', kind: 'calculated', marker: 'circle', points: rows.map((r) => ({ x: r.run.id, y: r.bs?.eta.ok ? r.bs.eta.value : null })) }]}
          table={<p className="cap">ตัวเลขอยู่ในตารางด้านบน</p>}
          emptyText="ยังไม่มีข้อมูลให้แสดง"
        />
      </Panel>
      <Panel title="Apply guard">
        <Notice kind="info" title="ปุ่มใช้ค่าถูกล็อกในต้นแบบ">การนำ eta หรือ UA ใหม่ไปใช้กับโปรไฟล์ต้องรอเกณฑ์จริงจากเจ้าของ (calibration.js) ต้นแบบนี้ดูผลย้อนหาได้เท่านั้น เพื่อไม่ให้ค่าตัวอย่างถูกเข้าใจผิดว่าเป็นค่าคาลิเบรตจริง</Notice>
        <div className="row"><Btn disabled icon="lock">ใช้ค่านี้กับโปรไฟล์</Btn><span className="soon">ยังไม่เปิดใช้</span></div>
      </Panel>
    </>
  );
}

/* ---------- ค้นหา Target Tout แบบ grid ---------- */
export function TargetSearch() {
  const profile = useProfile();
  const [f, setF] = useState({ target: '85', tol: '3', tinA: '140', tinB: '180', tinS: '10', fA: '6', fB: '12', fS: '1', ts: '15', model: 'eta' });
  const [res, setRes] = useState<TargetToutResult | null>(null);
  const v = { target: parseNum(f.target), tol: parseNum(f.tol), tinA: parseNum(f.tinA), tinB: parseNum(f.tinB), tinS: parseNum(f.tinS), fA: parseNum(f.fA), fB: parseNum(f.fB), fS: parseNum(f.fS), ts: parseNum(f.ts) };
  const bad = Object.values(v).some((x) => x === null) || v.tinS! <= 0 || v.fS! <= 0 || v.tinA! > v.tinB! || v.fA! > v.fB! || v.ts! <= 0 || v.ts! >= 100 || v.tol! < 0
    || ((v.tinB! - v.tinA!) / v.tinS! + 1) * ((v.fB! - v.fA!) / v.fS! + 1) > 2500;
  const run = () => {
    if (bad) return;
    setRes(searchTargetTout({ target: v.target!, tolerance: v.tol!, tinFrom: v.tinA!, tinTo: v.tinB!, tinStep: v.tinS!, feedFrom: v.fA!, feedTo: v.fB!, feedStep: v.fS!, solidsFrac: v.ts! / 100, airFlow: profile.airFlow, model: f.model as 'eta' | 'ua', eta: profile.eta, ua: profile.ua, tfeed: profile.tfeed, troom: profile.troom }));
  };
  const json = useMemo(() => res ? JSON.stringify({ kind: res.kind, validation: res.validation, recommendations: res.recommendations, operationallyApproved: res.operationallyApproved, modelVersion: res.modelVersion, model: res.model, target: res.target, tolerance: res.tolerance, matchCount: res.matches.length, cellCount: res.cells.length }, null, 2) : '', [res]);
  return (
    <Panel title="ค้นหา Target Tout แบบ grid">
      <p className="muted small">บอก Tout ที่ต้องการ ระบบสแกนชุด Tin กับอัตราป้อน แล้วแสดงจุดที่โมเดลคำนวณได้ใกล้ค่านั้น ไม่ใช่คำแนะนำให้ตั้งเครื่อง</p>
      <div className="form-grid">
        <NumField id="tt-t" label="Tout เป้าหมาย" unit="°C" value={f.target} onChange={(x) => setF({ ...f, target: x })} />
        <NumField id="tt-tol" label="คลาดเคลื่อนที่รับได้" unit="°C" value={f.tol} onChange={(x) => setF({ ...f, tol: x })} />
        <NumField id="tt-ts" label="TS" unit="%" value={f.ts} onChange={(x) => setF({ ...f, ts: x })} chip={<Chip kind="assumed" />} />
        <SelectField id="tt-m" label="โมเดล" value={f.model} onChange={(x) => setF({ ...f, model: x })} options={[{ value: 'eta', label: 'eta' }, { value: 'ua', label: 'UA' }]} />
        <NumField id="tt-a" label="Tin จาก" unit="°C" value={f.tinA} onChange={(x) => setF({ ...f, tinA: x })} />
        <NumField id="tt-b" label="Tin ถึง" unit="°C" value={f.tinB} onChange={(x) => setF({ ...f, tinB: x })} />
        <NumField id="tt-s" label="Tin ทีละ" unit="°C" value={f.tinS} onChange={(x) => setF({ ...f, tinS: x })} />
        <NumField id="tt-fa" label="อัตราป้อนจาก" unit="mL/min" value={f.fA} onChange={(x) => setF({ ...f, fA: x })} />
        <NumField id="tt-fb" label="อัตราป้อนถึง" unit="mL/min" value={f.fB} onChange={(x) => setF({ ...f, fB: x })} />
        <NumField id="tt-fs" label="อัตราป้อนทีละ" unit="mL/min" value={f.fS} onChange={(x) => setF({ ...f, fS: x })} />
      </div>
      {bad ? <Notice kind="danger" title="ตั้งค่า grid ไม่ครบหรือไม่ถูกต้อง">ทุกช่องต้องเป็นตัวเลข ค่าเริ่มต้องไม่เกินค่าสิ้นสุด ขั้นต้องมากกว่า 0 และจำนวนจุดรวมไม่เกิน 2,500 แก้แล้วกดค้นหา</Notice> : null}
      <Btn variant="primary" icon="refresh" disabled={bad} onClick={run}>ค้นหา Target Tout</Btn>
      {res ? (
        <div className="stack result-in">
          <UnvalidatedBar kind="calculated" extra="ผลนี้เป็นการคำนวณจากโมเดลตัวอย่าง ยังไม่ผ่านการตรวจสอบ และไม่ใช่คำแนะนำที่อนุมัติให้ใช้งานจริง" />
          <p className="muted small">สแกน <span className="ld-num">{res.cells.length}</span> จุด พบ <span className="ld-num">{res.matches.length}</span> จุดที่ใกล้เป้าหมายและโมเดลไม่ปรับค่า</p>
          {res.matches.length ? (
            <DT caption="จุดที่โมเดลคำนวณได้ใกล้ Tout เป้าหมาย">
              <thead><tr><th className="ld-num">Tin (°C) <Chip kind="assumed" /></th><th className="ld-num">อัตราป้อน (mL/min) <Chip kind="assumed" /></th><th className="ld-num">Tout คำนวณ (°C) <Chip kind="calculated" /></th><th className="ld-num">ห่างจากเป้า (°C) <Chip kind="calculated" /></th></tr></thead>
              <tbody>
                {res.matches.slice(0, 12).map((c, i) => (
                  <tr key={i}><td data-label="Tin (Assumed)" className="ld-num">{c.tin}</td><td data-label="ป้อน (Assumed)" className="ld-num">{c.feed}</td><td data-label="Tout" className="ld-num"><Val v={c.tout} kind="calculated" /></td><td data-label="ห่างจากเป้า" className="ld-num"><Val v={c.diff} kind="calculated" /></td></tr>
                ))}
              </tbody>
            </DT>
          ) : <Notice kind="info" title="ไม่พบจุดที่ใกล้เป้าหมาย">ลองขยายช่วง Tin หรืออัตราป้อน หรือเพิ่มค่าคลาดเคลื่อนที่รับได้</Notice>}
          <details className="chart__table"><summary>ดูข้อมูลทางเทคนิคของผล</summary><pre className="json">{json}</pre></details>
          <div className="row"><Btn icon="download" onClick={() => download('target-tout.json', JSON.stringify({ kind: res.kind, validation: res.validation, recommendations: res.recommendations, operationallyApproved: res.operationallyApproved, modelVersion: res.modelVersion, model: res.model, target: res.target, tolerance: res.tolerance, matches: res.matches }, null, 2), 'application/json')}>ส่งออกผลเป็น JSON</Btn></div>
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------- Optimizer ---------- */
function Optimizer() {
  const runs = useAppState((s) => s.runs);
  const [by, setBy] = useState('moisture');
  const withLab = runs.filter((r) => hasAnyLab(r.lab));
  const keyOf = (r: typeof runs[number]) => by === 'moisture' ? r.lab.moisture : by === 'aw' ? r.lab.aw : r.lab.solubility;
  const sorted = withLab.filter((r) => keyOf(r) !== null).sort((a, b) => by === 'solubility' ? (keyOf(b) as number) - (keyOf(a) as number) : (keyOf(a) as number) - (keyOf(b) as number));
  const unit = by === 'aw' ? '' : '%';
  return (
    <>
      <Panel title="Best observed">
        <p className="muted small">เรียงรันที่มีผลแล็บตามเกณฑ์ที่เลือก เป็นการเรียงข้อมูลที่เคยวัดได้ ไม่ใช่การทำนาย</p>
        <SelectField id="opt-by" label="เรียงตาม" value={by} onChange={setBy} options={[{ value: 'moisture', label: 'ความชื้นต่ำสุด' }, { value: 'aw', label: 'aw ต่ำสุด' }, { value: 'solubility', label: 'การละลายสูงสุด' }]} />
        {sorted.length ? (
          <DT caption="รันเรียงตามเกณฑ์">
            <thead><tr><th>อันดับ</th><th>รัน</th><th className="ld-num">Tin (°C) <Chip kind="assumed" /></th><th className="ld-num">{by === 'moisture' ? 'ความชื้น' : by === 'aw' ? 'aw' : 'การละลาย'} {unit ? `(${unit})` : ''} <Chip kind="measured" /></th></tr></thead>
            <tbody>{sorted.slice(0, 6).map((r, i) => <tr key={r.id}><td data-label="อันดับ" className="cell-left">{i + 1}</td><td data-label="รัน" className="cell-left">{r.id}{r.sample ? <span className="cap"> ตัวอย่าง</span> : null}</td><td data-label="Tin (Assumed)" className="ld-num"><Val v={r.inputs.tin} kind="assumed" /></td><td data-label="ค่า" className="ld-num"><Val v={keyOf(r)} digits={by === 'aw' ? 2 : 1} kind="measured" /></td></tr>)}</tbody>
          </DT>
        ) : <p className="muted">ยังไม่มีรันที่มีผลแล็บตามเกณฑ์นี้</p>}
      </Panel>
      <div className="grid-2">
        <div className="tile"><div className="tile__h"><strong><Icon name="spark" size={20} />Suggested next run</strong><span className="soon">ยังไม่เปิดใช้</span></div><p>แนะนำสภาวะของรันถัดไปจากผลที่ผ่านมา ต้องเชื่อมกับ powder-optimizer.js และ sequential-experiment.js ของแอปเดิม ต้นแบบนี้ไม่คิดตรรกะใหม่</p></div>
        <div className="tile"><div className="tile__h"><strong><Icon name="chart" size={20} />Pareto</strong><span className="soon">ยังไม่เปิดใช้</span></div><p>เทียบหลายเป้าหมายพร้อมกัน เช่น ความชื้นกับการละลาย รอตรรกะจาก powder-optimizer.js</p></div>
      </div>
      <TargetSearch />
    </>
  );
}

/* ---------- ข้อมูลและสำรอง ---------- */
function DataBackup() {
  const runs = useAppState((s) => s.runs);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ name: string; payload: Record<string, unknown>; checks: { ok: boolean; text: string }[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const snapshot = () => {
    const data: Record<string, unknown> = {};
    allProtoKeys().forEach((k) => { try { data[k] = JSON.parse(localStorage.getItem(k) as string); } catch { data[k] = null; } });
    return { app: 'laong-spraydry-copilot', schema: 'proto-1', exportedAt: new Date().toISOString(), note: 'ข้อมูลตัวอย่างของต้นแบบ', data };
  };
  const onFile = async (f: File | undefined) => {
    setMsg(null);
    if (!f) return;
    const checks: { ok: boolean; text: string }[] = [];
    try {
      const j = JSON.parse(await f.text());
      const keys = Object.keys(j.data ?? {});
      checks.push({ ok: j.app === 'laong-spraydry-copilot', text: j.app === 'laong-spraydry-copilot' ? 'ไฟล์มาจากแอปนี้' : 'ไฟล์ไม่ได้มาจากแอปนี้ ไม่ควรนำเข้า' });
      checks.push({ ok: keys.length > 0 && keys.every((k) => k.startsWith('proto_')), text: keys.every((k) => k.startsWith('proto_')) && keys.length ? `key ทั้ง ${keys.length} รายการขึ้นต้น proto_` : 'พบ key ที่ไม่ขึ้นต้น proto_ หรือไม่มีข้อมูล' });
      const rs = j.data?.[KEYS.runs];
      checks.push({ ok: Array.isArray(rs), text: Array.isArray(rs) ? `มีรันในไฟล์ ${rs.length} รัน` : 'ไม่พบรายการรัน' });
      const bad = Array.isArray(rs) ? rs.filter((r: any) => typeof r?.id !== 'string').length : 0;
      checks.push({ ok: bad === 0, text: bad === 0 ? 'ทุกรันมีรหัส' : `มี ${bad} รันที่ไม่มีรหัส` });
      setPreview({ name: f.name, payload: j.data ?? {}, checks });
    } catch {
      setPreview({ name: f.name, payload: {}, checks: [{ ok: false, text: 'อ่านไฟล์ไม่ได้ ไม่ใช่ JSON ที่ถูกต้อง เลือกไฟล์สำรองที่ส่งออกจากแอปนี้' }] });
    }
  };
  const confirmImport = () => {
    if (!preview) return;
    Object.entries(preview.payload).forEach(([k, v]) => { if (k.startsWith('proto_')) localStorage.setItem(k, JSON.stringify(v)); });
    setMsg('นำเข้าแล้ว กำลังโหลดแอปใหม่');
    setTimeout(() => window.location.reload(), 600);
  };
  const importable = !!preview && preview.checks.every((c) => c.ok);

  return (
    <>
      <Panel title="สำรองข้อมูล">
        <p className="muted small">ไฟล์สำรองมีข้อมูลทั้งหมดของต้นแบบนี้ ({runs.length} รัน รวมแผน โปรไฟล์ และร่าง) ค่าว่างถูกเก็บเป็น null ไม่ใช่ 0</p>
        <div className="row">
          <Btn variant="primary" icon="download" onClick={() => download(`laong-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot(), null, 2), 'application/json')}>ส่งออกสำรอง JSON</Btn>
          <Btn icon="download" onClick={() => download('laong-runs.json', JSON.stringify(runs, null, 2), 'application/json')}>ส่งออกเฉพาะรัน</Btn>
        </div>
      </Panel>
      <Panel title="นำเข้าข้อมูล">
        <p className="muted small">เลือกไฟล์สำรอง ระบบตรวจให้ดูก่อน แล้วค่อยยืนยันนำเข้า การนำเข้าจะแทนที่ข้อมูลเดิมของต้นแบบ</p>
        <input ref={fileRef} id="import-file" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="row"><Btn icon="upload" onClick={() => fileRef.current?.click()}>เลือกไฟล์สำรอง</Btn>{preview ? <span className="cap">{preview.name}</span> : null}</div>
        {preview ? (
          <div className="stack">
            <div className="stack-sm">{preview.checks.map((c, i) => <Notice key={i} kind={c.ok ? 'ok' : 'danger'} title={c.text} />)}</div>
            <Btn variant="danger" icon="upload" disabled={!importable} onClick={confirmImport}>ยืนยันนำเข้าและแทนที่ข้อมูลเดิม</Btn>
          </div>
        ) : null}
        {msg ? <Notice kind="ok" title={msg} role="status" /> : null}
      </Panel>
      <Panel title="รีเซ็ตข้อมูลตัวอย่าง">
        <p className="muted small">คืนรันตัวอย่าง 7 รันกลับเป็นค่าเริ่มต้น รันที่คุณปิดเองจะหายไปจากประวัติ ควรส่งออกสำรองก่อน</p>
        <Btn icon="refresh" onClick={() => { if (window.confirm('คืนรันตัวอย่างเป็นค่าเริ่มต้นหรือไม่ รันที่คุณปิดเองจะหายไปจากประวัติ')) resetSampleData(); }}>คืนรันตัวอย่างเป็นค่าเริ่มต้น</Btn>
      </Panel>
      <Panel title="ข้อมูลที่เก็บในเครื่องนี้">
        <ul className="todo">{allProtoKeys().map((k) => <li key={k}><span className="todo__t ld-num small">{k}</span></li>)}</ul>
        <p className="cap">ทุก key ขึ้นต้น proto_ ไม่แตะ key เดิม spraydry_ ของแอปต้นฉบับ</p>
      </Panel>
    </>
  );
}

/* ---------- ตรวจสูตร ---------- */
function FormulaCheckPanel() {
  const c = useFormulaCheck();
  const [rt, setRt] = useState<ReturnType<typeof roundTripTest> | null>(null);
  return (
    <>
      <Panel title="hash ของไฟล์สูตร">
        <p className="muted small">แอปตรวจ sha256 ของ physics-model.js ที่ติดมากับตัวแอป เทียบกับค่าที่บรีฟกำหนด ถ้าไม่ตรงให้หยุดใช้ผลทำนายและแจ้งเจ้าของ</p>
        <dl className="kv">
          <dt>ผลตรวจ</dt><dd>{c.state === 'match' ? <Chip kind="validated" extra="hash ตรง" /> : c.state === 'checking' ? 'กำลังตรวจ' : c.state === 'mismatch' ? <Chip kind="unvalidated" extra="hash ไม่ตรง" /> : <Chip kind="missing" extra="ตรวจไม่ได้" />}</dd>
        </dl>
        <p className="eq">ที่คาดหวัง {c.expected || '...'}{'\n'}ที่ตรวจได้ {c.actual ?? 'ยังไม่มีค่า'}</p>
        <p className="cap">เวอร์ชันโมเดล ua-energy-balance-1.0.0 ปลื้มยังไม่ยืนยันว่าสมการเหมือนฉบับก่อนแพ็ก IT</p>
      </Panel>
      <Panel title="ทดสอบย้อนกลับของสูตร">
        <p className="muted small">แทนค่าเข้า forward model แล้วย้อนด้วย solveUA และ solveEta ต้องได้ค่าเดิมกลับมา ใช้กรณีทดสอบสมมติ</p>
        <Btn icon="refresh" onClick={() => setRt(roundTripTest())}>รันการทดสอบ</Btn>
        {rt ? (
          <div className="result-grid result-in">
            <Metric label="solveUA ย้อนกลับได้ UA เดิม" value={rt.uaOk} digits={0} unit={`จาก ${rt.uaTotal} กรณี`} kind="calculated" />
            <Metric label="solveEta ย้อนกลับได้ eta เดิม" value={rt.etaOk} digits={0} unit={`จาก ${rt.etaTotal} กรณี`} kind="calculated" />
          </div>
        ) : null}
        <span className="cap">{session_note()}</span>
      </Panel>
    </>
  );
}
const session_note = () => `ทดสอบเมื่อ ${fmtDateTime(new Date().toISOString())} บนข้อมูลสมมติ`;
