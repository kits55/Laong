// พื้นที่ทำงานหลังเข้าสู่ระบบ: โครงเดียวกับ laong.vercel.app (เมนูซ้ายแบบกลุ่ม + สคริปต์สมุดบันทึกของ Codex)
// แยกเป็นหน้า app.html เพื่อไม่ให้สไตล์ของหน้าแรกกับสไตล์ของพื้นที่ทำงานชนกัน
import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/500.css';
import '@fontsource/anuphan/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './workspace.css';
import Workspace from './Workspace';
import { animateLaong } from './motion';

// สคริปต์เดิมใช้ React ตัวเดียวกับเรา (หน้าติดตามเครื่อง) และฟังก์ชันอนิเมชันกลาง
Object.assign(window, { React, ReactDOM: { createRoot }, animateLaong });

// แท็บถูกซ่อน: หยุดอนิเมชันที่วนของน้องละออง
document.addEventListener('visibilitychange', () => { document.documentElement.dataset.tabHidden = document.hidden ? '1' : '0'; });

createRoot(document.getElementById('workspace-root') as HTMLElement).render(
  <StrictMode>
    <Workspace />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* ใช้งานต่อได้ */ }); });
}
