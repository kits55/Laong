import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' ให้เปิดจากโฟลเดอร์ไหนก็ได้ และใช้ hash routing จึงไม่ต้องตั้งค่า server เพิ่ม
// สองหน้า: index.html (หน้าแรกและเข้าสู่ระบบ) และ app.html (พื้นที่ทำงานแบบเดียวกับ laong.vercel.app)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app.html') },
    },
  },
});
