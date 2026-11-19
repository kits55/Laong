/* Laong — ชั้นเชื่อมนาฬิการัน (pure: ไม่มี DOM, ไม่มี storage)
 * - การเปลี่ยนสถานะทั้งหมดผ่าน RUN_CAPTURE.transition จาก run-capture.js ซึ่งเป็นสำเนา byte ต่อ byte
 *   ของระบบเดิม (ตรวจ SHA-256 ใน test) — ห้ามคำนวณเวลาหรือเปลี่ยนสถานะเองที่นี่
 * - กฎเปิด/ปิดปุ่ม คัดลอกจาก paintTimer() ใน js/run-protocol.js ของระบบเดิม
 * - ขั้นย่อย 1: ยังไม่ได้ย้าย guard ก่อนเริ่มของระบบเดิมครบ (ล็อก baseline, snapshot ก่อนรัน,
 *   Atomizing air), Segment, เหตุการณ์พักพร้อมระดับความรุนแรง, การผูกเวลากับค่าที่จด และปุ่มล้างนาฬิกา
 */
'use strict';
(() => {
  const CAPTURE_FILE = 'run-capture.js';
  const CAPTURE_SHA256 = '7f39883892e786e18427a3f731af6e7e4a547fa9dab1a3fe50a4996c36f167ae';
  const ACTIONS = Object.freeze(['start_run', 'start_feed', 'pause', 'resume', 'feed_exhausted', 'stop_run']);
  // จาก paintTimer() ของระบบเดิม: ปุ่มไหนกดได้ในสถานะไหน
  const ENABLED_IN = Object.freeze({
    start_run: ['idle'], start_feed: ['idle', 'warmup'], pause: ['feeding'], resume: ['paused'],
    feed_exhausted: ['feeding', 'paused'], stop_run: ['warmup', 'feeding', 'paused', 'post_feed'],
  });
  const ACTION_LABELS = Object.freeze({
    start_run: 'เริ่มรัน / Warm-up', start_feed: 'เริ่มป้อน', pause: 'พัก / ป้อนสะดุด',
    resume: 'ป้อนต่อ', feed_exhausted: 'ป้อนเสร็จ (สารหมด)', stop_run: 'จบรัน',
  });
  const STATUS_LABELS = Object.freeze({
    idle: 'ยังไม่เริ่ม', warmup: 'Warm-up', feeding: 'กำลังป้อน', paused: 'พัก', post_feed: 'หลังป้อน', stopped: 'จบแล้ว',
  });
  const NOT_PORTED = Object.freeze([
    'guard ก่อนเริ่มของระบบเดิม: ล็อก baseline, snapshot ก่อนรัน และ Atomizing air (Laong ยังไม่มีช่องนี้)',
    'Segment ของการป้อน และการปิด Segment เมื่อป้อนเสร็จ/จบรัน',
    'บันทึกเหตุการณ์พักพร้อมชนิดและระดับความรุนแรง (ตอนนี้เก็บเฉพาะเวลาที่กดพัก/ป้อนต่อ)',
    'การผูกเวลานาฬิกากับค่า Tin/Tout ที่จด และการเลือกช่วง steady state',
    'ปุ่มล้างนาฬิกาสำหรับรันจริง (มีเฉพาะรัน TEST ในรายละเอียดวิจัย และเก็บนาฬิกาเดิมเป็นประวัติ)',
  ]);

  const isObj = v => v !== null && typeof v === 'object';
  const textOk = v => typeof v === 'string' && v.trim() !== '';

  /* guard ของ Laong ก่อนเปลี่ยนสถานะ คืนข้อความเหตุผล หรือ null ถ้าผ่าน */
  function guard(run, action) {
    if (!ACTIONS.includes(action)) return 'คำสั่งนาฬิกาไม่รองรับ';
    if (!isObj(run) || run.template !== 'spray') return 'นาฬิกาใช้ได้กับรัน Spray Dryer เท่านั้น';
    if (run.status === 'closed') return 'ปิดรันแล้ว แก้นาฬิกาไม่ได้';
    if (run.status !== 'running') return 'กด "เริ่มทดลอง" ของรันก่อน จึงเริ่มนาฬิกาได้';
    if (action === 'start_run' || action === 'start_feed') {
      const b = isObj(run.before) ? run.before : {};
      if (!textOk(b.goal)) return 'แผนยังไม่มีวัตถุประสงค์ · กรอกในช่วงก่อนทดลองก่อน';
      if (typeof b.tin !== 'number' || !Number.isFinite(b.tin)) return 'แผนยังไม่มีอุณหภูมิขาเข้า (Tin) · กรอกในช่วงก่อนทดลองก่อน';
    }
    return null;
  }

  function enabled(status, action) { return (ENABLED_IN[action] || []).includes(status); }

  /* เปลี่ยนสถานะผ่านนาฬิกาเดิม — ไม่สำเร็จ = ไม่เปลี่ยน (คืน error) */
  function apply(run, action, capture, now) {
    if (!capture || typeof capture.transition !== 'function') return { ok: false, error: 'นาฬิกายังไม่พร้อม (ไม่พบ run-capture.js)' };
    const blocked = guard(run, action);
    if (blocked) return { ok: false, error: blocked };
    const current = capture.normalize(run.feedClock, now);
    if (!enabled(current.status, action)) return { ok: false, error: `กด "${ACTION_LABELS[action]}" ไม่ได้ขณะสถานะ "${STATUS_LABELS[current.status] || current.status}"` };
    try { return { ok: true, clock: capture.transition(current, action, now) }; }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }

  function summary(run, capture, now) {
    if (!capture) return null;
    const snap = capture.snapshot(capture.normalize(run && run.feedClock, now), now);
    return snap;
  }

  /* ── ล้างนาฬิกา (เฉพาะรัน TEST) ──
   * ไม่ลบทิ้ง: ย้ายนาฬิกาเดิมไปเก็บใน run.clockResets พร้อมเหตุผลและสรุป แล้วเริ่มนาฬิกาใหม่ด้วย
   * RUN_CAPTURE.transition(..., 'reset') ของเดิม. ไม่แตะค่าที่จด, คำทำนาย, แผน หรือสถานะรัน */
  function resetGuard(run, capture, now) {
    if (!capture) return 'นาฬิกายังไม่พร้อม';
    if (!isObj(run) || run.template !== 'spray') return 'ใช้ได้กับรัน Spray Dryer เท่านั้น';
    if (run.demo !== true) return 'ล้างนาฬิกาได้เฉพาะรันทดสอบ (TEST) · รันจริงห้ามล้าง';
    if (run.status === 'closed') return 'ปิดรันแล้ว ล้างนาฬิกาไม่ได้';
    if (capture.normalize(run.feedClock, now).status === 'idle') return 'นาฬิกายังไม่เริ่ม ไม่มีอะไรให้ล้าง';
    return null;
  }

  function resetImpact(run, capture, now) {
    const blocked = resetGuard(run, capture, now);
    if (blocked) return { ok: false, error: blocked };
    const snap = capture.snapshot(capture.normalize(run.feedClock, now), now);
    return {
      ok: true,
      impact: {
        clockStatus: snap.status, transitions: snap.transitions.length,
        runElapsed_min: snap.runElapsed_min, activeFeeding_min: snap.activeFeeding_min,
        keptReadings: Array.isArray(run.logs) ? run.logs.length : 0,
        keptPredictions: Array.isArray(run.predictions) ? run.predictions.length : 0,
        previousResets: Array.isArray(run.clockResets) ? run.clockResets.length : 0,
      },
    };
  }

  function reset(run, reason, capture, now) {
    const plan = resetImpact(run, capture, now);
    if (!plan.ok) return plan;
    const why = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
    if (why.length < 3) return { ok: false, error: 'ต้องระบุเหตุผลที่ล้างนาฬิกา (อย่างน้อย 3 ตัวอักษร)' };
    const previous = capture.normalize(run.feedClock, now);
    const entry = Object.freeze({
      resetAt: new Date(now).toISOString(), reason: why, dataOrigin: 'test',
      summary: capture.snapshot(previous, now), clock: previous,
      provenance: 'operator_reset_test_only',
    });
    return {
      ok: true, impact: plan.impact,
      changes: { feedClock: capture.transition(previous, 'reset', now), clockResets: [...(Array.isArray(run.clockResets) ? run.clockResets : []), entry] },
    };
  }

  globalThis.LAONG_CLOCK = Object.freeze({
    CAPTURE_FILE, CAPTURE_SHA256, ACTIONS, ENABLED_IN, ACTION_LABELS, STATUS_LABELS, NOT_PORTED,
    guard, enabled, apply, summary, resetGuard, resetImpact, reset,
  });
})();
