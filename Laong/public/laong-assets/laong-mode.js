/* Laong — โหมดของแอป กำหนดจาก origin เท่านั้น (ห้ามสลับด้วยปุ่มหรือการตั้งค่า)
 * แต่ละ origin มี localStorage แยกกันโดยเบราว์เซอร์ ข้อมูล TEST กับโหมดจริงจึงไม่ปนกัน
 *   127.0.0.1:19012 / 19013 → test   : ข้อมูลจำลอง ติด demo:true, มีรันตัวอย่างและเครื่องมือทีมพัฒนา
 *   127.0.0.1:19020         → real   : โหมดจริงในสำเนาพัฒนา (dev-preview) — ยังไม่อนุมัติให้นักศึกษาใช้
 *   host อื่นที่ไม่ใช่ 127.0.0.1 → web : เว็บต้นแบบ มีทำนาย/นาฬิกา + โปรไฟล์เครื่องที่ build ฝังไว้ (ไม่มีสะพานทีมพัฒนา/สำรอง TEST)
 *   127.0.0.1 พอร์ตอื่น       → other  : พฤติกรรมเดิมของ Laong (หน้าพรีวิว) ไม่โหลดสมการ/นาฬิกา
 */
'use strict';
(() => {
  function detect(loc) {
    const host = loc && loc.hostname, port = loc && loc.port;
    if (host === '127.0.0.1' && (port === '19012' || port === '19013')) {
      return { mode: 'test', environment: 'dev-test', label: 'TEST · ข้อมูลจำลอง', dataOrigin: 'test' };
    }
    if (host === '127.0.0.1' && port === '19020') {
      return { mode: 'real', environment: 'dev-preview', label: 'โหมดจริง · สำเนาพัฒนา (ยังไม่อนุมัติใช้งาน)', dataOrigin: 'real' };
    }
    if (host && host !== '127.0.0.1' && host !== '[::1]' && host !== '::1') {
      // เว็บต้นแบบ (localhost:พอร์ตอื่น หรือโดเมนที่ host ให้): ทำนาย/นาฬิกาใช้ได้ ข้อมูลเก็บในเบราว์เซอร์ของผู้ใช้ ติดป้ายต้นแบบ
      return { mode: 'web', environment: 'web-prototype', label: 'เว็บต้นแบบ · ข้อมูลเก็บในเบราว์เซอร์นี้', dataOrigin: 'test' };
    }
    return { mode: 'other', environment: 'unknown', label: 'พรีวิว', dataOrigin: null };
  }
  // LaOng (Vite): แอปของเราใช้ได้ทุก origin นอกจากพอร์ตทดสอบของทีมปลื้ม เปิดทำนายและนาฬิกาเหมือนโหมด web
  // แต่ไม่ซ่อนเมนู (บทบาทคุมเอง) และยังไม่มีฐานข้อมูลย้อนหลังฝั่งเซิร์ฟเวอร์ (historyApi: false)
  function detectLaong(loc) {
    const d = detect(loc);
    if (d.mode === 'test' || d.mode === 'real') return { ...d, sharedView: d.mode !== 'test', historyApi: true };
    return { mode: 'web', environment: 'laong-vite', label: 'ต้นแบบ · ข้อมูลเก็บในเบราว์เซอร์นี้', dataOrigin: 'test', sharedView: false, historyApi: false };
  }
  // หน้าที่ซ่อนจากเมนูในเว็บที่แจกผู้อื่น (ไม่ใช่ TEST): ยังเข้าได้ด้วย URL ตรง ๆ ไม่มีการลบโค้ดหรือข้อมูล
  const HIDDEN_WHEN_SHARED = Object.freeze(['machines', 'monitor', 'admin', 'admin-users', 'admin-machines', 'admin-monitor', 'admin-audit', 'admin-formula', 'executive', 'executive-reports']);
  const current = Object.freeze(detectLaong(globalThis.location));
  globalThis.LAONG_MODE = Object.freeze({ ...current, hiddenWhenShared: HIDDEN_WHEN_SHARED, detect });
})();
