// ขั้น 1 ก่อนทดลอง: กรอก Tin, อัตราป้อน, TS, วัสดุ แล้วประเมิน Tout (เรียกสูตรผ่าน adapter เท่านั้น)
import { useMemo, useRef, useState } from 'react';
import { go } from '../app/router';
import { computeTg, predictTout, T_FLOOR } from '../core/adapter';
import { DEFAULT_STICKY_OFFSET_C, INPUT_LIMITS, SAMPLE_MATERIALS, READ_BAND_C } from '../config/synthetic';
import { markOnboarding, setState, updateCur, useAppState, useProfile } from '../data/store';
import type { Plan, PreInputs } from '../data/types';
import { derivePre, errFor, materialOf } from '../lib/prep';
import { download, toCsv } from '../lib/export';
import { mulberry32, parseNum } from '../lib/util';
import { Btn, Check, Chip, CountUp, DT, Metric, Notice, NumField, Panel, PageHead, Seg, SelectField, Tabs, UnvalidatedBar, Val } from '../ui/kit';
import { SprayField } from '../ui/droplets';

const PRE_CHECKS = [
  { key: 'clean', label: 'เครื่องและท่อป้อนสะอาด แห้งแล้ว' },
  { key: 'filter', label: 'กรองสารป้อนแล้ว ไม่มีก้อนตะกอน' },
  { key: 'scale', label: 'เตรียมเครื่องชั่งและภาชนะรับผงแล้ว' },
  { key: 'plan', label: 'ตรวจ Tin ที่จะตั้งกับขอบเขตของเครื่องแล้ว' },
];

function useLastRunFill() {
  const runs = useAppState((s) => s.runs);
  return () => {
    const r = runs.find((x) => x.inputs.tin !== null);
    if (!r) return;
    updateCur((c) => {
      c.pre.materialId = r.materialId;
      c.pre.tin = String(r.inputs.tin ?? '');
      c.pre.feedMode = 'ml';
      c.pre.feedMl = r.inputs.feedMlMin === null ? '' : String(r.inputs.feedMlMin);
      c.pre.tsSource = r.inputs.solidsKind === 'proxy' ? 'measured' : r.inputs.solidsKind;
      c.pre.ts = r.inputs.solidsFrac === null ? '' : String(Math.round(r.inputs.solidsFrac * 1000) / 10);
      const m = materialOf(r.materialId);
      c.pre.md = String(m.defaultMd);
    });
    return r.id;
  };
}

type Tool = 'tg' | 'how' | 'checks' | 'doe';

