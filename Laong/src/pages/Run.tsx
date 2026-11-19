// ขั้น 2 ระหว่างทดลอง: จับเวลา, จดจุด Tin/Tout, ตรวจ steady state, เหตุการณ์ผิดปกติ, ตารางรายนาที
import { useEffect, useRef, useState } from 'react';
import { go } from '../app/router';
import { markOnboarding, updateCur, useAppState } from '../data/store';
import { EVENT_LABELS, SEGMENT_LABELS, elapsedMs, feedRateFromTest, steadyInfo } from '../lib/runs';
import { mmss, parseNum, uid, isBadNumber } from '../lib/util';
import { READ_BAND_C, STEADY } from '../config/synthetic';
import { Btn, Chip, DT, Metric, MissingText, Notice, NumField, Panel, PageHead, SelectField, Tabs, TextField, useNow } from '../ui/kit';
import { PointsChart } from '../ui/charts';
import type { Cur, Point } from '../data/types';
import { CAM_LABEL, LINK_LABEL, device, useDevice } from '../device/link';
import { openDrawer } from '../data/ui';

type Tool = 'table' | 'events' | 'late' | 'feed';

export default function RunPage() {
  const cur = useAppState((s) => s.cur);
  const dev = useDevice();
  const running = cur.timer.status === 'running';
  const now = useNow(running);
  const ms = elapsedMs(cur.timer, now);
  const nowMin = Math.round((ms / 60000) * 10) / 10;

  const [f, setF] = useState({ tin: '', tout: '', pump: '' });
  const [err, setErr] = useState<string | null>(null);
  const [retro, setRetro] = useState({ min: '', tin: '', tout: '', pump: '' });
  const [retroErr, setRetroErr] = useState<string | null>(null);
  const [q3, setQ3] = useState({ tin: '', a: '', b: '', c: '' });
  const [q3Err, setQ3Err] = useState<string | null>(null);
  const [ev, setEv] = useState({ label: EVENT_LABELS[0], note: '' });
  const [tool, setTool] = useState<Tool>('table');
  const toutRef = useRef<HTMLInputElement>(null);

  // ทางลัดคีย์บอร์ด: Alt+N ไปช่อง Tout ของแบบฟอร์มจดจุด
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); toutRef.current?.focus(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const closeSeg = (c: Cur, atMin: number) => {
    const last = c.segments[c.segments.length - 1];
    if (last && last.endMin === null) last.endMin = atMin;
  };
  const startSeg = (c: Cur, label: string, atMin: number) => {
    closeSeg(c, atMin);
    c.segments.push({ id: uid('SEG'), label, startMin: atMin, endMin: null });
    c.segmentLabel = label;
  };

  const start = () => updateCur((c) => {
    c.timer = { status: 'running', startedAt: Date.now(), accMs: 0 };
    c.startedISO = c.startedISO ?? new Date().toISOString();
    c.done[2] = true;
    startSeg(c, c.segmentLabel, 0);
  });
  const startWithCam = () => { start(); device.camStart(cur.id); };
  const pause = () => updateCur((c) => { c.timer = { status: 'paused', startedAt: null, accMs: elapsedMs(c.timer) }; });
  const resume = () => updateCur((c) => { c.timer = { status: 'running', startedAt: Date.now(), accMs: c.timer.accMs }; });
  const stopWithCam = () => { stop(); device.camStop(); };
  const stop = () => updateCur((c) => {
    const acc = elapsedMs(c.timer);
    c.timer = { status: 'stopped', startedAt: null, accMs: acc };
    closeSeg(c, Math.round((acc / 60000) * 10) / 10);
  });
  const nextSeg = (label: string) => updateCur((c) => startSeg(c, label, Math.round((elapsedMs(c.timer) / 60000) * 10) / 10));

  const addPoint = (o: { tMin: number; tin: string; tout: string; pump: string; how: Point['how'] }, setError: (s: string | null) => void): boolean => {
    const tin = parseNum(o.tin), tout = parseNum(o.tout), pump = parseNum(o.pump);
    if ([o.tin, o.tout, o.pump].some((t) => isBadNumber(t))) { setError('มีช่องที่ไม่ใช่ตัวเลข. ช่องนี้รับเฉพาะตัวเลข. ลบตัวอักษรออกแล้วกรอกใหม่.'); return false; }
    if (tin === null && tout === null && pump === null) { setError('ยังไม่มีค่าที่จะจด. ต้องมีอย่างน้อยหนึ่งค่า. กรอก Tin, Tout หรือ Pump แล้วกด Enter.'); return false; }
    if (tin !== null && tout !== null && tout >= tin) { setError('Tout ต้องต่ำกว่า Tin. ลมออกเย็นกว่าลมเข้าเสมอ. ตรวจค่าที่อ่านจากหน้าจอเครื่องแล้วกรอกใหม่.'); return false; }
    if (pump !== null && (pump < 0 || pump > 100)) { setError('Pump ต้องอยู่ระหว่าง 0 ถึง 100 %. เป็นเปอร์เซ็นต์ของปั๊ม. ตรวจค่าแล้วกรอกใหม่.'); return false; }
    setError(null);
    updateCur((c) => { c.points.push({ id: uid('P'), tMin: o.tMin, tin, tout, pump, how: o.how }); c.done[2] = true; });
    markOnboarding('timer');
    return true;
  };

  const submitLive = () => {
    if (addPoint({ tMin: nowMin, ...f, how: 'live' }, setErr)) { setF({ tin: f.tin, tout: '', pump: f.pump }); toutRef.current?.focus(); }
  };
  const submitRetro = () => {
    const m = parseNum(retro.min);
    if (m === null || m < 0) { setRetroErr('ยังไม่มีนาทีที่จะจด. ต้องรู้ว่าค่านี้อ่านตอนนาทีที่เท่าไร. กรอกนาทีเป็นตัวเลข 0 ขึ้นไป.'); return; }
    if (addPoint({ tMin: m, tin: retro.tin, tout: retro.tout, pump: retro.pump, how: 'retro' }, setRetroErr)) setRetro({ min: '', tin: '', tout: '', pump: '' });
  };
  const submitQ3 = () => {
    const vals = [q3.a, q3.b, q3.c];
    if (vals.some((v) => parseNum(v) === null)) { setQ3Err('ต้องมี Tout ครบ 3 ค่า. เกณฑ์ steady state ดูจาก 3 ค่าล่าสุด. กรอกให้ครบทั้งสามช่อง.'); return; }
    const base = Math.max(2, nowMin);
    const ok = vals.every((v, i) => addPoint({ tMin: Math.round((base - (2 - i)) * 10) / 10, tin: q3.tin, tout: v, pump: '', how: 'steady3' }, setQ3Err));
    if (ok) { setQ3({ tin: q3.tin, a: '', b: '', c: '' }); setQ3Err(null); }
  };

  const st = steadyInfo(cur.points);
  const pred = cur.predicted?.prediction.eta?.tout ?? null;
  const obsMean = st.mean;
  const errNow = obsMean !== null && pred !== null ? obsMean - pred : null;
  const sorted = [...cur.points].sort((a, b) => a.tMin - b.tMin);
  const feedEst = feedRateFromTest(parseNum(cur.feedTest.vol), parseNum(cur.feedTest.sec));
  const lastSeg = cur.segments[cur.segments.length - 1];

  return (
    <div className="page">
      <PageHead title="ระหว่างทดลอง" lead="กดเริ่มเมื่อเริ่มป้อนสาร แล้วจดค่า Tin กับ Tout จากหน้าจอเครื่องเป็นช่วง ๆ" />
      {!cur.done[1] ? (
        <div className="strip"><span>ยังไม่ได้ประเมิน Tout ก่อนรัน จับเวลาและจดค่าต่อได้เลย</span><Btn variant="quiet" onClick={() => go('/pre')}>ไปประเมิน</Btn></div>
      ) : null}

      <div className="grid-main">
        <div className="stack">
          <Panel title="จับเวลา" actions={<span className="timer__state" data-status={cur.timer.status}><span className="timer__dot" aria-hidden="true" />{cur.timer.status === 'idle' ? 'ยังไม่เริ่ม' : cur.timer.status === 'running' ? 'กำลังเดิน' : cur.timer.status === 'paused' ? 'พักอยู่' : 'จบแล้ว'}</span>}>
            <div className="timer-card">
              <div className="timer" data-status={cur.timer.status} role="timer" aria-label={`เวลาที่ผ่านไป ${mmss(ms)}`}>{mmss(ms)}</div>
              <div className="ctl-row">
                {cur.timer.status === 'idle' ? <Btn variant="primary" icon="play" onClick={startWithCam}>เริ่มจับเวลา</Btn> : null}
                {cur.timer.status === 'running' ? <Btn icon="pause" onClick={pause}>พัก</Btn> : null}
                {cur.timer.status === 'paused' ? <Btn variant="primary" icon="play" onClick={resume}>เดินต่อ</Btn> : null}
                {cur.timer.status === 'running' || cur.timer.status === 'paused' ? <Btn variant="danger" icon="stop" onClick={stopWithCam}>จบการจับเวลา</Btn> : null}
                {cur.timer.status === 'stopped' ? <Btn icon="refresh" onClick={() => updateCur((c) => { c.timer = { status: 'paused', startedAt: null, accMs: c.timer.accMs }; })}>เปิดจับเวลาต่อ</Btn> : null}
              </div>
              {dev.enabled ? (
                <button type="button" className="camrow" onClick={() => openDrawer('board')}>
                  <span className="dot" data-s={dev.state} aria-hidden="true" />
                  บอร์ด {LINK_LABEL[dev.state]}{dev.cam ? ` · ${CAM_LABEL[dev.cam]}` : ''}{dev.camWithTimer ? ' · กล้องทำงานพร้อมตัวจับเวลา' : ''}
                </button>
              ) : null}
              <div className="stack-sm">
                {cur.segments.length ? (
                <ul className="seglist" aria-label="ช่วงของรัน">
                  {cur.segments.map((s) => (
                    <li key={s.id} data-on={s.endMin === null ? 'true' : undefined}>{s.label}<span className="ld-num cap">{s.startMin.toFixed(1)}{s.endMin === null ? ' ถึงตอนนี้' : ` ถึง ${s.endMin.toFixed(1)}`}</span></li>
                  ))}
                </ul>
              ) : null}
                <div className="row row--nowrap">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SelectField id="seg" label="เริ่มช่วงถัดไป" value={cur.segmentLabel} onChange={(v) => updateCur((c) => { c.segmentLabel = v; })} options={SEGMENT_LABELS.map((s) => ({ value: s, label: s }))} />
                  </div>
                  <Btn icon="plus" disabled={cur.timer.status !== 'running' || (lastSeg?.label === cur.segmentLabel && lastSeg?.endMin === null)} onClick={() => nextSeg(cur.segmentLabel)} style={{ alignSelf: 'flex-end' }}>เริ่ม</Btn>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="จดค่า" actions={<span className="row"><Chip kind="observed" /><span className="cap">นาทีที่ <span className="ld-num">{nowMin.toFixed(1)}</span></span></span>}>
            <div className="pointform">
              <NumField id="p-tin" label="Tin" unit="°C" value={f.tin} onChange={(v) => setF({ ...f, tin: v })} onEnter={submitLive} />
              <NumField id="p-tout" label="Tout" unit="°C" value={f.tout} onChange={(v) => setF({ ...f, tout: v })} onEnter={submitLive} inputRef={toutRef} />
              <NumField id="p-pump" label="Pump" unit="%" value={f.pump} onChange={(v) => setF({ ...f, pump: v })} onEnter={submitLive} />
            </div>
            {err ? <span className="ld-error" role="alert">{err}</span> : <span className="cap only-wide-block">กด <span className="kbd">Enter</span> เพื่อจดจุด Tin และ Pump คงค่าเดิมไว้ให้ <span className="kbd">Alt</span> + <span className="kbd">N</span> กลับไปช่อง Tout</span>}
            <Btn variant="primary" icon="plus" block onClick={submitLive}>จดจุดนี้</Btn>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="ถึง steady state หรือยัง">
            {st.count < STEADY.windowSize ? (
              <Notice kind="info" title="ยังไม่พอตัดสิน">ต้องมี Tout อย่างน้อย {STEADY.windowSize} ค่า ตอนนี้มี {st.count} ค่า</Notice>
            ) : st.reached ? (
              <Notice kind="ok" title="นิ่งแล้ว">Tout {STEADY.windowSize} ค่าล่าสุดห่างกันไม่เกินเกณฑ์ตัวอย่าง (รอยืนยันกับ run-protocol.js) ใช้ค่าเฉลี่ยเป็น Tout ของรันได้</Notice>
            ) : (
              <Notice kind="warn" title="ยังไม่นิ่ง">Tout {STEADY.windowSize} ค่าล่าสุดยังห่างกันมากกว่าเกณฑ์ตัวอย่าง รอให้ค่าคงที่แล้วจดเพิ่ม</Notice>
            )}
            <div className="result-grid">
              <Metric label="Tout เฉลี่ย 3 ค่าล่าสุด" value={obsMean} unit="°C" kind="calculated" />
              <Metric label="ช่วงห่างของ 3 ค่า" value={st.spread} unit="°C" kind="calculated" />
              <Metric label="Tout ที่ทำนายไว้" value={pred} unit="°C" kind="predicted" hint={pred === null ? 'ยังไม่ได้ประเมินก่อนรัน' : undefined} />
              <Metric label="ผลต่างจากที่ทำนาย" value={errNow} unit="°C" kind="calculated" hint={errNow === null ? 'ยังไม่มีค่า' : `แนวอ่านผลราว ${READ_BAND_C} °C`} />
            </div>
            {pred !== null ? <p className="cap">ค่าที่ทำนายยัง UNVALIDATED ใช้เทียบเพื่อดูแนวโน้ม ไม่ใช่ค่าที่ต้องทำให้ได้</p> : null}
          </Panel>

          <Panel title="Tin และ Tout ตามเวลา">
            <PointsChart
              title="ค่าที่จดจากหน้าจอเครื่อง"
              yLabel="อุณหภูมิ (°C)"
              height={240}
              area
              band={pred !== null ? { from: pred - READ_BAND_C, to: pred + READ_BAND_C, label: 'แนวอ่านผลรอบค่าที่ทำนาย' } : null}
              series={[
                { id: 'tout', label: 'Tout', kind: 'observed', marker: 'circle', points: sorted.map((p) => ({ x: p.tMin, y: p.tout })) },
                { id: 'tin', label: 'Tin', kind: 'observed', marker: 'square', dashed: true, points: sorted.map((p) => ({ x: p.tMin, y: p.tin })) },
              ]}
              emptyText="จดจุดแรกแล้วกราฟจะขึ้นที่นี่"
              table={<p className="cap">ตัวเลขทั้งหมดอยู่ในแท็บตารางด้านล่าง</p>}
              tableSummary="ดูตัวเลข"
            />
          </Panel>
        </div>
      </div>

      <Panel title="เครื่องมือเสริม">
        <Tabs<Tool> label="เครื่องมือเสริมระหว่างทดลอง" value={tool} onChange={setTool}
          tabs={[{ key: 'table', label: 'ตาราง', badge: String(sorted.length) }, { key: 'events', label: 'เหตุการณ์', badge: cur.events.length ? String(cur.events.length) : undefined }, { key: 'late', label: 'ย้อนหลัง' }, { key: 'feed', label: 'อัตราป้อน' }]} />
        <div className="tabpanel" key={tool} role="tabpanel" aria-labelledby={`pt-${tool}`}>
          {tool === 'table' ? (
            sorted.length ? (
              <DT caption="ค่าที่จดระหว่างรัน">
                <thead><tr><th className="ld-num">นาที</th><th className="ld-num">Tin (°C) <Chip kind="observed" /></th><th className="ld-num">Tout (°C) <Chip kind="observed" /></th><th className="ld-num">Pump (%) <Chip kind="observed" /></th><th>วิธีจด</th><th><span className="sr-only">ลบ</span></th></tr></thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id}>
                      <td data-label="นาที" className="ld-num">{p.tMin.toFixed(1)}</td>
                      <td data-label="Tin (Observed)" className="ld-num">{p.tin === null ? <MissingText /> : p.tin.toFixed(1)}</td>
                      <td data-label="Tout (Observed)" className="ld-num">{p.tout === null ? <MissingText /> : p.tout.toFixed(1)}</td>
                      <td data-label="Pump (Observed)" className="ld-num hide-narrow">{p.pump === null ? <MissingText /> : p.pump.toFixed(0)}</td>
                      <td data-label="วิธีจด" className="cell-left hide-narrow">{p.how === 'live' ? 'จดสด' : p.how === 'retro' ? 'กรอกย้อนหลัง' : 'ช่วงนิ่ง 3 ค่า'}</td>
                      <td data-label="ลบ"><Btn variant="quiet" icon="trash" aria-label={`ลบจุดนาทีที่ ${p.tMin.toFixed(1)}`} onClick={() => updateCur((c) => { c.points = c.points.filter((x) => x.id !== p.id); })} /></td>
                    </tr>
                  ))}
                </tbody>
              </DT>
            ) : <p className="muted">ยังไม่มีจุดที่จด ช่องที่ไม่ได้จดจะแสดงเป็น ยังไม่มีค่า ไม่ใช่ 0</p>
          ) : null}

          {tool === 'events' ? (
            <>
              <div className="row">
                <Btn icon="pause" onClick={() => updateCur((c) => { c.events.push({ id: uid('E'), tMin: nowMin, label: 'หยุดป้อนชั่วคราว', note: '', ts: new Date().toISOString() }); })}>หยุดป้อน</Btn>
                <Btn icon="play" onClick={() => updateCur((c) => { c.events.push({ id: uid('E'), tMin: nowMin, label: 'ป้อนต่อ', note: '', ts: new Date().toISOString() }); })}>ป้อนต่อ</Btn>
              </div>
              <div className="form-grid">
                <SelectField id="ev-l" label="เหตุการณ์ผิดปกติ" value={ev.label} onChange={(v) => setEv({ ...ev, label: v })} options={EVENT_LABELS.map((e) => ({ value: e, label: e }))} />
                <TextField id="ev-n" label="หมายเหตุ (ไม่บังคับ)" value={ev.note} onChange={(v) => setEv({ ...ev, note: v })} />
              </div>
              <div><Btn icon="alert" onClick={() => { updateCur((c) => { c.events.push({ id: uid('E'), tMin: nowMin, label: ev.label, note: ev.note.trim(), ts: new Date().toISOString() }); }); setEv({ ...ev, note: '' }); }}>จดเหตุการณ์</Btn></div>
              {cur.events.length ? (
                <ul className="todo">
                  {cur.events.map((e) => (
                    <li key={e.id}><span className="todo__t"><strong>{e.label}</strong> <span className="muted">นาทีที่ <span className="ld-num">{e.tMin.toFixed(1)}</span>{e.note ? ` · ${e.note}` : ''}</span></span>
                      <Btn variant="quiet" icon="trash" aria-label={`ลบเหตุการณ์ ${e.label}`} onClick={() => updateCur((c) => { c.events = c.events.filter((x) => x.id !== e.id); })} /></li>
                  ))}
                </ul>
              ) : <p className="cap">ยังไม่มีเหตุการณ์ผิดปกติ</p>}
            </>
          ) : null}

          {tool === 'late' ? (
            <>
              <div className="stack-sm">
                <h3 className="h3">กรอกย้อนหลัง</h3>
                <p className="muted small">ลืมจดตอนนั้น ใส่นาทีที่อ่านค่าเอง จะเรียงเข้าตารางให้</p>
              </div>
              <div className="pointform pointform--4">
                <NumField id="r-min" label="นาทีที่" value={retro.min} onChange={(v) => setRetro({ ...retro, min: v })} />
                <NumField id="r-tin" label="Tin" unit="°C" value={retro.tin} onChange={(v) => setRetro({ ...retro, tin: v })} chip={<Chip kind="observed" />} />
                <NumField id="r-tout" label="Tout" unit="°C" value={retro.tout} onChange={(v) => setRetro({ ...retro, tout: v })} chip={<Chip kind="observed" />} />
                <NumField id="r-pump" label="Pump" unit="%" value={retro.pump} onChange={(v) => setRetro({ ...retro, pump: v })} onEnter={submitRetro} chip={<Chip kind="observed" />} />
              </div>
              {retroErr ? <span className="ld-error" role="alert">{retroErr}</span> : null}
              <div><Btn icon="plus" onClick={submitRetro}>เพิ่มจุดย้อนหลัง</Btn></div>
              <hr className="divider" />
              <div className="stack-sm">
                <h3 className="h3">Tout ช่วงนิ่ง 3 ค่าแบบเร็ว</h3>
                <p className="muted small">อ่านค่าที่นิ่งแล้ว 3 ครั้ง กรอกรวดเดียว</p>
              </div>
              <div className="pointform pointform--4">
                <NumField id="q3-tin" label="Tin" unit="°C" value={q3.tin} onChange={(v) => setQ3({ ...q3, tin: v })} chip={<Chip kind="observed" />} />
                <NumField id="q3-a" label="Tout 1" unit="°C" value={q3.a} onChange={(v) => setQ3({ ...q3, a: v })} chip={<Chip kind="observed" />} />
                <NumField id="q3-b" label="Tout 2" unit="°C" value={q3.b} onChange={(v) => setQ3({ ...q3, b: v })} chip={<Chip kind="observed" />} />
                <NumField id="q3-c" label="Tout 3" unit="°C" value={q3.c} onChange={(v) => setQ3({ ...q3, c: v })} onEnter={submitQ3} chip={<Chip kind="observed" />} />
              </div>
              {q3Err ? <span className="ld-error" role="alert">{q3Err}</span> : null}
              <div><Btn icon="plus" onClick={submitQ3}>เพิ่มทั้ง 3 ค่า</Btn></div>
            </>
          ) : null}

          {tool === 'feed' ? (
            <>
              <p className="muted small">ตวงสารที่ป้อนในช่วงเวลาหนึ่ง แล้วดูว่าอัตราจริงตรงกับที่ตั้งไว้หรือไม่</p>
              <div className="form-grid form-grid--2">
                <NumField id="ft-v" label="ปริมาตรที่ตวงได้" unit="mL" value={cur.feedTest.vol} onChange={(v) => updateCur((c) => { c.feedTest.vol = v; })} chip={<Chip kind="measured" />} />
                <NumField id="ft-s" label="เวลาที่ใช้ตวง" unit="วินาที" value={cur.feedTest.sec} onChange={(v) => updateCur((c) => { c.feedTest.sec = v; })} chip={<Chip kind="measured" />} />
              </div>
              <div className="result-grid">
                <Metric label="อัตราป้อนจริง" value={feedEst} unit="mL/min" kind="calculated" hint={feedEst === null ? 'กรอกปริมาตรและเวลาให้ครบ' : undefined} />
                <Metric label="อัตราป้อนที่ใช้ทำนาย" value={cur.predicted?.feedMlMin ?? null} unit="mL/min" kind={cur.predicted?.feedKind ?? 'assumed'} />
              </div>
              <p className="cap">Pump % ไม่ใช่อัตราป้อนจริง ใช้ค่าที่ตวงได้ตรวจสอบ Proxy เสมอ</p>
            </>
          ) : null}
        </div>
      </Panel>

      {cur.timer.status !== 'idle' ? (
        <div className="sticky-act row no-print">
          <Btn variant="primary" icon="clipboard" onClick={() => go('/post')}>ไปหน้าหลังทดลอง</Btn>
          <span className="cap">ไม่ต้องรอจบการจับเวลา ไปกรอกผลแล็บทีหลังได้</span>
        </div>
      ) : null}
    </div>
  );
}
