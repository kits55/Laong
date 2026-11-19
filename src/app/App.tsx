// เปลือกแอป: แถบ 5 ขั้น (ld-steps) + หัวหน้า + แถบกู้ร่าง + ป้ายสถานะข้อมูลตัวอย่าง
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { go, STEP_PATHS, useRoute, type Path } from './router';
import { signOut, selectProfile, setState, useAppState, useDraftRestore } from '../data/store';
import { Icon, type IconName } from '../ui/icons';
import { LaongMark } from '../ui/droplets';
import { Btn } from '../ui/kit';
import { Select } from '../ui/overlay';
import { openDrawer } from '../data/ui';
import { MODES, modeInfo, type AudienceMode } from '../config/modes';
import { LINK_LABEL, useDevice } from '../device/link';
import SettingsDrawer from './SettingsDrawer';
import { fmtDateTime, fmtTime } from '../lib/util';
import Login from '../pages/Login';
import Landing, { HowPage } from '../pages/Landing';
import { ThemeButton } from '../ui/ThemeButton';
import MascotCorner from '../ui/MascotCorner';

/** หน้าที่ไม่แสดงน้องละออง: กำลังจดค่าระหว่างรัน (ไม่ให้เสียสมาธิ) และหน้าขั้นสูงที่มีคำเตือน */
const MASCOT_HIDDEN_ON: Path[] = ['/run', '/advanced'];
import Overview from '../pages/Overview';
import Pre from '../pages/Pre';
import RunPage from '../pages/Run';
import Post from '../pages/Post';
import History from '../pages/History';
import Report from '../pages/Report';
import Advanced from '../pages/Advanced';
import Workspace from '../pages/Workspace';
import Companion from '../pages/Companion';

const STEP_ICON: Record<string, IconName> = { '/pre': 'flask', '/run': 'timer', '/post': 'clipboard', '/history': 'history', '/report': 'report' };
/* หัวกลุ่มของเมนูซ้าย (จอกว้าง): แสดงก่อนขั้นแรกของแต่ละกลุ่ม */
const RAIL_GROUP: Partial<Record<Path, { label: string; icon: IconName }>> = {
  '/pre': { label: 'งานทดลอง', icon: 'flask' },
  '/history': { label: 'ประวัติและรายงาน', icon: 'history' },
};
const ROLE_LABEL ={ operator: 'ผู้ปฏิบัติงานหน้างาน', reviewer: 'ผู้ทบทวน', admin: 'ผู้ดูแลระบบ' } as const;

let deferredInstall: any = null;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; installListeners.forEach((l) => l()); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; installListeners.forEach((l) => l()); });
}

function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    installListeners.add(l);
    return () => { installListeners.delete(l); };
  }, []);
  return deferredInstall ? async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; installListeners.forEach((l) => l()); } : null;
}

function useTheme() {
  const theme = useAppState((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { root.dataset.theme = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme; };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return theme;
}

/* ชื่อหน้าสำหรับแถบตำแหน่งในหัวหน้า (หน้าขั้นตอนใช้ชื่อจาก STEP_PATHS) */
const PAGE_TITLE: Partial<Record<Path, string>> = { '/': 'วันนี้', '/advanced': 'ขั้นสูง', '/companion': 'ดูผลก่อนรัน', '/workspace': 'มุมมองอ่านอย่างเดียว' };

function StepLink({ path, n, title, sub, readOnly, current, done }: { path: Path; n: number; title: string; sub: string; readOnly?: boolean; current: boolean; done: boolean }) {
  const prev = useRef(done);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (!prev.current && done) { setPop(true); const t = setTimeout(() => setPop(false), 220); return () => clearTimeout(t); }
    prev.current = done;
  }, [done]);
  useEffect(() => { prev.current = done; });
  return (
    <li data-done={done && !readOnly ? 'true' : undefined}>
      <a className="ld-step" href={`#${path}`} data-state={current ? 'current' : done ? 'done' : 'todo'} aria-current={current ? 'step' : undefined} title={sub}>
        <span className={`ld-step__n ${pop ? 'pop' : ''}`}>{done && !readOnly ? '✓' : n}</span>
        <span>
          <span>{title}</span>
          <span className="ld-step__sub">{sub}</span>
        </span>
        <span className="step-ic" aria-hidden="true"><Icon name={STEP_ICON[path]} size={18} /></span>
      </a>
    </li>
  );
}

function DraftBar() {
  const draft = useAppState((s) => s.pendingDraft);
  const r = useDraftRestore();
  if (!draft) return null;
  return (
    <div className="draftbar" role="region" aria-label="กู้ร่าง">
      <div className="draftbar__t">
        <strong>พบร่างที่ยังไม่ได้ปิดรัน</strong>
        <span className="draftbar__s">บันทึกอัตโนมัติเมื่อ {fmtDateTime(draft.savedAt)}</span>
      </div>
      <div className="draftbar__a">
        <Btn variant="primary" icon="refresh" onClick={r.use}>ใช้ร่างนี้</Btn>
        <Btn onClick={r.discard} icon="trash">ทิ้งร่าง</Btn>
      </div>
    </div>
  );
}

