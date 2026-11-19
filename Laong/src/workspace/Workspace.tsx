// โครงพื้นที่ทำงาน: หัวหน้า เมนูซ้ายแบบกลุ่มพับได้ และพื้นผิวของสคริปต์สมุดบันทึกเดิม
// พฤติกรรมเลียนแบบ laong.vercel.app ทุกจุด (กลุ่มเปิดทีละกลุ่ม เปิดกลุ่มของหน้าปัจจุบันให้เอง ปุ่มเมนูบนจอแคบ ปิดด้วย Escape)
// ต่างจาก Vercel ตรงที่ใช้ hash (#runs) แทน path เพื่อให้เปิดจากโฮสต์ไฟล์ธรรมดาได้
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import legacyBody from './legacy-body.html?raw';
import { enterDetails, pageIn } from './motion';

type Link = [key: string, label: string];
type Group = { label: string; icon: ReactNode; links: Link[] };

/* ไอคอนเส้นแบบเดียวกับ lucide (เส้น 1.65) วาดเองให้ไม่ต้องลงไลบรารี */
const svg = (d: ReactNode, size = 18) => (
  <svg className="stitch-nav-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  sun: svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>),
  calendar: svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  clipboard: svg(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>),
  flask: svg(<><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" /><path d="M6.453 15h11.094M8.5 2h7" /></>),
  chart: svg(<><path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" /></>),
  shield: svg(<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>),
  bell: svg(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  menu: svg(<path d="M4 6h16M4 12h16M4 18h16" />),
  close: svg(<path d="M18 6 6 18M6 6l12 12" />),
  chevron: svg(<path d="m6 9 6 6 6-6" />, 17),
  logout: svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>, 16),
};

const GROUPS: Group[] = [
  { label: 'งานทดลอง', icon: I.clipboard, links: [['runs', 'รายการทดลอง'], ['templates', 'แบบฟอร์ม'], ['history', 'ประวัติและรายงาน']] },
  { label: 'ห้องแล็บ', icon: I.flask, links: [['machines', 'ทะเบียนเครื่อง'], ['monitor', 'ติดตามเครื่อง']] },
  { label: 'การจัดการ', icon: I.chart, links: [['executive', 'ภาพรวมผู้บริหาร'], ['executive-reports', 'รายงานผู้บริหาร'], ['admin-monitor', 'การแชร์ข้อมูล'], ['settings', 'ตั้งค่า']] },
  { label: 'พรีวิว Admin', icon: I.shield, links: [['admin', 'ภาพรวม Admin'], ['admin-users', 'ผู้ใช้'], ['admin-machines', 'ทะเบียนเครื่ององค์กร'], ['admin-audit', 'ประวัติการจัดการ'], ['admin-formula', 'คลังสูตรและเอกสาร']] },
];
const TITLES: Record<string, string> = Object.fromEntries([['today', 'วันนี้'], ['calendar', 'ปฏิทินแล็บ'], ['notifications', 'แจ้งเตือน'], ...GROUPS.flatMap((g) => g.links)]);

/** หน้าปัจจุบันจาก hash (#run/R-018 นับเป็นรายการทดลอง) */
function readKey(): string {
  const name = window.location.hash.slice(1).split('?')[0].split('/')[0] || 'today';
  return name === 'run' ? 'runs' : name;
}
const groupOf = (key: string) => GROUPS.find((g) => g.links.some(([k]) => k === key))?.label ?? null;

/* พื้นผิวของสคริปต์เดิม: เรนเดอร์ครั้งเดียว ห้าม React แตะอีก เพราะสคริปต์เขียน DOM ข้างในเอง */
const LegacySurface = memo(function LegacySurface() {
  return <div className="legacy-surface" dangerouslySetInnerHTML={{ __html: legacyBody }} />;
});

// ลำดับเดียวกับงานของปลื้ม (workspace.tsx): โหมด → โปรไฟล์สาธิต → สมการ/ทำนาย/นาฬิกา/สำรอง → กราฟรัน/ไฟล์รัน → หน้าจอเดิม
// ไม่โหลด integration-timer-bridge และ laong-backup-preview (เครื่องมือทีมพัฒนาเฉพาะพอร์ต TEST ของปลื้ม)
const SCRIPTS = [
  'laong-mode', 'integration-demo-config', 'integration-test-physics', 'run-prediction', 'run-capture', 'laong-clock', 'laong-backup',
  'laong-insights', 'laong-runchart', 'laong-runfile',
  'reports', 'workspace', 'calendar', 'previews', 'admin', 'monitor', 'mascot', 'app',
];
let loading: Promise<void> | null = null;
function loadLegacy(): Promise<void> {
  loading ??= (async () => {
    for (const name of SCRIPTS) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `laong-assets/${name}.js`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(name));
        document.body.append(s);
      });
    }
  })();
  return loading;
}

