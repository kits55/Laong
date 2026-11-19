// router แบบ hash (#/pre) ไม่ต้องตั้งค่า server และเปิดจากโฟลเดอร์ได้
import { useEffect, useState } from 'react';

export type Path = '/login' | '/welcome' | '/how' | '/' | '/pre' | '/run' | '/post' | '/history' | '/report' | '/advanced' | '/workspace' | '/companion';
const PATHS: Path[] = ['/login', '/welcome', '/how', '/', '/pre', '/run', '/post', '/history', '/report', '/advanced', '/workspace', '/companion'];

function current(): Path {
  const h = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
  return (PATHS as string[]).includes(h) ? (h as Path) : '/';
}

export function go(path: Path) {
  if (window.location.hash === `#${path}`) return;
  window.location.hash = path;
}

export function useRoute(): Path {
  const [p, setP] = useState<Path>(current());
  useEffect(() => {
    const on = () => setP(current());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return p;
}

export const STEP_PATHS: { path: Path; n: number; title: string; sub: string; readOnly?: boolean }[] = [
  { path: '/pre', n: 1, title: 'ก่อนทดลอง', sub: 'ประเมิน Tout และวางแผน' },
  { path: '/run', n: 2, title: 'ระหว่างทดลอง', sub: 'จับเวลาและจดค่า' },
  { path: '/post', n: 3, title: 'หลังทดลอง', sub: 'สมดุลมวลและผลแล็บ' },
  { path: '/history', n: 4, title: 'ประวัติ', sub: 'ทบทวนและเทียบผล', readOnly: true },
  { path: '/report', n: 5, title: 'รายงาน', sub: 'ส่งออกและพิมพ์', readOnly: true },
];
