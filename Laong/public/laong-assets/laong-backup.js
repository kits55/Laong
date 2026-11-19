/* Laong — แกนสำรอง/กู้คืน (pure: ไม่มี DOM, ไม่เขียน storage เอง; ผู้เรียกส่งค่าเข้า/รับผลออก)
 * กติกา
 * - สำรองข้อมูลวิจัยทุกชนิดของ origin นี้: รัน, เลขรันที่ลบล่าสุด, พื้นที่ทำงาน (เครื่อง/ตั้งค่า), โปรไฟล์เครื่อง
 *   ไม่สำรองการตั้งค่าหน้าจอ (โหมดวิจัย, mascot, ฟิลเตอร์, พรีวิว) และ sessionStorage
 * - ไฟล์ระบุโหมดต้นทาง + checksum SHA-256 ของข้อมูล; ไม่ยอมกู้คืนข้ามโหมด (TEST ↔ จริง)
 * - กู้คืนแบบเพิ่ม (merge) ไม่เขียนทับรันที่มีอยู่: รันรหัสเดียวกันแต่เนื้อหาต่าง = ข้ามและรายงาน
 * - ไม่แก้เนื้อหารันใด ๆ ระหว่างสำรอง/กู้คืน (คัดลอกตามเดิมทุกช่อง รวม demo/dataOrigin/predictions/feedClock)
 */
