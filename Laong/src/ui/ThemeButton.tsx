// ปุ่มเปลี่ยนธีม ใช้ร่วมกันทั้งหน้า landing และในแอป
// สลับสองสถานะที่มองเห็นจริง (สว่าง/มืด) กดครั้งเดียวเปลี่ยนทันที
// ไอคอนบอกธีมที่เห็นอยู่ตอนนี้ แม้ค่าที่เก็บไว้จะเป็น "ตามเครื่อง" ก็ตาม
import { useEffect, useState } from 'react';
import { setState, useAppState } from '../data/store';
import { Icon } from './icons';

/** ธีมที่แสดงจริง: ถ้าตั้งเป็น auto ให้ดูจากเครื่อง */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useAppState((s) => s.theme);
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return theme === 'auto' ? (sysDark ? 'dark' : 'light') : theme;
}

export function ThemeButton() {
  const shown = useResolvedTheme();
  const next = shown === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด';
  return (
    <button type="button" className="ld-btn iconbtn" onClick={() => setState({ theme: next })} aria-label={label} title={label}>
      <Icon name={shown === 'dark' ? 'moon' : 'sun'} size={18} />
    </button>
  );
}
