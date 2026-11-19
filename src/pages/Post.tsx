// ขั้น 3 หลังทดลอง: สมดุลมวล, สถานะจบรัน, ผลแล็บ, เช็กลิสต์ปิดรัน, สิทธิ์ใช้ข้อมูลฝึกโมเดล
import { useState } from 'react';
import { go } from '../app/router';
import { closeCurrentRun, updateCur, useAppState } from '../data/store';
import { CHECKLIST_ITEMS, labFromInputs, steadyInfo, elapsedMs } from '../lib/runs';
import { isBadNumber, parseNum } from '../lib/util';
import { Btn, Check, Chip, Metric, Notice, NumField, Panel, PageHead, Seg, Tabs } from '../ui/kit';
import type { LabInputs } from '../data/types';

const LAB: { key: keyof LabInputs; label: string; unit?: string; hint?: string; min: number; max: number }[] = [
  { key: 'moisture', label: 'ความชื้น', unit: '%', min: 0, max: 100 },
  { key: 'protein', label: 'โปรตีน', unit: '%', min: 0, max: 100 },
  { key: 'aw', label: 'aw', hint: '0 ถึง 1', min: 0, max: 1 },
  { key: 'solubility', label: 'การละลาย', unit: '%', min: 0, max: 100 },
  { key: 'L', label: 'สี L*', min: 0, max: 100 },
  { key: 'a', label: 'สี a*', min: -128, max: 128 },
  { key: 'b', label: 'สี b*', min: -128, max: 128 },
];

