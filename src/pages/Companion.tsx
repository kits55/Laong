// ดูผลก่อนรันแบบสั้น (companion): Prediction, Evidence, Suggested Experiment แยก 3 ส่วน อ่านอย่างเดียว
import { go } from '../app/router';
import { MODEL_VERSION } from '../core/adapter';
import { useAppState, useProfile } from '../data/store';
import { derivePre } from '../lib/prep';
import { mean } from '../lib/util';
import { predictionError } from '../lib/runs';
import { Btn, Chip, DT, Metric, Notice, Panel, PageHead, UnvalidatedBar, Val } from '../ui/kit';
import { Icon } from '../ui/icons';
import { useFormulaCheck } from './Report';

export function PredictionSummary() {
  const cur = useAppState((s) => s.cur);
  const profile = useProfile();
  const d = derivePre(cur.pre, profile);
  const snap = cur.predicted;
  if (!snap) {
    return (
      <div className="stack">
        <Notice kind="info" title="ยังไม่มีผลประเมิน">กรอกค่าที่หน้าก่อนทดลองแล้วกดประเมิน Tout ผลจะมาแสดงที่นี่แบบสั้น</Notice>
        <div className="row"><Btn variant="primary" icon="flask" onClick={() => go('/pre')}>ไปประเมิน Tout</Btn></div>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="result-grid">
        <Metric label="Tout โมเดล eta" value={snap.prediction.eta?.tout ?? null} unit="°C" kind="predicted" />
        <Metric label="Tout โมเดล UA" value={snap.prediction.ua?.tout ?? null} unit="°C" kind="predicted" />
        <Metric label="Tin ที่ตั้ง" value={snap.tin} unit="°C" kind="assumed" />
        <Metric label="อัตราป้อน" value={snap.feedMlMin} unit="mL/min" kind={snap.feedKind} />
        <Metric label="TS" value={snap.solidsFrac * 100} unit="%" kind={snap.solidsKind} />
      </div>
      <UnvalidatedBar />
      {snap.inputsKey !== d.key ? <Notice kind="warn" title="ผลนี้เป็นของค่าเดิม">ค่าที่กรอกเปลี่ยนไปแล้ว ประเมินใหม่ที่หน้าก่อนทดลอง</Notice> : null}
    </div>
  );
}

export function EvidenceSummary() {
  const cur = useAppState((s) => s.cur);
  const runs = useAppState((s) => s.runs);
  const profile = useProfile();
  const check = useFormulaCheck();
  const same = runs.filter((r) => r.materialId === cur.pre.materialId && r.profileId === profile.id && predictionError(r) !== null);
  const errs = same.map((r) => predictionError(r) as number);
  return (
    <div className="stack">
      <dl className="kv">
        <dt>โมเดล</dt><dd><span className="ld-num">{MODEL_VERSION}</span></dd>
        <dt>ไฟล์สูตรตรง hash ต้นฉบับ</dt><dd>{check.state === 'match' ? <Chip kind="validated" extra="hash ตรง" /> : check.state === 'checking' ? 'กำลังตรวจ' : <Chip kind="missing" extra="ตรวจไม่ได้" />}</dd>
        <dt>โปรไฟล์เครื่อง</dt><dd>{profile.code} <Chip kind="assumed" extra="ค่าตัวอย่าง" /></dd>
      </dl>
      <h3 className="h3">รันก่อนหน้าที่วัสดุและเครื่องเดียวกัน</h3>
      {same.length ? (
        <>
          <DT caption="รันก่อนหน้าที่ใกล้เคียง">
            <thead><tr><th>รัน</th><th className="ld-num">ทำนาย (°C) <Chip kind="predicted" /></th><th className="ld-num">อ่านได้ (°C) <Chip kind="observed" /></th><th className="ld-num">ผลต่าง (°C) <Chip kind="calculated" /></th></tr></thead>
            <tbody>{same.map((r) => <tr key={r.id}><td data-label="รัน" className="cell-left">{r.id}</td><td data-label="ทำนาย" className="ld-num"><Val v={r.predicted.eta} kind="predicted" /></td><td data-label="อ่านได้" className="ld-num"><Val v={r.measuredTout} kind="observed" /></td><td data-label="ผลต่าง" className="ld-num"><Val v={predictionError(r)} kind="calculated" /></td></tr>)}</tbody>
          </DT>
          <div className="result-grid"><Metric label="ผลต่างเฉลี่ย" value={mean(errs)} unit="°C" kind="calculated" hint={`จาก ${errs.length} รัน จำนวนน้อยเกินสรุป`} /></div>
        </>
      ) : <Notice kind="info" title="ยังไม่มีรันก่อนหน้าที่ใช้เทียบ">รันที่มีค่าที่อ่านได้ของวัสดุและเครื่องเดียวกันจะมาแสดงที่นี่</Notice>}
    </div>
  );
}

export function SuggestedExperiment() {
  return (
    <div className="tile">
      <div className="tile__h"><strong><Icon name="spark" size={20} />Suggested Experiment</strong><span className="soon">ยังไม่เปิดใช้</span></div>
      <p>ข้อเสนอรันถัดไปจากผลที่ผ่านมา ต้องเชื่อมกับ sequential-experiment.js ของแอปเดิม ต้นแบบนี้ไม่คิดตรรกะใหม่และไม่แสดงข้อเสนอที่ไม่มีที่มา</p>
      <p className="cap">ถ้าต้องการหาสภาวะที่ให้ Tout ใกล้เป้าหมาย ใช้ค้นหา Target Tout ในหน้าขั้นสูง ผลเป็น คำนวณ UNVALIDATED เสมอ</p>
    </div>
  );
}

export default function Companion() {
  return (
    <div className="page">
      <PageHead title="ดูผลก่อนรัน" lead="สรุปสั้นสามส่วนสำหรับดูก่อนเริ่มรัน หน้านี้อ่านอย่างเดียว" />
      <Panel title="Prediction"><PredictionSummary /></Panel>
      <Panel title="Evidence"><EvidenceSummary /></Panel>
      <Panel title="Suggested Experiment"><SuggestedExperiment /></Panel>
    </div>
  );
}