function SavedToast() {
  const tick = useAppState((s) => s.savedTick);
  const at = useAppState((s) => s.savedAt);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!tick) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, [tick]);
  return (
    <div className="toastzone" aria-live="polite" role="status">
      {show && at ? <span className="toast"><Icon name="save" size={16} />บันทึกร่างแล้ว {fmtTime(at)}</span> : null}
    </div>
  );
}

function UserMenu({ route, canAdvanced, onInstall }: { route: Path; canAdvanced: boolean; onInstall: (() => void) | null }) {
  const session = useAppState((s) => s.session);
  const profiles = useAppState((s) => s.profiles);
  const activeId = useAppState((s) => s.activeProfileId);
  const mode = useAppState((s) => s.mode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [route]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!session) return null;
  const items: { path: Path; label: string; icon: IconName; hidden?: boolean; narrowOnly?: boolean }[] = [
    { path: '/', label: 'ภาพรวม', icon: 'home', narrowOnly: true },
    { path: '/companion', label: 'ดูผลก่อนรัน', icon: 'spark' },
    { path: '/workspace', label: 'มุมมองอ่านอย่างเดียว', icon: 'eye' },
    { path: '/advanced', label: 'ขั้นสูง', icon: 'wrench', hidden: !canAdvanced },
  ];
  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu__btn" aria-expanded={open} aria-haspopup="true" aria-controls="usermenu-panel" onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden="true">{session.name.slice(0, 1)}</span>
        <span className="usermenu__name">{session.name}</span>
        <Icon name="chevronDown" size={16} />
        <span className="sr-only">เมนูผู้ใช้</span>
      </button>
      {open ? (
        <div className="usermenu__panel" id="usermenu-panel">
          <div className="usermenu__who"><strong>{session.name}</strong><span>{ROLE_LABEL[session.role]} · โหมด{modeInfo(mode).label}</span></div>
          <div className="usermenu__machine">
            <span className="ld-label">โหมดผู้ใช้</span>
            <Select value={mode} onChange={(v) => setState({ mode: v as AudienceMode })} ariaLabel="โหมดผู้ใช้" options={MODES.map((m) => ({ value: m.value, label: m.label }))} />
          </div>
          <div className="usermenu__machine only-narrow">
            <span className="ld-label">เครื่องที่ใช้งาน</span>
            <Select value={activeId} onChange={selectProfile} ariaLabel="เครื่องที่ใช้งาน" options={profiles.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
          </div>
          <button className="usermenu__item" onClick={() => { setOpen(false); openDrawer('machine'); }}><Icon name="settings" size={18} />ตั้งค่าและช่วยเหลือ</button>
          <button className="usermenu__item only-narrow" onClick={() => { setOpen(false); openDrawer('board'); }}><Icon name="wifi" size={18} />บอร์ดและกล้อง</button>
          {items.filter((x) => !x.hidden).map((x) => (
            <a key={x.path} href={`#${x.path}`} className={`usermenu__item ${x.narrowOnly ? 'usermenu__item--home' : ''}`} aria-current={route === x.path ? 'page' : undefined}>
              <Icon name={x.icon} size={18} />{x.label}
            </a>
          ))}
          {onInstall ? <button className="usermenu__item" onClick={onInstall}><Icon name="download" size={18} />ติดตั้งแอป</button> : null}
          <button className="usermenu__item" onClick={() => { signOut(); go('/login'); }}><Icon name="logout" size={18} />ออกจากระบบ</button>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const route = useRoute();
  useTheme();
  const session = useAppState((s) => s.session);
  const done = useAppState((s) => s.cur.done);
  const profiles = useAppState((s) => s.profiles);
  const activeId = useAppState((s) => s.activeProfileId);
  const install = useInstall();
  const dev = useDevice();
  const mainRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);

  // แถบไฮไลต์ของเมนูซ้ายเลื่อนไปหาหน้าที่เปิดอยู่ (ตั้งตำแหน่งครั้งแรกโดยไม่เล่นอนิเมชัน)
  useLayoutEffect(() => {
    const nav = railRef.current;
    if (!nav) return;
    const place = () => {
      const cur = nav.querySelector<HTMLElement>('a[aria-current]');
      if (!cur || nav.offsetWidth === 0) { nav.removeAttribute('data-ind'); return; }
      const a = cur.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      nav.style.setProperty('--ind-x', `${a.left - n.left}px`);
      nav.style.setProperty('--ind-y', `${a.top - n.top + nav.scrollTop}px`);
      nav.style.setProperty('--ind-w', `${a.width}px`);
      nav.style.setProperty('--ind-h', `${a.height}px`);
      nav.setAttribute('data-ind', nav.hasAttribute('data-ready') ? 'on' : 'first');
      requestAnimationFrame(() => nav.setAttribute('data-ready', ''));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [route, session]);

  useEffect(() => {
    // ยังไม่เข้าสู่ระบบ: เปิดหน้า landing ก่อน แล้วค่อยไปหน้า Login
    if (!session && route !== '/login' && route !== '/welcome' && route !== '/how') go('/welcome');
    if (session && route === '/login') go('/');
  }, [session, route]);

  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  if (route === '/welcome') return <Landing />;
  if (route === '/how') return <HowPage />;
  if (!session || route === '/login') {
    if (session) { window.location.replace('./app.html#today'); return null; }
    return <Login />;
  }
  // เข้าสู่ระบบแล้ว: พื้นที่ทำงานอยู่ที่ app.html (โครงเดียวกับ laong.vercel.app)
  if (!window.location.search.includes('legacy')) { window.location.replace('./app.html#today'); return null; }

  return (
    <div className="ld-root app">
      <a className="skip" href="#main-content" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>ข้ามไปเนื้อหา</a>
      <div className="ld-shell appshell">
        <div className="ld-shell__frame">
          <nav className="ld-steps" aria-label="ขั้นตอนงาน" ref={railRef}>
            <span className="rail-ind" aria-hidden="true" />
            <a className="rail-brand" href="#/" aria-label="LaOng ละออง หน้าภาพรวม">
              <LaongMark size={28} />
              <span className="rail-brand__t"><strong>LaOng</strong><span>ละออง</span></span>
            </a>
            <a className="rail-home" href="#/" aria-current={route === '/' ? 'page' : undefined}><Icon name="home" size={18} />วันนี้</a>
            <ol>
              {STEP_PATHS.map((s) => (
                <Fragment key={s.path}>
                  {RAIL_GROUP[s.path] ? <li className="rail-label" aria-hidden="true"><Icon name={RAIL_GROUP[s.path]!.icon} size={18} />{RAIL_GROUP[s.path]!.label}</li> : null}
                  <StepLink {...s} current={route === s.path} done={s.n <= 3 ? done[s.n as 1 | 2 | 3] : false} />
                </Fragment>
              ))}
            </ol>
            <p className="rail-foot">สมุดบันทึกการทดลอง<br />ข้อมูลตัวอย่างอยู่ในเบราว์เซอร์</p>
          </nav>
          <main className="ld-shell__main" id="main-content" ref={mainRef} tabIndex={-1}>
            <header className="apphead">
              <a className="apphead__brand" href="#/" aria-label="LaOng หน้าภาพรวม"><LaongMark size={26} /><strong>LaOng</strong></a>
              <nav className="crumb" aria-label="ตำแหน่งหน้า"><span>พื้นที่ทำงาน</span><span aria-hidden="true">/</span><strong aria-current="page">{PAGE_TITLE[route] ?? STEP_PATHS.find((s) => s.path === route)?.title ?? 'วันนี้'}</strong></nav>
              <div className="apphead__right">
                <a className="ld-btn ld-btn--quiet home-link" href="#/" aria-current={route === '/' ? 'page' : undefined}><Icon name="home" size={18} />ภาพรวม</a>
                <div className="machinepick">
                  <Select value={activeId} onChange={selectProfile} ariaLabel="เครื่องที่ใช้งาน" minListWidth={260}
                    options={profiles.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
                </div>
                <button className="devpill" onClick={() => openDrawer('board')} aria-label={`บอร์ดและกล้อง สถานะ ${dev.enabled ? LINK_LABEL[dev.state] : 'ยังไม่เปิดใช้'}`}>
                  <span className="dot" data-s={dev.enabled ? dev.state : 'off'} aria-hidden="true" />
                  <span>บอร์ด</span>
                  <span className="muted">{dev.enabled ? LINK_LABEL[dev.state] : 'ปิดอยู่'}</span>
                </button>
                <ThemeButton />
                <UserMenu route={route} canAdvanced={session.role !== 'operator'} onInstall={install} />
              </div>
            </header>
            <div className="databar" role="note" aria-label="สถานะข้อมูล">
              <span className="ld-chip" data-kind="assumed"><span className="ld-chip__icon" aria-hidden="true">?</span>Synthetic</span>
              <span className="ld-chip" data-kind="proxy"><span className="ld-chip__icon" aria-hidden="true">≈</span>TEST</span>
              <span className="ld-chip" data-kind="unvalidated"><span className="ld-chip__icon" aria-hidden="true">!</span>UNVALIDATED</span>
            </div>
            <DraftBar />
            <div key={route} className="page page-enter">
              {route === '/' && <Overview />}
              {route === '/pre' && <Pre />}
              {route === '/run' && <RunPage />}
              {route === '/post' && <Post />}
              {route === '/history' && <History />}
              {route === '/report' && <Report />}
              {route === '/advanced' && <Advanced />}
              {route === '/workspace' && <Workspace />}
              {route === '/companion' && <Companion />}
            </div>
          </main>
        </div>
      </div>
      <SettingsDrawer />
      <SavedToast />
      {MASCOT_HIDDEN_ON.includes(route) ? null : <MascotCorner />}
    </div>
  );
}
