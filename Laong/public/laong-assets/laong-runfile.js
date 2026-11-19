/* Laong — ไฟล์ส่งออกรัน (JSON) ของผู้ใช้
 * ส่งออกเป็นไฟล์ในเครื่องผู้ใช้เท่านั้น ไม่ส่งไปที่ใด ไม่มีเซิร์ฟเวอร์เกี่ยวข้อง
 * ฟังก์ชันบริสุทธิ์ (ไม่แตะ DOM/ที่เก็บข้อมูล) เพื่อทดสอบนอกเบราว์เซอร์ได้
 * หมายเหตุ: รูปแบบนี้เป็นของ Laong (kind = laong-run-export) ยังไม่ใช่รูปแบบ saved-run ของแอปทีมเดิม และยังไม่มีฟังก์ชันนำเข้า */
'use strict';
(() => {
  const KIND = 'laong-run-export', VERSION = 1;
  const NOTICE = 'ไฟล์นี้ส่งออกจากเว็บทดลอง Laong เก็บไว้ในเครื่องของคุณเท่านั้น ยังไม่ได้ส่งให้ใคร และยังไม่ผ่านเกณฑ์เข้าฐานข้อมูลอ้างอิงของทีม';
  const safe = s => String(s ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const pad = n => String(n).padStart(2, '0');
  const stamp = now => { const d = new Date(now); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`; };

  /* ใช้เฉพาะรันที่มีโครงสร้างพื้นฐานครบ (id เป็นข้อความ) — สำเนาลึก ไม่แก้ต้นฉบับ */
  function build(runs, meta = {}, now = new Date()) {
    const list = (Array.isArray(runs) ? runs : []).filter(r => r && typeof r === 'object' && !Array.isArray(r) && typeof r.id === 'string' && r.id !== '');
    return {
      kind: KIND, version: VERSION, exportedAt: new Date(now).toISOString(),
      source: { app: 'Laong', mode: meta.mode || 'unknown', label: meta.label || null },
      notice: NOTICE,
      consentToShare: false,   // ยังไม่มีการให้ความยินยอมส่งข้อมูลให้ทีม — ค่านี้ต้องเป็น false เสมอในไฟล์ที่ผู้ใช้ส่งออกเอง
      runs: JSON.parse(JSON.stringify(list)),
    };
  }

  function fileName(runs, now = new Date()) {
    const list = Array.isArray(runs) ? runs : [];
    return list.length === 1 ? `laong-run-${safe(list[0]?.id) || 'run'}-${stamp(now)}.json` : `laong-runs-${list.length}-${stamp(now)}.json`;
  }

  globalThis.LaongRunFile = Object.freeze({ KIND, VERSION, NOTICE, build, fileName, text: obj => JSON.stringify(obj, null, 2) });
})();