function NavGroup({ group, current, open, onOpenChange, onNavigate }: { group: Group; current: string; open: boolean; onOpenChange: (o: boolean) => void; onNavigate: () => void }) {
  const id = `grp-${group.label}`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.toggleAttribute('inert', !open); }, [open]);
  return (
    <div className="stitch-group" data-state={open ? 'open' : 'closed'}>
      <button type="button" className="stitch-trigger" data-state={open ? 'open' : 'closed'} aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>
        <span className="stitch-trigger-label">{group.icon}{group.label}</span>
        <span className="stitch-chevron">{I.chevron}</span>
      </button>
      <div className="stitch-disclosure" id={id} ref={ref} aria-hidden={!open} data-open={open}>
        <div className="stitch-disclosure-inner">
          <div className="stitch-links">
            {group.links.map(([key, label]) => (
              <a key={key} href={`#${key}`} className="nav-link" aria-current={key === current ? 'page' : undefined} onClick={onNavigate}>{label}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Workspace() {
  const [key, setKey] = useState(readKey);
  const [menu, setMenu] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(groupOf(readKey()));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setOpenGroup(groupOf(key)); }, [key]);

  useEffect(() => {
    let first = true;
    loadLegacy().then(() => {
      setReady(true);
      const main = document.querySelector<HTMLElement>('main#content');
      if (main && first) requestAnimationFrame(() => enterDetails(main));
      first = false;
    }, () => setFailed(true));
    const onHash = () => {
      setKey(readKey());
      setMenu(false);
      // สคริปต์เดิมเรนเดอร์ใหม่ในตัวฟัง hashchange ของมันเอง รอหนึ่งเฟรมแล้วค่อยเล่นจังหวะเข้า
      requestAnimationFrame(() => {
        const main = document.querySelector<HTMLElement>('main#content');
        if (!main) return;
        pageIn(main);
        enterDetails(main);
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const close = () => setMenu(false);
  const signOut = () => {
    try { localStorage.setItem('proto_session', 'null'); } catch { /* ไม่เป็นไร */ }
    window.location.replace('./#/welcome');
  };

  return (
    <div className="stitch-frame">
      <header className="stitch-header">
        <button type="button" className="stitch-menu button" aria-expanded={menu} aria-controls="stitch-sidebar" aria-label={menu ? 'ปิดเมนู' : 'เปิดเมนู'} onClick={() => setMenu((m) => !m)}>
          {menu ? I.close : I.menu}
        </button>
        <span className="stitch-context">
          {I.flask} {key.startsWith('admin') ? 'พรีวิว Admin' : 'พื้นที่ทำงาน'} <span aria-hidden="true">/</span> <strong>{TITLES[key] ?? 'วันนี้'}</strong>
        </span>
        <a className="button subtle stitch-bell" href="#notifications" aria-label="แจ้งเตือน">{I.bell}</a>
      </header>
      <aside className="stitch-rail" data-visible={menu} id="stitch-sidebar" onKeyDown={(e) => { if (e.key === 'Escape') { close(); document.querySelector<HTMLElement>('.stitch-menu')?.focus(); } }}>
        <a href="#today" className="brand" onClick={close}>
          <img src="laong-assets/icons/laong.svg" alt="" />
          <span>LaOng <small>ละออง</small></span>
        </a>
        <nav aria-label="เมนูหลัก LaOng">
          <a href="#today" className="nav-link" aria-current={key === 'today' ? 'page' : undefined} onClick={close}>{I.sun}{TITLES.today}</a>
          <a href="#calendar" className="nav-link" aria-current={key === 'calendar' ? 'page' : undefined} onClick={close}>{I.calendar}{TITLES.calendar}</a>
          {GROUPS.map((g) => (
            <NavGroup key={g.label} group={g} current={key} open={openGroup === g.label} onOpenChange={(o) => setOpenGroup(o ? g.label : null)} onNavigate={close} />
          ))}
        </nav>
        <div className="stitch-note">
          <p>สมุดบันทึกการทดลอง<br />ข้อมูลอยู่ในเบราว์เซอร์นี้</p>
          <button type="button" className="stitch-out" onClick={signOut}>{I.logout}ออกจากระบบ</button>
        </div>
      </aside>
      <div className="stitch-content">
        {!ready ? <p className="panel panel-pad stitch-loading" role={failed ? 'alert' : 'status'}>{failed ? 'เปิดพื้นที่ทำงานไม่ได้ กรุณาโหลดหน้าใหม่' : 'กำลังเปิดพื้นที่ทำงาน'}</p> : null}
        <LegacySurface />
      </div>
    </div>
  );
}