export default function Post() {
  const cur = useAppState((s) => s.cur);
  const [saved, setSaved] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const post = cur.post;

  const labErr = (k: keyof LabInputs): string | null => {
    const spec = LAB.find((l) => l.key === k)!;
    const t = post.lab[k];
    if (t.trim() === '') return null;
    if (isBadNumber(t)) return `${spec.label} ไม่ใช่ตัวเลข. ช่องนี้รับเฉพาะตัวเลข. ลบตัวอักษรออกแล้วกรอกใหม่.`;
    const n = parseNum(t) as number;
    if (n < spec.min || n > spec.max) return `${spec.label} อยู่นอกช่วง ${spec.min} ถึง ${spec.max}. ค่านอกช่วงเป็นไปไม่ได้. ตรวจใบแล็บแล้วกรอกใหม่.`;
    return null;
  };
  const labErrors = LAB.map((l) => labErr(l.key)).filter(Boolean);
  const feedErr = isBadNumber(post.feedMassG) ? 'มวลสารป้อนไม่ใช่ตัวเลข. ช่องนี้รับเฉพาะตัวเลข. กรอกใหม่.' : null;
  const powderErr = isBadNumber(post.powderG) ? 'มวลผงไม่ใช่ตัวเลข. ช่องนี้รับเฉพาะตัวเลข. กรอกใหม่.' : null;

  const feedG = parseNum(post.feedMassG);
  const powderG = parseNum(post.powderG);
  const lab = labFromInputs(post.lab);
  const ts = cur.predicted?.solidsFrac ?? null;
  // สมดุลมวลแบบง่ายสำหรับต้นแบบ: ของแข็งเข้า เทียบกับของแข็งในผงที่เก็บได้ (รอยืนยันกับ run-protocol.js)
  const solidsIn = feedG !== null && ts !== null ? feedG * ts : null;
  const solidsOut = powderG !== null && lab.moisture !== null ? powderG * (1 - lab.moisture / 100) : null;
  const recovery = solidsIn !== null && solidsOut !== null && solidsIn > 0 ? (solidsOut / solidsIn) * 100 : null;
  const st = steadyInfo(cur.points);
  const durMin = elapsedMs(cur.timer) / 60000;

  const setPost = (fn: (p: typeof post) => void) => updateCur((c) => { fn(c.post); });
  const unchecked = CHECKLIST_ITEMS.filter((c) => !post.checklist[c.key]);

  const saveLab = () => {
    setShowErr(true);
    if (labErrors.length || feedErr || powderErr) return;
    updateCur((c) => { c.done[3] = true; });
    setSaved(true);
  };
  const close = () => {
    setShowErr(true);
    if (!post.status || labErrors.length || feedErr || powderErr) return;
    closeCurrentRun();
    go('/history');
  };

  const [tab, setTab] = useState<'lab' | 'mass'>('lab');
  const checkedN = CHECKLIST_ITEMS.filter((c) => post.checklist[c.key]).length;
  const consentLabel = post.consent === 'yes' ? 'อนุญาต' : post.consent === 'no' ? 'ไม่อนุญาต' : 'ยังไม่ตัดสินใจ';

  return (
    <div className="page">
      <PageHead title="หลังทดลอง" lead="กรอกผลแล็บเท่าที่มี แล้วปิดรัน ช่องที่ยังไม่มีผลเว้นว่างได้ ระบบแสดงเป็น ยังไม่มีค่า" />
      {cur.points.length === 0 && !cur.done[2] ? <Notice kind="info" title="รันนี้ยังไม่มีค่าที่จด">ปิดรันได้ แต่รายงานจะไม่มี Tout ที่อ่านได้</Notice> : null}

      <div className="grid-main">
        <Panel title="ผลหลังรัน" actions={saved ? <Chip kind="validated" extra="บันทึกแล้ว" /> : null}>
          <Tabs<'lab' | 'mass'> label="ผลหลังรัน" value={tab} onChange={setTab} tabs={[{ key: 'lab', label: 'ผลแล็บ' }, { key: 'mass', label: 'สมดุลมวล' }]} />
          <div className="tabpanel" key={tab} role="tabpanel" aria-labelledby={`pt-${tab}`}>
            {tab === 'lab' ? (
              <>
                <div className="form-grid form-grid--2">
                  {LAB.map((l) => (
                    <NumField key={l.key} id={`lab-${l.key}`} label={l.label} unit={l.unit} hint={l.hint} value={post.lab[l.key]}
                      onChange={(v) => { setSaved(false); setPost((p) => { p.lab[l.key] = v; }); }} chip={<Chip kind="measured" />} error={showErr ? labErr(l.key) : null} />
                  ))}
                </div>
                {showErr && (labErrors.length || feedErr || powderErr) ? <Notice kind="danger" title="บันทึกยังไม่ได้">แก้ช่องที่มีข้อความสีแดง แล้วกดบันทึกอีกครั้ง</Notice> : null}
                <Btn variant="primary" icon="save" onClick={saveLab}>บันทึกผลแล็บ</Btn>
                <p className="cap">เว้นช่องที่ยังไม่มีผลไว้ได้ กลับมากรอกทีหลังได้จากหน้าประวัติ</p>
              </>
            ) : (
              <>
                <div className="form-grid form-grid--2">
                  <NumField id="feedg" label="มวลสารป้อนทั้งหมด" unit="g" value={post.feedMassG} onChange={(v) => setPost((p) => { p.feedMassG = v; })} chip={<Chip kind="measured" />} error={showErr ? feedErr : null} />
                  <NumField id="powderg" label="มวลผงที่เก็บได้" unit="g" value={post.powderG} onChange={(v) => setPost((p) => { p.powderG = v; })} chip={<Chip kind="measured" />} error={showErr ? powderErr : null} />
                </div>
                <div className="result-grid">
                  <Metric label="ของแข็งที่ป้อน" value={solidsIn} unit="g" kind="calculated" hint={ts === null ? 'ต้องประเมิน Tout ก่อนเพื่อให้มี TS' : feedG === null ? 'กรอกมวลสารป้อน' : undefined} />
                  <Metric label="ของแข็งในผงที่เก็บได้" value={solidsOut} unit="g" kind="calculated" hint={solidsOut === null ? 'ต้องมีมวลผงและความชื้นจากแล็บ' : undefined} />
                  <Metric label="เก็บผงได้คิดเป็น" value={recovery} unit="%" kind="calculated" />
                </div>
                <p className="cap">สูตรสมดุลมวลในต้นแบบเป็นแบบง่าย รอเทียบกับ run-protocol.js ของแอปเดิม ช่องที่ขาดข้อมูลแสดงเป็น ยังไม่มีค่า ไม่ใช่ 0</p>
              </>
            )}
          </div>
        </Panel>

        <div className="stack">
          <Panel title="สรุปรันนี้">
            <div className="result-grid">
              <Metric label="เวลาจับเวลารวม" value={cur.timer.status === 'idle' ? null : Math.round(durMin * 10) / 10} unit="นาที" kind="measured" />
              <Metric label="Tout เฉลี่ยช่วงนิ่ง" value={st.mean} unit="°C" kind="calculated" hint={st.mean === null ? 'ต้องมี Tout อย่างน้อย 3 ค่า' : st.reached ? 'ถึง steady state ตามเกณฑ์ตัวอย่าง' : 'ยังไม่ถึง steady state'} />
              <Metric label="Tout ที่ทำนาย" value={cur.predicted?.prediction.eta?.tout ?? null} unit="°C" kind="predicted" />
            </div>
          </Panel>

          <Panel title="ปิดรัน">
            <Seg legend="รันนี้จบแบบไหน" name="status" value={post.status} onChange={(v) => setPost((p) => { p.status = v; })}
              options={[{ value: 'success', label: 'สำเร็จ' }, { value: 'partial', label: 'จบก่อนกำหนด' }, { value: 'failed', label: 'ไม่สำเร็จ' }]} />
            {showErr && !post.status ? <span className="ld-error" role="alert">ยังไม่ได้เลือกสถานะจบรัน. รายงานต้องรู้ว่ารันจบแบบไหน. เลือกหนึ่งข้อด้านบน.</span> : null}
            <div className="inline-list">
              <details className="inline-details">
                <summary><span>เช็กลิสต์ปิดรัน</span><span className="cap">{checkedN} จาก {CHECKLIST_ITEMS.length}</span></summary>
                <div className="inline-details__body">
                  {CHECKLIST_ITEMS.map((c) => (
                    <Check key={c.key} id={`cl-${c.key}`} checked={!!post.checklist[c.key]} onChange={(v) => setPost((p) => { p.checklist[c.key] = v; })}>{c.label}</Check>
                  ))}
                  {unchecked.length ? <p className="cap">ปิดรันได้แม้ยังไม่ติ๊กครบ ระบบจะบันทึกรายการที่ยังไม่ติ๊กไว้ในรัน</p> : null}
                </div>
              </details>
              <details className="inline-details">
                <summary><span>สิทธิ์ใช้ข้อมูลฝึกโมเดล</span><span className="cap">{consentLabel}</span></summary>
                <div className="inline-details__body">
                  <Seg legend="อนุญาตให้ใช้ข้อมูลรันนี้ฝึกโมเดลหรือไม่" name="consent" value={post.consent} onChange={(v) => setPost((p) => { p.consent = v; })}
                    options={[{ value: 'undecided', label: 'ยังไม่ตัดสินใจ', sub: 'ไม่ใช้ฝึก' }, { value: 'yes', label: 'อนุญาต' }, { value: 'no', label: 'ไม่อนุญาต' }]} />
                </div>
              </details>
            </div>
            <Btn variant="primary" icon="check" block onClick={close}>ปิดรันและไปดูประวัติ</Btn>
          </Panel>
        </div>
      </div>
    </div>
  );
}
