/* Laong — แกนคำนวณคำทำนาย Tout ของรัน (pure: ไม่มี DOM, ไม่มี storage)
 * - เรียก PHYSICS.outletTempUA จาก integration-test-physics.js ซึ่งเป็นสำเนา byte ต่อ byte
 *   ของ js/physics-model.js ระบบเดิม (ตรวจ SHA-256 ใน test และตอนโหลดหน้า) — ห้ามแก้สมการที่นี่
 * - ไม่สำเร็จ = ไม่ให้ผล (fail closed): ค่าขาด/นอกช่วง/extrapolated/Air-in ไม่ตรงโปรไฟล์
 * - ผลเป็น "คำทำนาย" เสมอ ไม่ใช่ค่าวัด และไม่ใช่การรับรองคุณภาพผง
 */
'use strict';
(() => {
  const PHYSICS_FILE = 'integration-test-physics.js';
  const PHYSICS_SHA256 = '4b0587d3afd887c2b6fdc2a019ac63845a509e50732063a2bc592635b251c781';
  const PROFILE_KIND = 'laong-machine-profile';
  const PREDICTION_KIND = 'laong-tout-prediction';
  const SENSOR_MIN = 30, SENSOR_MAX = 120;      // ช่วงแสดงผล Outlet sensor ของเครื่อง
  const MODEL_DEFAULT_TFEED = 25;               // ค่าเริ่มต้นใน physics-model.js (สมมติ)
  const PROTEIN_TIN_CONFIRMED = 150;            // P1-SS เป็นจุดโปรตีนเดียวที่ยืนยัน
  const CLASSES = ['TEAM_CONFIDENTIAL', 'PUBLIC_SYNTHETIC'];
  // Explicit identities supported by the existing reference catalogue; TEST recording-only materials remain unavailable.
  const PREDICTION_MATERIALS = Object.freeze({water:'น้ำ',pinto:'ถั่วลายเสือ',soy:'ถั่วเหลือง',mango_measured:'เนื้อมะม่วง (ข้อมูลอ้างอิงบางส่วนไม่พร้อม)',mango_ndm:'มะม่วงน้ำดอกไม้',mango_usda:'มะม่วง Tommy Atkins / Kent / Keitt',mango_generic:'มะม่วงไม่ระบุพันธุ์'});
  const isSupportedMaterial = id => typeof id === 'string' && Object.hasOwn(PREDICTION_MATERIALS,id);

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max) => typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : null;
  const fin = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
  function parseNum(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    const t = String(v).trim();
    return t === '' ? NaN : Number(t);
  }

  const pumpCalibrated = (at, full) => (full === null ? null : at);

  /* ตรวจไฟล์โปรไฟล์เครื่องที่ทีมส่งให้ คืนสำเนาเฉพาะช่องที่รู้จัก (whitelist) */
  function validateProfile(obj) {
    const fail = error => ({ ok: false, error });
    if (!isObj(obj)) return fail('ไฟล์ไม่ใช่โปรไฟล์เครื่อง');
    if (obj.kind !== PROFILE_KIND || obj.version !== 1) return fail('ไม่ใช่ไฟล์โปรไฟล์เครื่องของ Laong (kind/version ไม่ตรง)');
    const key = str(obj.key, 80);
    if (!key || !/^[A-Za-z0-9._:-]+$/.test(key)) return fail('รหัสโปรไฟล์ (key) ไม่ถูกต้อง');
    const label = str(obj.label, 100), machineId = str(obj.machineId, 80);
    if (!label || !machineId) return fail('ต้องมีชื่อโปรไฟล์และรหัสเครื่อง');
    const airInPct = fin(obj.airInPct, 1, 100);
    const airflow = fin(obj.airflow_m3h, 5, 200);
    const ua = fin(obj.ua_kJhK, 1, 200);
    const room = fin(obj.room_C, 0, 45);
    if (airInPct === null) return fail('Air-in (%) ต้องเป็นตัวเลข 1–100');
    if (airflow === null) return fail('อัตราลมอบแห้ง (m³/h) ต้องเป็นตัวเลข 5–200');
    if (ua === null) return fail('UA (kJ/(h·K)) ต้องเป็นตัวเลข 1–200');
    if (room === null) return fail('อุณหภูมิห้อง (°C) ต้องเป็นตัวเลข 0–45');
    if (!CLASSES.includes(obj.classification)) return fail('ต้องระบุระดับข้อมูล (classification)');
    const prov = obj.provenance;
    if (!isObj(prov) || !str(prov.airflow, 300) || !str(prov.ua, 300) || !str(prov.summary, 600)) {
      return fail('ต้องระบุที่มาของค่าลม, UA และสรุปข้อจำกัด (provenance)');
    }
    // ค่าสอบเทียบปั๊ม (ไม่บังคับ): 100% ของหน้าเครื่อง = กี่ mL/min และวัดที่จุดกี่ % — ใช้แปลงค่าปั๊ม % เป็น proxy อัตราป้อนเท่านั้น
    const pumpFullScale = obj.pumpFullScale_mLmin == null ? null : fin(obj.pumpFullScale_mLmin, 1, 200);
    const pumpCalibratedAt = obj.pumpCalibratedAtPct == null ? null : fin(obj.pumpCalibratedAtPct, 1, 100);
    if (obj.pumpFullScale_mLmin != null && pumpFullScale === null) return fail('ค่าสอบเทียบปั๊ม (mL/min ที่ 100%) ต้องเป็นตัวเลข 1–200');
    if (obj.pumpCalibratedAtPct != null && pumpCalibratedAt === null) return fail('จุดที่สอบเทียบปั๊ม (%) ต้องเป็นตัวเลข 1–100');
    const calibratedAt = obj.calibratedAt == null ? null : str(obj.calibratedAt, 10);
    if (calibratedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(calibratedAt)) return fail('วันที่คาลิเบรตต้องเป็น YYYY-MM-DD');
    const points = Array.isArray(obj.validatedPoints) ? obj.validatedPoints.slice(0, 20) : [];
    const validatedPoints = [];
    for (const p of points) {
      if (!isObj(p) || !['water', 'protein'].includes(p.kind)) return fail('จุดยืนยัน (validatedPoints) ไม่ถูกต้อง');
      const tin = fin(p.tin_C, 100, 220);
      if (tin === null) return fail('จุดยืนยันต้องมี tin_C');
      validatedPoints.push(Object.freeze({ kind: p.kind, tin_C: tin, note: str(p.note, 200) || '' }));
    }
    return {
      ok: true,
      profile: Object.freeze({
        kind: PROFILE_KIND, version: 1, key, label, machineId, airInPct,
        airflow_m3h: airflow, ua_kJhK: ua, room_C: room,
        classification: obj.classification, calibratedAt,
        pumpFullScale_mLmin: pumpFullScale, pumpCalibratedAtPct: pumpCalibrated(pumpCalibratedAt, pumpFullScale),
        provenance: Object.freeze({ airflow: str(prov.airflow, 300), ua: str(prov.ua, 300), summary: str(prov.summary, 600), pump: str(prov.pump, 400) }),
        sourceDoc: str(obj.sourceDoc, 200),
        validatedPoints: Object.freeze(validatedPoints),
        builtin: false,
      }),
    };
  }

  /* โปรไฟล์สาธิตจาก runtime config สาธารณะ (ข้อมูลสังเคราะห์) */
  function demoProfile(cfg) {
    const p = cfg && cfg.defaultMachineProfile;
    if (!isObj(p) || cfg.classification !== 'PUBLIC_SYNTHETIC') return null;
    const r = validateProfile({
      kind: PROFILE_KIND, version: 1, key: p.key, label: p.label, machineId: p.machineId,
      airInPct: p.airInPct, airflow_m3h: p.airflow_m3h, ua_kJhK: p.ua_kJhK, room_C: p.room_C,
      classification: 'PUBLIC_SYNTHETIC', calibratedAt: null,
      provenance: { airflow: 'สมมติ (ข้อมูลสาธิต)', ua: 'สมมติ (ข้อมูลสาธิต)', summary: p.note || 'ข้อมูลสาธิต ห้ามใช้อ้างอิงการเดินเครื่องจริง' },
      validatedPoints: [],
      pumpFullScale_mLmin: Number.isFinite(p.pumpMax_mLmin) ? p.pumpMax_mLmin : null, // ค่าสมมติของโปรไฟล์สาธิต ไม่มีจุดสอบเทียบ
    });
    return r.ok ? Object.freeze({ ...r.profile, builtin: true }) : null;
  }

  /* คำนวณคำทำนายจาก input ของผู้ใช้ + โปรไฟล์ คืน snapshot สำหรับบันทึกลงรัน */
  function compute(input, profile, physics, now = new Date()) {
    const fail = (error, field) => ({ ok: false, error, field });
    if (!profile || profile.kind !== PROFILE_KIND) return fail('ยังไม่ได้เลือกโปรไฟล์เครื่อง', 'profile');
    if (!physics || typeof physics.outletTempUA !== 'function') return fail('โมเดลยังไม่พร้อม (ไม่พบไฟล์สมการ)', null);
    const materialId = typeof input.materialId === 'string' ? input.materialId : '';
    if (!isSupportedMaterial(materialId)) return fail(materialId ? 'ยังไม่รองรับคำทำนายสำหรับวัตถุดิบนี้ บันทึกรันได้โดยไม่ทำนาย' : 'เลือกชนิดวัตถุดิบก่อนทำนาย', 'materialId');
    // อัตราป้อน: กรอกเป็นค่าปั๊ม % ตามหน้าเครื่อง (แปลงเป็น proxy ด้วยค่าสอบเทียบปั๊มของโปรไฟล์) หรือกรอกอัตราป้อนที่วัดได้เป็น mL/min
    // ไม่ระบุ feedMode = พฤติกรรมเดิม (กรอก mL/min + เลือกที่มา)
    const feedMode = input.feedMode === 'pump_pct' ? 'pump_pct' : input.feedMode === 'measured' ? 'measured' : 'legacy';
    let feedEntry = null;
    const warningsEarly = [];
    if (feedMode === 'pump_pct') {
      const pct = parseNum(input.pumpPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return fail('ตรวจค่าปั๊ม (0–100% ตามหน้าเครื่อง)', 'pumpPct');
      const full = profile.pumpFullScale_mLmin;
      if (!(Number.isFinite(full) && full > 0)) return fail('โปรไฟล์นี้ไม่มีค่าสอบเทียบปั๊ม — กรอกเป็นอัตราป้อนที่วัดได้ (mL/min) แทน', 'pumpPct');
      const converted = Math.round(pct / 100 * full * 10000) / 10000;
      if (converted > 20) return fail(`ค่าปั๊ม ${pct}% เทียบเป็น ${converted} mL/min เกินช่วงที่โมเดลรับ (0–20 mL/min)`, 'pumpPct');
      const calAt = Number.isFinite(profile.pumpCalibratedAtPct) ? profile.pumpCalibratedAtPct : null;
      const withinCalibrated = calAt === null ? null : pct <= calAt;
      feedEntry = Object.freeze({
        mode: 'pump_pct', entered: pct, unit: '%', converted_mLmin: converted,
        conversion: 'feed_mLmin = pump_pct / 100 × pumpFullScale_mLmin', pumpFullScale_mLmin: full, pumpCalibratedAtPct: calAt,
        withinCalibratedRange: withinCalibrated, calibrationNote: profile.provenance.pump || null,
      });
      input = { ...input, feed: converted, feedSource: 'pump_proxy' };
      if (withinCalibrated === false) warningsEarly.push(`ค่าปั๊ม ${pct}% สูงกว่าจุดที่สอบเทียบปั๊ม (${calAt}%) — การแปลงเป็น mL/min ที่ช่วงนี้เป็นการประมาณเชิงเส้นนอกช่วงที่วัด`);
      if (withinCalibrated === null) warningsEarly.push('โปรไฟล์ไม่ระบุจุดที่สอบเทียบปั๊ม — การแปลงค่าปั๊ม % เป็น mL/min ยังไม่ผ่านการตรวจช่วง');
    } else if (feedMode === 'measured') {
      const mv = parseNum(input.feed);
      feedEntry = Object.freeze({ mode: 'measured_mLmin', entered: Number.isFinite(mv) ? mv : null, unit: 'mL/min', converted_mLmin: Number.isFinite(mv) ? mv : null });
      input = { ...input, feedSource: 'measured' };
    }
    const specs = [['airIn', 'Air-in', 1, 100], ['tin', 'อุณหภูมิขาเข้า', 120, 200], ['feed', 'อัตราป้อน', 0, 20]];
    const v = {};
    for (const [k, label, lo, hi] of specs) {
      const x = parseNum(input[k]);
      if (!Number.isFinite(x) || x < lo || x > hi) return fail(`ตรวจ${label} (${lo}–${hi})`, k);
      v[k] = x;
    }
    if (v.airIn !== profile.airInPct) {
      return fail(`โปรไฟล์นี้คาลิเบรตที่ Air-in ${profile.airInPct}% เท่านั้น — ระดับลมอื่นใช้ค่านี้ทำนายไม่ได้`, 'airIn');
    }
    const feedSource = input.feedSource === 'measured' ? 'measured' : 'pump_proxy';

    const tsText = parseNum(input.solidsPct), brix = parseNum(input.brix);
    let solidsPct, solidsSource;
    if (!Number.isNaN(tsText)) {
      if (!(tsText >= 0 && tsText <= 35)) return fail('ตรวจ Total Solids (0–35%)', 'solidsPct');
      solidsPct = tsText; solidsSource = 'total_solids';
    } else if (input.useBrixProxy === true && Number.isFinite(brix) && brix >= 0 && brix <= 8) {
      solidsPct = brix; solidsSource = 'brix_proxy';
    } else {
      return fail('กรอก Total Solids หรือเลือกใช้ °Brix เป็น proxy (0–8)', 'solidsPct');
    }
    if (materialId === 'water' && solidsPct !== 0) return fail('เลือกน้ำ: ค่า Total Solids ต้องเป็น 0 หรือเปลี่ยนชนิดวัตถุดิบ', 'solidsPct');

    let tfeed = parseNum(input.tfeed), tfeedSource = 'user';
    if (Number.isNaN(tfeed)) { tfeed = MODEL_DEFAULT_TFEED; tfeedSource = 'model_default'; }
    else if (!(tfeed >= 0 && tfeed <= 80)) return fail('ตรวจอุณหภูมิสารป้อน (0–80 °C)', 'tfeed');

    let heat;
    try {
      heat = physics.outletTempUA(v.tin, v.feed, solidsPct / 100, profile.airflow_m3h, profile.ua_kJhK, profile.room_C, tfeed);
    } catch { return fail('คำนวณไม่ได้ (โมเดลขัดข้อง)', null); }
    if (!heat || !Number.isFinite(heat.raw) || !Number.isFinite(heat.Tout)) return fail('คำนวณไม่ได้ ตรวจค่าที่กรอก', null);
    if (heat.extrapolated) return fail(`ผลอยู่นอกขอบเขตโมเดล: ${heat.reason || 'ไม่ทราบสาเหตุ'} — ไม่แสดงเป็นคำทำนาย`, null);

    const warnings = [...warningsEarly];
    if (profile.classification === 'PUBLIC_SYNTHETIC') warnings.push('ใช้โปรไฟล์สาธิต (ข้อมูลสมมติ) — ห้ามใช้อ้างอิงการเดินเครื่องจริง');
    if (heat.Tout < SENSOR_MIN || heat.Tout > SENSOR_MAX) warnings.push(`ผลอยู่นอกช่วงแสดงผลเซนเซอร์ ${SENSOR_MIN}–${SENSOR_MAX} °C`);
    else if (heat.Tout > SENSOR_MAX - 5 || heat.Tout < SENSOR_MIN + 5) warnings.push(`ผลใกล้ขอบช่วงเซนเซอร์ ${SENSOR_MIN}–${SENSOR_MAX} °C`);
    if (v.tin > 160) warnings.push('Tin สูงกว่า 160 °C — ผลนี้ไม่ใช่คำแนะนำให้ใช้สภาวะนี้ ให้ทำตาม SOP/ผู้ดูแลเครื่อง');
    const tins = profile.validatedPoints.map(p => p.tin_C);
    if (profile.classification !== 'PUBLIC_SYNTHETIC') {
      const points = profile.validatedPoints.map(p => `${p.kind === 'water' ? 'น้ำ' : 'โปรตีน'} ${p.tin_C} °C`).join(', ') || 'ไม่มีข้อมูล';
      warnings.push(`จุดทดลองที่โปรไฟล์ระบุ: ${points} · การตรงกันเฉพาะ Tin ไม่ยืนยันความแม่นยำของวัตถุดิบหรือสภาวะรันนี้`);
      if (!tins.some(t => Math.abs(t - v.tin) < 0.5)) warnings.push(`ไม่มีจุดทดลองที่ Tin ${v.tin} °C ในโปรไฟล์นี้ · เป็นการประมาณนอกจุดที่ระบุ`);
    }
    if (feedMode === 'pump_pct') warnings.push(`ค่าปั๊ม ${feedEntry.entered}% ถูกแปลงเป็น ${feedEntry.converted_mLmin} mL/min ด้วยการสอบเทียบน้ำ (100% = ${feedEntry.pumpFullScale_mLmin} mL/min) — เป็น proxy ไม่ใช่อัตราป้อนจริงของสารละลาย`);
    if (feedSource === 'pump_proxy' && feedMode !== 'pump_pct') warnings.push('อัตราป้อนจากค่าตั้งปั๊ม/การสอบเทียบน้ำ เป็น proxy จนกว่าจะวัดอัตราป้อนจริงของ feed');
    if (solidsSource === 'brix_proxy') warnings.push('ใช้ °Brix แทน Total Solids เป็น proxy — °Brix ไม่เท่ากับ Total Solids');
    if (tfeedSource === 'model_default') warnings.push(`ไม่ได้กรอกอุณหภูมิสารป้อน จึงใช้ ${MODEL_DEFAULT_TFEED} °C ตามค่าเริ่มต้นของโมเดล (สมมติ)`);

    return {
      ok: true,
      snapshot: Object.freeze({
        kind: PREDICTION_KIND, version: 1, label: 'predicted', createdAt: now.toISOString(),
        inputs: Object.freeze({
          materialId, materialLabel: PREDICTION_MATERIALS[materialId], materialSource: 'operator_selected_unverified',
          airInPct: v.airIn, tin_C: v.tin, feed_mLmin: v.feed, feedSource, feedEntry,
          solidsPct, solidsSource, brix: Number.isFinite(brix) ? brix : null,
          tfeed_C: tfeed, tfeedSource,
        }),
        profile: Object.freeze({
          key: profile.key, label: profile.label, machineId: profile.machineId, airInPct: profile.airInPct,
          airflow_m3h: profile.airflow_m3h, ua_kJhK: profile.ua_kJhK, room_C: profile.room_C,
          pumpFullScale_mLmin: profile.pumpFullScale_mLmin ?? null, pumpCalibratedAtPct: profile.pumpCalibratedAtPct ?? null,
          classification: profile.classification, calibratedAt: profile.calibratedAt,
          provenance: profile.provenance, sourceDoc: profile.sourceDoc || null,
        }),
        model: Object.freeze({ fn: 'outletTempUA', file: PHYSICS_FILE, sha256: PHYSICS_SHA256 }),
        result: Object.freeze({ raw_C: heat.raw, tout_C: Math.round(heat.Tout * 10) / 10 }),
        warnings: Object.freeze(warnings),
      }),
    };
  }

  /* ค้นหาสภาวะที่โมเดลบอกว่าให้ Tout ใกล้ค่าที่ต้องการ — ใช้ compute() ตัวเดิมทุกจุด ไม่มีสูตรใหม่
   * ขอบเขตที่ล็อกไว้: Tin 120–160 °C (ไม่เสนอเกิน 160 ตาม AGENTS.md) และค่าปั๊มไม่เกินจุดที่สอบเทียบปั๊มในโปรไฟล์
   * ผลเป็น "ค่าที่โมเดลคำนวณได้" ไม่ใช่คำแนะนำให้ใช้ ไม่ใช่ค่าที่ดีที่สุด และไม่ตรวจคุณภาพผง/ติดผนัง */
  const SUGGEST_TIN_MIN = 120, SUGGEST_TIN_MAX = 160, SUGGEST_TIN_STEP = 5, SUGGEST_PUMP_STEP = 1;
  function findConditions(base, profile, physics, opts = {}) {
    const fail = (error, field) => ({ ok: false, error, field });
    const target = parseNum(opts.target);
    if (!Number.isFinite(target) || target < SENSOR_MIN || target > SENSOR_MAX) return fail(`Tout ที่ต้องการต้องอยู่ในช่วงที่เซนเซอร์แสดง ${SENSOR_MIN}–${SENSOR_MAX} °C`, 'targetTout');
    if (!profile || profile.kind !== PROFILE_KIND) return fail('ยังไม่ได้เลือกโปรไฟล์เครื่อง', 'profile');
    if (!(Number.isFinite(profile.pumpFullScale_mLmin) && profile.pumpFullScale_mLmin > 0)) return fail('โปรไฟล์นี้ไม่มีค่าสอบเทียบปั๊ม — หาสภาวะจากค่าปั๊ม % ไม่ได้', 'profile');
    const maxPct = profile.pumpCalibratedAtPct;
    if (!Number.isFinite(maxPct) || maxPct < SUGGEST_PUMP_STEP) return fail('โปรไฟล์ไม่ระบุจุดที่สอบเทียบปั๊ม — ไม่มีขอบเขตปั๊มที่ใช้ค้นหาได้', 'profile');
    const tolerance = Number.isFinite(opts.tolerance) ? opts.tolerance : 3, limit = Number.isInteger(opts.limit) ? opts.limit : 3;
    const common = { ...base, feedMode: 'pump_pct' };
    // ค่าพื้นฐานที่ผู้ใช้กรอกต้องคำนวณได้ก่อน (วัตถุดิบ, Air-in, ของแข็ง ฯลฯ) — ถ้าไม่ได้ บอกช่องที่ขาด ไม่เดาแทน
    const probe = compute({ ...common, tin: 150, pumpPct: Math.min(maxPct, 10) }, profile, physics);
    if (!probe.ok && probe.field !== 'pumpPct' && probe.field !== 'tin' && probe.field !== null) return fail(probe.error, probe.field);
    const perTin = [];
    for (let tin = SUGGEST_TIN_MIN; tin <= SUGGEST_TIN_MAX; tin += SUGGEST_TIN_STEP) {
      let best = null;
      for (let pct = SUGGEST_PUMP_STEP; pct <= maxPct + 1e-9; pct += SUGGEST_PUMP_STEP) {
        const r = compute({ ...common, tin, pumpPct: pct }, profile, physics);
        if (!r.ok) continue;
        const tout = r.snapshot.result.tout_C, diff = Math.round((tout - target) * 10) / 10;
        if (!best || Math.abs(diff) < Math.abs(best.diff_C)) best = { tin_C: tin, pumpPct: pct, feed_mLmin: r.snapshot.inputs.feed_mLmin, tout_C: tout, diff_C: diff, withinCalibratedPump: true };
      }
      if (best) perTin.push(best);
    }
    const results = perTin.filter(x => Math.abs(x.diff_C) <= tolerance).sort((a, b) => Math.abs(a.diff_C) - Math.abs(b.diff_C) || a.tin_C - b.tin_C).slice(0, limit);
    return { ok: true, target, results, searched: { tinMin: SUGGEST_TIN_MIN, tinMax: SUGGEST_TIN_MAX, tinStep: SUGGEST_TIN_STEP, pumpMaxPct: maxPct, pumpStep: SUGGEST_PUMP_STEP }, tolerance };
  }

  /* ส่วนต่าง measured − predicted (ไม่ตีความว่า steady state) */
  function residual(snapshot, measuredTout) {
    const m = parseNum(measuredTout);
    if (!snapshot || !snapshot.result || !Number.isFinite(m)) return null;
    return Math.round((m - snapshot.result.tout_C) * 10) / 10;
  }

  globalThis.LAONG_PREDICTION = Object.freeze({
    validateProfile, demoProfile, compute, findConditions, residual, isSupportedMaterial,
    PHYSICS_FILE, PHYSICS_SHA256, PROFILE_KIND, PREDICTION_KIND, SENSOR_MIN, SENSOR_MAX,
  });
})();
