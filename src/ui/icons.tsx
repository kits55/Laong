// ไอคอนเส้นชุดเดียวกันทั้งแอป (เส้น 1.75, ปลายมน) วาดเป็น SVG เอง ไม่ใช้ไฟล์ภาพ
import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10.5V19h12v-8.5" /><path d="M10 19v-5h4v5" /></>,
  flask: <><path d="M9.5 4h5" /><path d="M10.5 4v5.2L5.6 17.4A1.8 1.8 0 0 0 7.2 20h9.6a1.8 1.8 0 0 0 1.6-2.6L13.5 9.2V4" /><path d="M8 14.5h8" /></>,
  timer: <><circle cx="12" cy="13.5" r="6.5" /><path d="M12 13.5V10" /><path d="M10 3.5h4" /><path d="m17.5 7 1.2-1.2" /></>,
  clipboard: <><rect x="6" y="5" width="12" height="15" rx="2" /><path d="M9.5 5V4h5v1" /><path d="m9 13 2 2 4-4.5" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" /><path d="M4.5 5v3.5H8" /><path d="M12 8v4.2l2.8 1.8" /></>,
  report: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4" /><path d="M9.5 12.5h5M9.5 15.5h5" /></>,
  wrench: <><path d="M14.5 6.5a4 4 0 0 0-5.2 5L4.5 16.3a1.7 1.7 0 0 0 2.4 2.4l4.8-4.8a4 4 0 0 0 5-5.2l-2.4 2.4-2-.6-.6-2z" /></>,
  eye: <><path d="M2.8 12S6 6.5 12 6.5 21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.6" /></>,
  spark: <><path d="M12 4v4M12 16v4M4 12h4M16 12h4" /><path d="m7 7 2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" /></>,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c.8-3.4 3.6-5 7-5s6.2 1.6 7 5" /></>,
  menu: <><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></>,
  download: <><path d="M12 4v10" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></>,
  upload: <><path d="M12 15V5" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 19.5h14" /></>,
  print: <><path d="M7 9V4h10v5" /><rect x="4.5" y="9" width="15" height="8" rx="1.5" /><path d="M7 14h10v6H7z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="M8 5.5v13l11-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />,
  alert: <><path d="M12 4 3.5 19h17z" /><path d="M12 10v4.5M12 17v.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></>,
  camera: <><path d="M4.5 8h3l1.3-2h6.4l1.3 2h3v11h-15z" /><circle cx="12" cy="13" r="3.3" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3.5v3.5M14 3.5v3.5M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5" /></>,
  chart: <><path d="M4.5 4.5v15h15" /><path d="m8 15 3-4 3 2.5 4-6" /></>,
  book: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v15H6.5A1.5 1.5 0 0 0 5 20.5z" /><path d="M5 20.5A1.5 1.5 0 0 1 6.5 19H19" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  logout: <><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" /><path d="M14 8.5 17.5 12 14 15.5M17.5 12H9.5" /></>,
  back: <path d="M12 5 5 12l7 7M5 12h14" />,
  edit: <><path d="M5 19.5 6 15l9-9 3 3-9 9z" /><path d="m13.5 7.5 3 3" /></>,
  trash: <><path d="M5.5 7h13M9.5 7V4.5h5V7" /><path d="m7 7 1 12.5h8L17 7" /></>,
  save: <><path d="M5.5 4.5h10l3 3v12h-13z" /><path d="M8.5 4.5v4h6v-4M8.5 19.5v-6h7v6" /></>,
  refresh: <><path d="M19 12a7 7 0 1 1-2.2-5.1" /><path d="M19 5v4h-4" /></>,
  drop: <path d="M12 4c3 3.6 5.5 6.5 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 10.5 9 7.6 12 4z" />,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.5 6.9A9 9 0 0 1 12 6.5c6 0 9.2 5.5 9.2 5.5a14 14 0 0 1-3.1 3.6M6.4 8.3A14 14 0 0 0 2.8 12S6 17.5 12 17.5c1.2 0 2.3-.2 3.3-.6" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" /></>,
  wifi: <><path d="M4 9.5a12 12 0 0 1 16 0" /><path d="M7 13a8 8 0 0 1 10 0" /><path d="M10 16.5a4 4 0 0 1 4 0" /><path d="M12 19.5v.01" /></>,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4 4" /></>,
  plug: <><path d="M9 4v5M15 4v5" /><path d="M6.5 9h11v3a5.5 5.5 0 0 1-11 0z" /><path d="M12 17.5V21" /></>,
  share: <><circle cx="6.5" cy="12" r="2.2" /><circle cx="17" cy="6.5" r="2.2" /><circle cx="17" cy="17.5" r="2.2" /><path d="m8.4 11 6.7-3.4M8.4 13l6.7 3.4" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
