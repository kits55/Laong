// มุมมองอ่านอย่างเดียว (workspace 7 เมนู): รวมของที่มีอยู่แล้วในหน้าอื่น ไม่มีช่องให้กรอกแก้
import { useState } from 'react';
import { go } from '../app/router';
import { MODEL_VERSION } from '../core/adapter';
import { download } from '../lib/export';
import { useAppState, useProfile } from '../data/store';
import { derivePre } from '../lib/prep';
import { predictionError, riskFlags, STATUS_LABEL } from '../lib/runs';
import { fmtDate, fmtDateTime } from '../lib/util';
import { Btn, DT, Metric, Notice, Panel, PageHead, UnvalidatedBar, Val } from '../ui/kit';
import { PointsChart } from '../ui/charts';
import { TargetSearch } from './Advanced';
import { EvidenceSummary, PredictionSummary } from './Companion';
import { useSelectedRun } from './History';

const MENUS = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'cond', label: 'ปรับสภาวะ' },
  { key: 'calc', label: 'ผลคำนวณ' },
  { key: 'hist', label: 'ประวัติและกราฟ' },
  { key: 'review', label: 'ทบทวน' },
  { key: 'backup', label: 'สำรอง/ใช้ต่อ' },
  { key: 'target', label: 'ค้นหา Target Tout' },
] as const;
type MenuKey = typeof MENUS[number]['key'];

