import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// ฟอนต์ติดไปกับแอป (ไม่ดึงจาก Google Fonts) เพื่อไม่ให้มี request ออกนอกเครื่อง
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/500.css';
import '@fontsource/anuphan/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '../design-system/tokens.generated.css';
import '../design-system/components/bundle.css';
import './styles/app.css';
import './styles/v3.css';
import './styles/v4.css';
import './styles/v5.css';
import './styles/v6.css';
import './styles/v7.css';
import './styles/v8.css';
import App from './app/App';

// หยุดละอองตกแต่งเมื่อแท็บไม่ได้เปิดอยู่ ไม่กินแรงเครื่องเปล่า ๆ
document.addEventListener('visibilitychange', () => { document.documentElement.dataset.idle = document.hidden ? '1' : '0'; });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: ลงทะเบียน service worker เฉพาะตอน build จริง ให้เปิดใช้ออฟไลน์ได้
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* ไม่รองรับก็ใช้งานต่อได้ */ });
  });
}