export default function Pre() {
  const cur = useAppState((s) => s.cur);
  const profile = useProfile();
  const [showErr, setShowErr] = useState(false);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('tg');
  const resultRef = useRef<HTMLDivElement>(null);
  const fill = useLastRunFill();

  const d = useMemo(() => derivePre(cur.pre, profile), [cur.pre, profile]);
  const set = (p: Partial<PreInputs>) => updateCur((c) => { Object.assign(c.pre, p); });
  const snap = cur.predicted;
  const stale = !!snap && snap.inputsKey !== d.key;
  const showErrors = showErr && d.errors.length > 0;
  const E = (f: string) => (showErrors ? errFor(d.errors, f) : null);

  const tg = useMemo(() => computeTg(d.material, parseNum(cur.pre.md) === null ? null : (parseNum(cur.pre.md) as number) / 100, parseNum(cur.pre.moisture) === null ? null : (parseNum(cur.pre.moisture) as number) / 100, parseNum(cur.pre.k)), [d.material, cur.pre.md, cur.pre.moisture, cur.pre.k]);
  const offset = parseNum(cur.pre.stickyOffset);
  const sticky = tg.ok && offset !== null ? tg.bands.mid + offset : null;

  const evaluate = () => {
    setShowErr(true);
    if (d.errors.length) return;
    const out = predictTout(d.input);
    if (!out.ok) return;
    updateCur((c) => {
      c.predicted = {
        at: new Date().toISOString(), inputsKey: d.key, profileId: profile.id, tin: d.tin as number, feedMlMin: d.feedMlMin as number,
        feedKind: d.feedKind, solidsFrac: d.solidsFrac as number, solidsKind: d.solidsKind, prediction: out.prediction,
      };
      c.done[1] = true;
      c.startedISO = c.startedISO ?? new Date().toISOString();
    });
    markOnboarding('predict');
    // จอแคบ: เลื่อนไปที่ผลทันที ไม่ต้องไล่ลงหาเอง
    if (window.innerWidth < 1000) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }), 60);
    }
  };

  const eta = snap?.prediction.eta;
  const ua = snap?.prediction.ua;
  const tOut = eta?.tout ?? null;
  const towardSticky = tOut !== null && sticky !== null ? (tOut > sticky ? 'above' : tg.ok && tOut > tg.bands.lo ? 'mid' : 'below') : null;

  return (
    <div className="page">
      <PageHead title="ก่อนทดลอง" lead="กรอก 4 ค่า แล้วกดประเมิน Tout เพื่อดูว่าคาดว่าจะได้เท่าไรก่อนเริ่มรัน" />

      <div className="grid-main">
        <Panel title="ค่าที่ต้องกรอก" actions={<Btn variant="quiet" icon="refresh" onClick={() => setFilledFrom(fill() ?? null)}>เติมจากรันล่าสุด</Btn>}>
          {filledFrom ? <p className="cap">เติมค่าจากรัน {filledFrom} แล้ว แก้ได้ทุกช่อง ค่าที่เติมมาเป็นค่าที่ตั้งไว้ในรันนั้น ไม่ใช่ค่าที่วัดใหม่</p> : null}
          <SelectField id="material" label="วัสดุ" value={cur.pre.materialId} onChange={(v) => { const m = materialOf(v); set({ materialId: v, md: String(m.defaultMd) }); }}
            options={SAMPLE_MATERIALS.map((m) => ({ value: m.id, label: m.name }))} />
          <div className="form-grid form-grid--2">
            <NumField id="tin" label="Tin" unit="°C" value={cur.pre.tin} onChange={(v) => set({ tin: v })} error={E('tin')} chip={<Chip kind="assumed" />}
              hint={`ที่จะตั้ง ช่วง ${INPUT_LIMITS.tinMin} ถึง ${INPUT_LIMITS.tinMax}`} />
            {cur.pre.feedMode === 'ml' ? (
              <NumField id="feed" label="อัตราป้อน" unit="mL/min" value={cur.pre.feedMl} onChange={(v) => set({ feedMl: v })} error={E('feed')} chip={<Chip kind="assumed" />} />
            ) : (
              <NumField id="pump" label="Pump" unit="%" value={cur.pre.pump} onChange={(v) => set({ pump: v })} error={E('feed')} chip={<Chip kind="proxy" extra="Pump %" />} />
            )}
          </div>
          <Seg legend="ใส่อัตราป้อนเป็น" name="feedMode" value={cur.pre.feedMode} onChange={(v) => set({ feedMode: v })}
            options={[{ value: 'ml', label: 'mL/min' }, { value: 'pump', label: 'Pump %', sub: 'แปลงด้วย Proxy' }]} />
          {cur.pre.feedMode === 'pump' ? (
            <p className="cap">Pump % ไม่ใช่อัตราป้อนจริง ระบบแปลงเป็น mL/min ด้วยค่าตัวคูณของโปรไฟล์ ซึ่งเป็น Proxy{d.feedMlMin !== null ? <> ตอนนี้แปลงได้ <Val v={d.feedMlMin} unit="mL/min" kind="proxy" /></> : null}</p>
          ) : null}
          <Seg legend="ที่มาของค่าของแข็ง" name="tsSource" value={cur.pre.tsSource} onChange={(v) => set({ tsSource: v })}
            options={[{ value: 'measured', label: 'วัดเอง' }, { value: 'assumed', label: 'ประมาณ' }, { value: 'brix', label: '°Brix', sub: 'Proxy' }]} />
          {cur.pre.tsSource === 'brix' ? (
            <>
              <NumField id="brix" label="°Brix" unit="°Bx" value={cur.pre.brix} onChange={(v) => set({ brix: v })} error={E('ts')} chip={<Chip kind="proxy" extra="Brix" />} />
              <Notice kind="warn" title="TS ไม่เท่ากับ °Brix">คุณเลือกใช้ °Brix แทน TS ผลที่ได้มีป้าย Proxy และอาจคลาดเคลื่อนมากกว่าใช้ TS ที่วัดจริง</Notice>
            </>
          ) : (
            <NumField id="ts" label="TS (ของแข็งในสารป้อน)" unit="%" value={cur.pre.ts} onChange={(v) => set({ ts: v })} error={E('ts')} chip={<Chip kind={cur.pre.tsSource === 'measured' ? 'measured' : 'assumed'} />} />
          )}
          {showErrors ? <Notice kind="danger" title="ยังประเมินไม่ได้">แก้ช่องที่มีข้อความสีแดงด้านบน แล้วกดประเมิน Tout อีกครั้ง</Notice> : null}
          <Btn variant="primary" icon="flask" block onClick={evaluate}>ประเมิน Tout</Btn>
        </Panel>

        <div className="stack" ref={resultRef} style={{ scrollMarginTop: 72 }}>
          {snap && eta ? (
            <div className={`stack result-in ${stale ? 'stale' : ''}`} key={snap.at} aria-live="polite">
              {stale ? <Notice kind="warn" title="ผลนี้เป็นของค่าเดิม">คุณแก้ค่าหลังประเมินครั้งล่าสุด กดประเมิน Tout อีกครั้งเพื่ออัปเดต</Notice> : null}
              <Panel title="Tout ที่คาดว่าจะได้">
                <div className="result-grid result-grid--lead">
                  <div className="ld-metric ld-metric--hero">
                    <span className="ld-metric__label">โมเดล eta</span>
                    <div><span className="ld-metric__value"><CountUp value={eta.tout} digits={1} /></span><span className="ld-metric__unit">°C</span></div>
                    <div className="ld-metric__meta"><Chip kind="predicted" /></div>
                  </div>
                  {ua ? <Metric label="โมเดล UA" value={ua.tout} unit="°C" kind="predicted" count /> : null}
                </div>
                <UnvalidatedBar />
                {eta.extrapolated || ua?.extrapolated ? (
                  <Notice kind="warn" title="โมเดลปรับค่าให้อยู่ในขอบเขต">{eta.reason || ua?.reason} ค่านี้อาจอยู่นอกช่วงที่เชื่อถือได้</Notice>
                ) : null}
                <p className="cap">ใช้ค่าโปรไฟล์ตัวอย่างของ {profile.code} (ค่าตัวอย่างสมมติ ไม่ได้คำนวณจากค่าคาลิเบรตจริง) แนวอ่านผลที่ปลื้มยอมรับระหว่างที่ทำนายกับที่เครื่องแสดงคือราว {READ_BAND_C} °C ไม่ใช่ค่าที่ระบบเคลมว่าแม่น</p>
                <div className="row">
                  <Btn variant="primary" icon="timer" onClick={() => go('/run')}>ไปจับเวลา</Btn>
                  <Btn icon="clipboard" onClick={() => go('/companion')}>ดูผลแบบสั้น</Btn>
                </div>
              </Panel>

              <Panel title="Tg และ Sticky point">
                <div className="result-grid">
                  <Metric label="Tg ของผง (กลาง)" value={tg.ok ? tg.bands.mid : null} unit="°C" kind="calculated" />
                  <Metric label="Sticky point โดยประมาณ" value={sticky} unit="°C" kind="assumed" hint="Tg กลาง บวกส่วนต่างที่สมมติ" />
                </div>
                {towardSticky === 'above' ? <Notice kind="warn" title="Tout ที่ทำนายสูงกว่า Sticky point โดยประมาณ">ผงมีโอกาสนิ่มและติดผนังไซโคลน ลด Tin หรือเพิ่มมอลโตเดกซ์ทริน แล้วประเมินใหม่</Notice> : null}
                {towardSticky === 'mid' ? <Notice kind="warn" title="Tout ที่ทำนายอยู่ในช่วงแถบ Tg">ผงอาจเริ่มนิ่ม ดูแถบ lo, mid, hi ในแท็บ Tg ด้านล่าง</Notice> : null}
                {towardSticky === 'below' ? <Notice kind="info" title="Tout ที่ทำนายต่ำกว่า Tg และ Sticky point โดยประมาณ">ผลนี้ยังเป็น Predicted และ UNVALIDATED</Notice> : null}
                <Notice kind="warn" title="ข้อจำกัดของ Tg ที่ต้องรู้ก่อนอ่านผล">
                  Gordon-Taylor เป็นสมการไบนารี ระบบรวมของแข็งทุกตัวเป็นองค์ประกอบเดียวก่อน การผสม Tg เชิงเส้นเป็นการประมาณ ค่าจริงอาจเบี่ยงเบน ระบบผลไม้กับมอลโตเดกซ์ทริน คือกรณีที่แม่นน้อยที่สุด ค่า Tg ของมอลโตเดกซ์ทริน ยังต้องหาต้นฉบับ และอัตราลมในสูตรเป็นค่าคำนวณ ไม่ใช่มวลลมที่วัดโดยตรง
                </Notice>
              </Panel>
            </div>
          ) : (
            <Panel title="ผลประเมิน">
              <div className="stack" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: '100%', height: 110, color: 'var(--brand)', opacity: 0.5 }}><SprayField width={420} height={110} rays={7} perRay={7} originY={0.5} spread={0.3} /></div>
                <p className="h3">ยังไม่มีผลประเมิน</p>
                <p className="muted small">ผลจะขึ้นที่นี่ พร้อมป้าย Predicted และแถบ UNVALIDATED</p>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel title="เครื่องมือเสริม">
        <Tabs<Tool> label="เครื่องมือเสริมของขั้นก่อนทดลอง" value={tool} onChange={setTool}
          tabs={[{ key: 'tg', label: 'Tg' }, { key: 'how', label: 'วิธีคำนวณ' }, { key: 'checks', label: 'เช็กก่อนรัน', badge: `${PRE_CHECKS.filter((c) => cur.preChecks[c.key]).length}/${PRE_CHECKS.length}` }, { key: 'doe', label: 'DOE' }]} />
        <div className="tabpanel" key={tool} role="tabpanel" aria-labelledby={`pt-${tool}`}>
          {tool === 'tg' ? (
            <>
              <div className="form-grid">
                <NumField id="md" label="มอลโตเดกซ์ทริน" unit="%" value={cur.pre.md} onChange={(v) => set({ md: v })} chip={<Chip kind="assumed" />} />
                <NumField id="moisture" label="ความชื้นเป้าหมายของผง" unit="%" value={cur.pre.moisture} onChange={(v) => set({ moisture: v })} chip={<Chip kind="assumed" />} />
                <NumField id="gtk" label="ค่า k ของ Gordon-Taylor" value={cur.pre.k} onChange={(v) => set({ k: v })} chip={<Chip kind="assumed" />} hint="ค่าตัวอย่างสมมติ" />
                <NumField id="sticky" label="Sticky point สูงกว่า Tg" unit="°C" value={cur.pre.stickyOffset} onChange={(v) => set({ stickyOffset: v })} chip={<Chip kind="assumed" />} hint={`ตั้งต้นตัวอย่าง ${DEFAULT_STICKY_OFFSET_C} °C รอยืนยัน`} />
              </div>
              {tg.ok ? (
                <div className="result-grid">
                  <Metric label="Tg แถบล่าง (lo)" value={tg.bands.lo} unit="°C" kind="calculated" />
                  <Metric label="Tg กลาง (mid)" value={tg.bands.mid} unit="°C" kind="calculated" />
                  <Metric label="Tg แถบบน (hi)" value={tg.bands.hi} unit="°C" kind="calculated" />
                </div>
              ) : (
                <div className="stack-sm">{tg.errors.map((e) => <Notice key={e.field} kind="danger" title={e.what}>{e.why}. {e.fix}.</Notice>)}</div>
              )}
            </>
          ) : null}
          {tool === 'how' ? (
            snap && eta ? (
              <>
                <p className="muted small">ค่าทุกบรรทัดมาจากสูตรโดยตรง หน้านี้ไม่คำนวณซ้ำ</p>
                <div className="grid-2">
                  {[eta, ua].filter(Boolean).map((m) => (
                    <div key={m!.model} className="stack-sm">
                      <h3 className="h3">{m!.model === 'eta' ? 'โมเดล eta' : 'โมเดล UA'}</h3>
                      <p className="eq">{m!.model === 'eta' ? 'eta × มวลลม × cp × (Tin - Tout) = น้ำที่ระเหย × ความร้อนแฝง + ความร้อนที่สารป้อนดูด' : 'มวลลม × cp × (Tin - Tout) = น้ำที่ระเหย × ความร้อนแฝง + ความร้อนที่สารป้อนดูด + UA × (Tเฉลี่ยในตู้ - Tห้อง)'}</p>
                      <ul className="steps-list">
                        {m!.steps.map((s) => (
                          <li key={s.key}>
                            <span className="t">{s.label}</span>
                            <span className="n">{s.note}</span>
                            <span className="v"><Val v={s.value} digits={s.unit === '°C' ? 1 : 3} unit={s.unit} kind="calculated" /></span>
                          </li>
                        ))}
                        <li><span className="t">Tout หลังตรวจขอบเขต</span><span className="n">{m!.extrapolated ? m!.reason : `ไม่ต่ำกว่า ${T_FLOOR} °C และต่ำกว่า Tin อย่างน้อย 5 °C`}</span><span className="v"><Val v={m!.tout} unit="°C" kind="predicted" /></span></li>
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="muted">ประเมิน Tout ก่อน แล้ววิธีคำนวณทีละขั้นจะขึ้นที่นี่</p>
          ) : null}
          {tool === 'checks' ? (
            <>
              {PRE_CHECKS.map((c) => (
                <Check key={c.key} id={`pc-${c.key}`} checked={!!cur.preChecks[c.key]} onChange={(v) => updateCur((x) => { x.preChecks[c.key] = v; })}>{c.label}</Check>
              ))}
              <p className="cap">รายการนี้เป็นตัวช่วยจำ ไม่ล็อกขั้นตอนถัดไป</p>
            </>
          ) : null}
          {tool === 'doe' ? <DoeBody /> : null}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- DOE: ตัวอย่างอัลกอริทึมแบบง่าย (Latin hypercube สุ่มด้วย seed) รอเชื่อมกับ doe.js ของแอปเดิม ---------- */
function DoeBody() {
  const profile = useProfile();
  const plans = useAppState((s) => s.plans);
  const [f, setF] = useState({ n: '8', seed: '2026', tin: '140', tin2: '180', feed: '6', feed2: '12', ts: '10', ts2: '20', name: '' });
  const [rows, setRows] = useState<Plan['rows']>([]);
  const [loaded, setLoaded] = useState('');
  const n = parseNum(f.n), seed = parseNum(f.seed);
  const R = {
    tin: [parseNum(f.tin), parseNum(f.tin2)], feed: [parseNum(f.feed), parseNum(f.feed2)], ts: [parseNum(f.ts), parseNum(f.ts2)],
  };
  const bad = [n, seed, ...R.tin, ...R.feed, ...R.ts].some((v) => v === null) || (n ?? 0) < 2 || (n ?? 0) > 30 || R.tin[0]! >= R.tin[1]! || R.feed[0]! >= R.feed[1]! || R.ts[0]! >= R.ts[1]!;

  const generate = () => {
    if (bad) return;
    const rnd = mulberry32(seed as number);
    const N = n as number;
    const lhs = (lo: number, hi: number) => {
      const strata = Array.from({ length: N }, (_, i) => (i + rnd()) / N);
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [strata[i], strata[j]] = [strata[j], strata[i]]; }
      return strata.map((u) => Math.round((lo + u * (hi - lo)) * 10) / 10);
    };
    const tin = lhs(R.tin[0]!, R.tin[1]!), feed = lhs(R.feed[0]!, R.feed[1]!), ts = lhs(R.ts[0]!, R.ts[1]!);
    const out = tin.map((t, i) => {
      const p = predictTout({ tin: t, feedMlMin: feed[i], solidsFrac: ts[i] / 100, airFlow: profile.airFlow, eta: profile.eta, ua: profile.ua, tfeed: profile.tfeed, troom: profile.troom }, 'eta');
      let tout: number | null = null, flag = 'ผ่านตรวจขอบเขต';
      if (p.ok && p.prediction.eta) {
        tout = p.prediction.eta.tout;
        if (p.prediction.eta.extrapolated) flag = 'โมเดลปรับค่า ไม่ควรรัน';
      } else flag = 'คำนวณไม่ได้';
      if (t < INPUT_LIMITS.tinMin || t > INPUT_LIMITS.tinMax || feed[i] > INPUT_LIMITS.feedMax) flag = 'นอกช่วงที่กรอกได้';
      return { n: i + 1, tin: t, feed: feed[i], ts: ts[i], tout, flag };
    });
    setRows(out);
    setLoaded('');
  };

  const save = () => {
    if (!rows.length) return;
    const plan: Plan = { id: `PLAN-${Date.now().toString(36)}`, name: f.name.trim() || `แผน seed ${f.seed}`, seed: seed as number, createdAt: new Date().toISOString(), rows };
    setState({ plans: [plan, ...plans] });
    setLoaded(plan.id);
  };
  const load = (id: string) => {
    const p = plans.find((x) => x.id === id);
    setLoaded(id);
    if (p) { setRows(p.rows); setF((x) => ({ ...x, seed: String(p.seed), name: p.name })); }
  };
  const exportRsm = () => {
    // คอลัมน์ผลตอบสนองเว้นว่าง ห้ามเติม 0
    download('doe-rsm.csv', toCsv([['ลำดับ', 'Tin (°C)', 'อัตราป้อน (mL/min)', 'TS (%)', 'Tout ที่อ่านได้ (°C)', 'ผลแล็บ'], ...rows.map((r) => [r.n, r.tin, r.feed, r.ts, null, null])]), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <Notice kind="info" title="อัลกอริทึมตัวอย่างสำหรับต้นแบบ">ใช้การสุ่มแบบ Latin hypercube ด้วย seed เพื่อให้สุ่มซ้ำได้ผลเดิม ยังไม่ได้เชื่อมกับ doe.js ของแอปเดิม ค่า Tout ที่แสดงมาจากสูตรจริงด้วยโปรไฟล์ตัวอย่าง</Notice>
      <div className="form-grid">
        <NumField id="doe-n" label="จำนวนรัน" value={f.n} onChange={(v) => setF({ ...f, n: v })} hint="2 ถึง 30" />
        <NumField id="doe-seed" label="seed" value={f.seed} onChange={(v) => setF({ ...f, seed: v })} hint="ค่าเดิมได้แผนเดิม" />
        <NumField id="doe-tin" label="Tin ต่ำสุด" unit="°C" value={f.tin} onChange={(v) => setF({ ...f, tin: v })} />
        <NumField id="doe-tin2" label="Tin สูงสุด" unit="°C" value={f.tin2} onChange={(v) => setF({ ...f, tin2: v })} />
        <NumField id="doe-feed" label="อัตราป้อนต่ำสุด" unit="mL/min" value={f.feed} onChange={(v) => setF({ ...f, feed: v })} />
        <NumField id="doe-feed2" label="อัตราป้อนสูงสุด" unit="mL/min" value={f.feed2} onChange={(v) => setF({ ...f, feed2: v })} />
        <NumField id="doe-ts" label="TS ต่ำสุด" unit="%" value={f.ts} onChange={(v) => setF({ ...f, ts: v })} />
        <NumField id="doe-ts2" label="TS สูงสุด" unit="%" value={f.ts2} onChange={(v) => setF({ ...f, ts2: v })} />
      </div>
      {bad ? <Notice kind="danger" title="ตั้งค่าแผนไม่ครบ">ทุกช่องต้องเป็นตัวเลข ค่าต่ำสุดต้องน้อยกว่าค่าสูงสุด และจำนวนรันอยู่ระหว่าง 2 ถึง 30 แก้ให้ครบแล้วกดสร้างแผน</Notice> : null}
      <div className="row">
        <Btn variant="primary" icon="refresh" disabled={bad} onClick={generate}>สร้างแผน</Btn>
        <Btn icon="save" disabled={!rows.length} onClick={save}>บันทึกแผน</Btn>
        <Btn icon="download" disabled={!rows.length} onClick={exportRsm}>ส่งออก RSM (CSV)</Btn>
        {plans.length ? (
          <div style={{ minWidth: 200 }}>
            <SelectField id="doe-load" label="โหลดแผนที่บันทึกไว้" value={loaded} onChange={load} options={[{ value: '', label: 'เลือกแผน' }, ...plans.map((p) => ({ value: p.id, label: p.name }))]} />
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <DT caption="แผนการทดลองหลายรัน">
          <thead>
            <tr><th>รัน</th><th className="ld-num">Tin (°C) <Chip kind="assumed" /></th><th className="ld-num">ป้อน (mL/min) <Chip kind="assumed" /></th><th className="ld-num">TS (%) <Chip kind="assumed" /></th><th className="ld-num">Tout ทำนาย (°C)</th><th>ตรวจขอบเขต</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.n}>
                <td data-label="รัน" className="cell-left">{r.n}</td>
                <td data-label="Tin (Assumed)" className="ld-num">{r.tin}</td>
                <td data-label="ป้อน (Assumed)" className="ld-num">{r.feed}</td>
                <td data-label="TS (Assumed)" className="ld-num">{r.ts}</td>
                <td data-label="Tout ทำนาย" className="ld-num"><Val v={r.tout} kind="predicted" /></td>
                <td data-label="ตรวจขอบเขต" className="cell-left">{r.flag}</td>
              </tr>
            ))}
          </tbody>
        </DT>
      ) : null}
    </>
  );
}