export default function Workspace() {
  const [tab, setTab] = useState<MenuKey>('overview');
  const cur = useAppState((s) => s.cur);
  const runs = useAppState((s) => s.runs);
  const draft = useAppState((s) => s.pendingDraft);
  const savedAt = useAppState((s) => s.savedAt);
  const profile = useProfile();
  const run = useSelectedRun();
  const d = derivePre(cur.pre, profile);
  const snap = cur.predicted;
  const cats = runs.slice(0, 7).reverse();

  return (
    <div className="page">
      <PageHead title="มุมมองอ่านอย่างเดียว" lead="ดูข้อมูลทั้งหมดโดยไม่มีช่องให้พิมพ์แก้ เหมาะกับการเปิดดูบนจอใหญ่หรือส่งให้ผู้ร่วมงาน" />
      <Notice kind="info" title="โหมดอ่านอย่างเดียว">ไม่มีช่องแก้ข้อมูลของรันในหน้านี้ ถ้าต้องการแก้ค่า ไปที่หน้าก่อนทดลองหรือระหว่างทดลอง</Notice>
      <div className="tabs" role="tablist" aria-label="เมนูของมุมมองอ่านอย่างเดียว">
        {MENUS.map((m) => <button key={m.key} role="tab" id={`ws-${m.key}`} aria-selected={tab === m.key} aria-controls="ws-panel" className="tab" onClick={() => setTab(m.key)}>{m.label}</button>)}
      </div>
      <div role="tabpanel" id="ws-panel" aria-labelledby={`ws-${tab}`} className="stack">
        {tab === 'overview' && (
          <>
            <Panel title="ผลทำนายปัจจุบัน"><PredictionSummary /></Panel>
            {run ? (
              <Panel title={`รันที่เลือก ${run.id}`}>
                <div className="result-grid">
                  <Metric label="Tout ที่ทำนาย" value={run.predicted.eta} unit="°C" kind="predicted" />
                  <Metric label="Tout ที่อ่านได้" value={run.measuredTout} unit="°C" kind="observed" />
                  <Metric label="ผลต่าง" value={predictionError(run)} unit="°C" kind="calculated" />
                </div>
              </Panel>
            ) : null}
          </>
        )}
        {tab === 'cond' && (
          <Panel title="สภาวะที่กรอกไว้" actions={<Btn variant="quiet" onClick={() => go('/pre')}>ไปแก้ที่หน้าก่อนทดลอง</Btn>}>
            <div className="result-grid">
              <Metric label="Tin ที่ตั้ง" value={d.tin} unit="°C" kind="assumed" />
              <Metric label="อัตราป้อน" value={d.feedMlMin} unit="mL/min" kind={d.feedKind} />
              <Metric label="TS" value={d.solidsFrac === null ? null : d.solidsFrac * 100} unit="%" kind={d.solidsKind} />
              <Metric label="อัตราลมของโปรไฟล์" value={profile.airFlow} unit="m³/h" kind="assumed" />
            </div>
            <p className="cap">วัสดุ {d.material.name} · เครื่อง {profile.code}</p>
          </Panel>
        )}
        {tab === 'calc' && (
          <Panel title="ผลคำนวณ">
            {snap?.prediction.eta ? (
              <>
                <UnvalidatedBar />
                <ul className="steps-list">
                  {snap.prediction.eta.steps.map((s) => <li key={s.key}><span className="t">{s.label}</span><span className="n">{s.note}</span><span className="v"><Val v={s.value} digits={s.unit === '°C' ? 1 : 3} unit={s.unit} kind="calculated" /></span></li>)}
                </ul>
                <p className="cap">โมเดล {MODEL_VERSION}</p>
              </>
            ) : <p className="muted">ยังไม่มีผลประเมิน ไปที่หน้าก่อนทดลองเพื่อประเมิน Tout</p>}
          </Panel>
        )}
        {tab === 'hist' && (
          <Panel title="ประวัติและกราฟ">
            <PointsChart title="Tout ที่ทำนายและที่อ่านได้" yLabel="Tout (°C)" categories={cats.map((r) => r.id)} links lines={false}
              series={[
                { id: 'p', label: 'ที่ทำนาย', kind: 'predicted', marker: 'square', dashed: true, points: cats.map((r) => ({ x: r.id, y: r.predicted.eta })) },
                { id: 'o', label: 'ที่อ่านได้', kind: 'observed', marker: 'circle', points: cats.map((r) => ({ x: r.id, y: r.measuredTout })) },
              ]}
              table={<DT caption="ตัวเลขของกราฟ"><thead><tr><th>รัน</th><th className="ld-num">ทำนาย (°C)</th><th className="ld-num">อ่านได้ (°C)</th></tr></thead><tbody>{cats.map((r) => <tr key={r.id}><td data-label="รัน" className="cell-left">{r.id}</td><td data-label="ทำนาย" className="ld-num"><Val v={r.predicted.eta} kind="predicted" /></td><td data-label="อ่านได้" className="ld-num"><Val v={r.measuredTout} kind="observed" /></td></tr>)}</tbody></DT>} />
            <p className="cap">{runs.length} รัน ล่าสุด {runs[0] ? fmtDate(runs[0].dateISO) : 'ยังไม่มีค่า'}</p>
          </Panel>
        )}
        {tab === 'review' && (
          <Panel title="ทบทวน" actions={<Btn variant="quiet" onClick={() => go('/history')}>เปิดหน้าประวัติเต็ม</Btn>}>
            {run ? (
              <div className="stack-sm">
                <p className="h3">{run.id} · {STATUS_LABEL[run.status]}</p>
                {riskFlags(run).map((r, i) => <Notice key={i} kind={r.level === 'info' ? 'info' : 'warn'} title={r.text} />)}
              </div>
            ) : <p className="muted">ยังไม่มีรัน</p>}
            <EvidenceSummary />
          </Panel>
        )}
        {tab === 'backup' && (
          <Panel title="สำรอง/ใช้ต่อ">
            <dl className="kv">
              <dt>ร่างที่บันทึกอัตโนมัติล่าสุด</dt><dd>{savedAt ? fmtDateTime(savedAt) : <span className="muted">ยังไม่มีค่า</span>}</dd>
              <dt>ร่างที่รอกู้</dt><dd>{draft ? fmtDateTime(draft.savedAt) : <span className="muted">ไม่มี</span>}</dd>
              <dt>รันในประวัติ</dt><dd><span className="ld-num">{runs.length}</span></dd>
            </dl>
            <div className="row">
              <Btn icon="download" onClick={() => download('laong-runs.json', JSON.stringify(runs, null, 2), 'application/json')}>ส่งออกรันเป็น JSON</Btn>
              <Btn variant="primary" icon="play" onClick={() => go('/pre')}>ใช้ต่อจากหน้าก่อนทดลอง</Btn>
            </div>
          </Panel>
        )}
        {tab === 'target' && <TargetSearch />}
      </div>
    </div>
  );
}