'use strict';
(() => {
  const FORMAT = 'laong-backup';
  const VERSION = 1;
  const KEYS = Object.freeze({
    runs: 'laong.experiments.v1',
    lastDeletedId: 'laong.experiments.v1.lastDeletedId',
    workspace: 'laong.workspace.v1',
    profiles: 'laong.machineProfiles.v1',
  });
  const RUN_STATUSES = ['draft', 'ready', 'running', 'results', 'closed'];
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  /* JSON แบบเรียง key คงที่ — ใช้คำนวณ checksum ให้ได้ค่าเดิมทุกเครื่อง */
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (isObj(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
    return JSON.stringify(value === undefined ? null : value);
  }

  function parseOrNull(text) {
    if (text === null || text === undefined) return null;
    return JSON.parse(text); // โยน error ถ้าข้อมูลในเครื่องเสีย — ผู้เรียกต้องหยุด ไม่สำรองข้อมูลเสียแบบเงียบ
  }

  /* อ่านค่าจาก storage ผ่านฟังก์ชันที่ผู้เรียกส่งมา */
  function collect(getItem) {
    return {
      runs: parseOrNull(getItem(KEYS.runs)),
      lastDeletedId: getItem(KEYS.lastDeletedId),
      workspace: parseOrNull(getItem(KEYS.workspace)),
      profiles: parseOrNull(getItem(KEYS.profiles)),
    };
  }

  function isConfidential(data) {
    if (Array.isArray(data.profiles) && data.profiles.some(p => !isObj(p) || p.classification !== 'PUBLIC_SYNTHETIC')) return true;
    // A prediction keeps a copy of its source profile even after the profile is removed.
    // Unknown/malformed snapshots are restricted, not assumed synthetic.
    return Array.isArray(data.runs) && data.runs.some(r => isObj(r) && Object.hasOwn(r,'predictions') &&
      (!Array.isArray(r.predictions) || r.predictions.some(p => !isObj(p) || !isObj(p.profile) || p.profile.classification !== 'PUBLIC_SYNTHETIC')));
  }

  async function build(data, source, sha256Hex, now = new Date()) {
    const runs = Array.isArray(data.runs) ? data.runs : [];
    const payload = { runs: data.runs ?? null, lastDeletedId: data.lastDeletedId ?? null, workspace: data.workspace ?? null, profiles: data.profiles ?? null };
    return {
      format: FORMAT, version: VERSION, createdAt: now.toISOString(),
      source: { mode: source.mode, environment: source.environment, origin: source.origin },
      contains: {
        runs: runs.length,
        realRuns: runs.filter(r => isObj(r) && r.demo !== true).length,
        testRuns: runs.filter(r => isObj(r) && r.demo === true).length,
        profiles: Array.isArray(data.profiles) ? data.profiles.length : 0,
        confidential: isConfidential(payload),
      },
      data: payload,
      checksum: { algorithm: 'SHA-256', of: 'canonical(data)', value: await sha256Hex(canonical(payload)) },
    };
  }

  function runProblem(run, i) {
    if (!isObj(run)) return `รันลำดับที่ ${i + 1} ไม่ใช่ข้อมูลรัน`;
    if (typeof run.id !== 'string' || !/^R-\d{1,6}$/.test(run.id)) return `รันลำดับที่ ${i + 1} รหัสไม่ถูกต้อง`;
    if (!['spray', 'general'].includes(run.template)) return `${run.id}: แบบฟอร์มไม่รองรับ`;
    if (!RUN_STATUSES.includes(run.status)) return `${run.id}: สถานะไม่ถูกต้อง`;
    if (typeof run.title !== 'string' || typeof run.createdAt !== 'string' || !Number.isFinite(Date.parse(run.createdAt)) || !isObj(run.before) || !isObj(run.after)) return `${run.id}: รายละเอียดรันไม่ครบ`;
    if (!Array.isArray(run.logs) || run.logs.some(log => !isObj(log) || !isObj(log.data) || typeof log.time !== 'string' || !Number.isFinite(Date.parse(log.time)))) return `${run.id}: บันทึกระหว่างทดลองเสีย`;
    return null;
  }

  function workspaceProblem(w) {
    if (!isObj(w) || !Array.isArray(w.machines) || !isObj(w.preferences) || !Array.isArray(w.readAlerts)) return 'ข้อมูลเครื่องหรือการตั้งค่าไม่ครบ';
    if (!Number.isSafeInteger(w.nextMachine) || w.nextMachine < 1) return 'เลขเครื่องถัดไปไม่ถูกต้อง';
    if (w.machines.some(m => !isObj(m) || typeof m.id !== 'string' || !/^SD-\d+$/.test(m.id) || typeof m.name !== 'string' || typeof m.maintenance !== 'boolean')) return 'รายการเครื่องไม่ถูกต้อง';
    if (new Set(w.machines.map(m => m.id)).size !== w.machines.length || w.machines.some(m => Number(m.id.slice(3)) >= w.nextMachine)) return 'รหัสเครื่องซ้ำหรือเลขเครื่องถัดไปไม่ถูกต้อง';
    if (typeof w.preferences.name !== 'string' || typeof w.preferences.defaultMachine !== 'string' || typeof w.preferences.feedAlerts !== 'boolean' || typeof w.preferences.resultAlerts !== 'boolean' || !Number.isSafeInteger(w.preferences.historyMinimum) || w.preferences.historyMinimum < 1) return 'การตั้งค่าพื้นที่ทดลองไม่ถูกต้อง';
    if (w.readAlerts.some(x => typeof x !== 'string')) return 'รายการแจ้งเตือนไม่ถูกต้อง';
    const timeOk=t=>typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const dateOk=d=>{ if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const n=Date.parse(`${d}T00:00:00Z`); return Number.isFinite(n) && new Date(n).toISOString().slice(0,10)===d; };
    if (w.visits != null && (!Array.isArray(w.visits) || w.visits.some(v => !isObj(v) || typeof v.id !== 'string' || typeof v.title !== 'string' || !dateOk(v.date) || !timeOk(v.start) || !(v.end === '' || timeOk(v.end))))) return 'รายการปฏิทินไม่ถูกต้อง';
    return null;
  }

  /* ตรวจไฟล์สำรองก่อนใช้ — ไม่ผ่านแม้ข้อเดียว = ไม่ให้กู้คืน */
  async function validate(backup, currentMode, sha256Hex, validateProfile) {
    const errors = [];
    if (!isObj(backup) || backup.format !== FORMAT) return { ok: false, errors: ['ไม่ใช่ไฟล์สำรองของ Laong'] };
    if (backup.version !== VERSION) return { ok: false, errors: [`ไฟล์สำรองรุ่น ${backup.version} ยังไม่รองรับ`] };
    if (!isObj(backup.source) || !['test', 'real'].includes(backup.source.mode)) errors.push('ไม่ระบุโหมดต้นทาง');
    else if (backup.source.mode !== currentMode) {
      errors.push(`ไฟล์นี้มาจากโหมด ${backup.source.mode === 'real' ? 'จริง' : 'TEST'} แต่ตอนนี้เปิดโหมด ${currentMode === 'real' ? 'จริง' : 'TEST'} · ห้ามกู้คืนข้ามโหมด`);
    }
    if (!isObj(backup.data) || !isObj(backup.checksum)) return { ok: false, errors: [...errors, 'โครงสร้างไฟล์ไม่ครบ'] };
    const actual = await sha256Hex(canonical(backup.data));
    if (backup.checksum.algorithm !== 'SHA-256' || actual !== backup.checksum.value) errors.push('checksum ไม่ตรง · ไฟล์ถูกแก้หรือเสียหาย');
    const { runs, workspace, profiles, lastDeletedId } = backup.data;
    if (runs !== null) {
      if (!Array.isArray(runs)) errors.push('ข้อมูลรันเสีย');
      else {
        runs.forEach((r, i) => { const p = runProblem(r, i); if (p) errors.push(p); });
        const ids = runs.filter(isObj).map(r => r.id);
        if (new Set(ids).size !== ids.length) errors.push('มีรหัสรันซ้ำกันในไฟล์');
        if (currentMode === 'real' && runs.some(r => isObj(r) && (r.demo !== false || r.dataOrigin !== 'real'))) errors.push('ไฟล์โหมดจริงมีรันที่ไม่ยืนยันว่าเป็นข้อมูลจริง · ไม่ปลอดภัยที่จะกู้คืน');
        if (currentMode === 'test' && runs.some(r => isObj(r) && (r.demo !== true || r.dataOrigin !== 'test'))) errors.push('ไฟล์ TEST มีรันที่ไม่ยืนยันว่าเป็นข้อมูลจำลอง · ไม่ปลอดภัยที่จะกู้คืน');
      }
    }
    if (workspace !== null) {
      const issue = workspaceProblem(workspace);
      if (issue) errors.push(`ข้อมูลพื้นที่ทำงานเสีย: ${issue}`);
    }
    if (profiles !== null) {
      if (!Array.isArray(profiles)) errors.push('ข้อมูลโปรไฟล์เสีย');
      else {
        if (typeof validateProfile === 'function') profiles.forEach((p, i) => { const r = validateProfile(p); if (!r.ok) errors.push(`โปรไฟล์ลำดับที่ ${i + 1}: ${r.error}`); });
        const profileKeys = profiles.filter(p => isObj(p) && typeof p.key === 'string').map(p => p.key);
        if (new Set(profileKeys).size !== profileKeys.length) errors.push('มีรหัสโปรไฟล์ซ้ำกันในไฟล์');
      }
    }
    if (lastDeletedId !== null && !/^\d{0,7}$/.test(String(lastDeletedId))) errors.push('เลขรันที่ลบล่าสุดไม่ถูกต้อง');
    return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
  }

  /* เทียบรันในเครื่องกับในไฟล์ */
  function plan(currentRuns, backupRuns) {
    const cur = new Map((Array.isArray(currentRuns) ? currentRuns : []).map(r => [r.id, r]));
    const out = { add: [], identical: [], conflict: [], onlyCurrent: [] };
    const seen = new Set();
    for (const r of Array.isArray(backupRuns) ? backupRuns : []) {
      seen.add(r.id);
      if (!cur.has(r.id)) out.add.push(r.id);
      else if (canonical(cur.get(r.id)) === canonical(r)) out.identical.push(r.id);
      else out.conflict.push(r.id);
    }
    for (const id of cur.keys()) if (!seen.has(id)) out.onlyCurrent.push(id);
    return out;
  }

  /* รวมแบบไม่เขียนทับ: เพิ่มเฉพาะรัน/โปรไฟล์ที่ยังไม่มี; พื้นที่ทำงานในเครื่องคงเดิม (ถ้าในเครื่องยังไม่มีจึงใช้จากไฟล์) */
  function merge(current, backup) {
    const p = plan(current.runs, backup.data.runs);
    const addIds = new Set(p.add);
    const curRuns = Array.isArray(current.runs) ? current.runs : [];
    const runs = [...curRuns, ...(backup.data.runs || []).filter(r => addIds.has(r.id))];
    const curProfiles = Array.isArray(current.profiles) ? current.profiles : [];
    const existingProfiles = new Map(curProfiles.filter(isObj).map(x => [x.key, x]));
    const addedProfiles = [], profilesIdentical = [], profilesConflict = [];
    for (const profile of backup.data.profiles || []) {
      if (!existingProfiles.has(profile.key)) addedProfiles.push(profile);
      else if (canonical(existingProfiles.get(profile.key)) === canonical(profile)) profilesIdentical.push(profile.key);
      else profilesConflict.push(profile.key);
    }
    const workspaceConflict = current.workspace != null && backup.data.workspace != null && canonical(current.workspace) !== canonical(backup.data.workspace);
    const lastDel = Math.max(Number(current.lastDeletedId) || 0, Number(backup.data.lastDeletedId) || 0);
    return {
      result: {
        runs, profiles: [...curProfiles, ...addedProfiles],
        workspace: current.workspace ?? backup.data.workspace ?? null,
        lastDeletedId: lastDel ? String(lastDel) : (current.lastDeletedId ?? null),
      },
      summary: { ...p, profilesAdded: addedProfiles.length, profilesIdentical, profilesConflict, workspaceFromBackup: current.workspace == null && backup.data.workspace != null, workspaceConflict },
    };
  }

  /* ── กู้คืนแบบ transaction (Claude 15 พ.ย.) ──
   * localStorage ไม่มี transaction จริง จึงใช้ write-ahead journal + อ่านกลับตรวจ + ย้อนกลับเมื่อพลาด:
   *   1) มี journal ค้างอยู่ = ปฏิเสธ (ต้องย้อนกลับก่อน)  2) จด journal (ค่าเดิมของทุก key ที่จะเขียน) ก่อนเขียนจริง
   *   3) เขียนทีละ key แล้วอ่านกลับเทียบ  4) พลาดข้อใดข้อหนึ่ง = ย้อนกลับค่าเดิมทั้งหมดแล้วลบ journal  5) ผ่านครบจึงลบ journal
   * ถ้าแท็บ/เบราว์เซอร์ดับกลางทาง journal ยังอยู่ → recover() ย้อนกลับได้ภายหลัง (ไม่ย้อนอัตโนมัติ ให้ผู้ใช้เลือก)
   * ข้อจำกัด: ย้อนกลับเองก็เขียน storage — ถ้าพื้นที่เต็มหรือถูกบล็อกจนย้อนไม่สำเร็จ จะคง journal ไว้และแจ้งชัดเจน */
  const JOURNAL_KEY = 'laong.restoreJournal.v1';

  function readJournal(storage) {
    const text = storage.getItem(JOURNAL_KEY);
    if (text === null) return { exists: false };
    try {
      const j = JSON.parse(text);
      if (!isObj(j) || !Array.isArray(j.before) || j.before.some(e => !Array.isArray(e) || typeof e[0] !== 'string' || !(e[1] === null || typeof e[1] === 'string'))) return { exists: true, valid: false };
      return { exists: true, valid: true, journal: j };
    } catch { return { exists: true, valid: false }; }
  }

  function applyBefore(storage, before) {
    const failed = [];
    for (const [key, value] of before) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { failed.push(key); }
    }
    // อ่านกลับเพื่อยืนยันว่าย้อนกลับสำเร็จจริง
    for (const [key, value] of before) { if (storage.getItem(key) !== value && !failed.includes(key)) failed.push(key); }
    return failed;
  }

  /* writes: [[key, string|null]] — ข้ามรายการที่ค่าเท่าเดิมอยู่แล้ว */
  function transact(storage, writes, now = new Date()) {
    const pending = readJournal(storage);
    if (pending.exists) return { ok: false, changed: false, error: 'มีการกู้คืนที่ค้างอยู่จากครั้งก่อน · ต้องย้อนกลับก่อนจึงจะกู้คืนใหม่ได้' };
    const todo = writes.filter(([key, value]) => storage.getItem(key) !== value);
    if (!todo.length) return { ok: true, changed: false, keys: [] };
    const before = todo.map(([key]) => [key, storage.getItem(key)]);
    try { storage.setItem(JOURNAL_KEY, JSON.stringify({ startedAt: now.toISOString(), before })); }
    catch { return { ok: false, changed: false, error: 'เริ่มกู้คืนไม่ได้ (บันทึกจุดย้อนกลับไม่สำเร็จ) · ยังไม่มีข้อมูลถูกเปลี่ยน' }; }
    let failure = null;
    for (const [key, value] of todo) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
      catch { failure = `เขียน ${key} ไม่สำเร็จ`; break; }
    }
    if (!failure) {
      const bad = todo.find(([key, value]) => storage.getItem(key) !== value);
      if (bad) failure = `อ่านกลับ ${bad[0]} แล้วไม่ตรงกับที่เขียน`;
    }
    if (!failure) {
      try { storage.removeItem(JOURNAL_KEY); } catch { /* journal ที่เหลือ = ผู้ใช้ย้อนกลับได้ แต่ข้อมูลที่กู้ถูกต้องแล้ว */ }
      return { ok: true, changed: true, keys: todo.map(([key]) => key) };
    }
    const stuck = applyBefore(storage, before);
    if (stuck.length) return { ok: false, changed: true, rolledBack: false, error: `${failure} และย้อนกลับไม่ครบ (${stuck.join(', ')}) · เก็บจุดย้อนกลับไว้ ห้ามกู้คืนซ้ำจนกว่าจะย้อนกลับสำเร็จ` };
    try { storage.removeItem(JOURNAL_KEY); } catch { /* ค่ากลับเท่าเดิมแล้ว */ }
    return { ok: false, changed: false, rolledBack: true, error: `${failure} · ย้อนกลับค่าเดิมทั้งหมดแล้ว ข้อมูลไม่เปลี่ยน` };
  }

  /* ย้อนกลับจาก journal ที่ค้าง (เรียกเมื่อผู้ใช้กดเอง) */
  function recover(storage) {
    const j = readJournal(storage);
    if (!j.exists) return { ok: true, recovered: false };
    if (!j.valid) return { ok: false, recovered: false, error: 'จุดย้อนกลับเสียหาย · ไม่ลบอัตโนมัติ ให้ตรวจข้อมูลด้วยตนเอง' };
    const stuck = applyBefore(storage, j.journal.before);
    if (stuck.length) return { ok: false, recovered: false, error: `ย้อนกลับไม่ครบ (${stuck.join(', ')}) · คงจุดย้อนกลับไว้` };
    try { storage.removeItem(JOURNAL_KEY); } catch { return { ok: false, recovered: true, error: 'ย้อนกลับข้อมูลแล้ว แต่ลบจุดย้อนกลับไม่ได้' }; }
    return { ok: true, recovered: true, startedAt: j.journal.startedAt, keys: j.journal.before.map(e => e[0]) };
  }

  /* แทนที่ทั้งหมด (ใช้กับการย้อนกลับจากสำเนาก่อนกู้คืนเท่านั้น) */
  function replace(backup) {
    return { runs: backup.data.runs, profiles: backup.data.profiles, workspace: backup.data.workspace, lastDeletedId: backup.data.lastDeletedId };
  }

  /* แปลงผลเป็นรายการเขียนลง storage: null = ลบ key (ไม่มีในต้นทาง) */
  function toWrites(result) {
    return [
      [KEYS.runs, result.runs === null ? null : JSON.stringify(result.runs)],
      [KEYS.lastDeletedId, result.lastDeletedId === null || result.lastDeletedId === undefined ? null : String(result.lastDeletedId)],
      [KEYS.workspace, result.workspace === null ? null : JSON.stringify(result.workspace)],
      [KEYS.profiles, result.profiles === null ? null : JSON.stringify(result.profiles)],
    ];
  }

  globalThis.LAONG_BACKUP = Object.freeze({ FORMAT, VERSION, KEYS, JOURNAL_KEY, canonical, collect, build, validate, runProblem, workspaceProblem, plan, merge, replace, toWrites, isConfidential, transact, recover, readJournal });
})();
