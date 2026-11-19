// หน้าเข้าสู่ระบบแบบจำลอง: ไม่มีบัญชีจริง ไม่ตรวจและไม่เก็บรหัสผ่าน เลือกบทบาทกับโหมดผู้ใช้แล้วเข้าได้เลย
// เมื่อมีระบบบัญชีจริง (ยังไม่ได้ตัดสินใจ) หน้านี้ต้องเปลี่ยนเป็นการยืนยันตัวตนจริง
// หน้าตา: แผงซ้ายเป็นฉากเดียวกับหน้าแรก (โทนเข้ม) ฟอร์มขวากระชับ ให้เห็นครบในจอเดียวบนจอคอม
import { useEffect, useRef, useState } from 'react';
import { go } from '../app/router';
import { setState, useAppState } from '../data/store';
import type { Role } from '../data/types';
import { MODES, type AudienceMode } from '../config/modes';
import { LaongMark } from '../ui/droplets';
import { Icon } from '../ui/icons';
import { Btn, TextField } from '../ui/kit';
import { Mascot } from '../ui/themed';
import { GenImg } from '../ui/genImg';

const BASE = import.meta.env.BASE_URL;
const calmNow = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** น้องละอองยืนบนหัวข้อในแผงซ้าย หันไปดูเครื่องทำงาน กระโดดลงมาครั้งเดียวตอนเปิดหน้า พอเครื่องรันเสร็จ (วิดีโอจบ) ก็ดีใจหนึ่งครั้ง */
function PanelBuddy({ cheer }: { cheer: number }) {
  const [phase, setPhase] = useState<'wait' | 'land' | 'watch' | 'joy'>(() => (calmNow() ? 'watch' : 'wait'));
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => {
    if (!calmNow()) { later(700, () => setPhase('land')); later(1300, () => setPhase('watch')); }
    return () => timers.current.forEach(clearTimeout);
  }, []);
  useEffect(() => { if (cheer) { setPhase('joy'); later(1600, () => setPhase('watch')); } }, [cheer]);
  const pose = phase === 'land' ? 'hop' : phase === 'joy' ? 'celebrate' : 'look-right';
  return <span className="lg-pbuddy" data-phase={phase} aria-hidden="true"><Mascot pose={pose} size={64} eager /></span>;
}

/** ฉากแผงซ้าย: ภาพนิ่ง (เฟรมแรกของวิดีโอ) + วิดีโอเครื่องทำงานเล่นครั้งเดียว จบแล้วจางกลับเป็นภาพนิ่งเฟรมแรก
 *  น้องละอองกระโดดลงมานั่งบนโต๊ะข้างเครื่อง มองเครื่องทำงาน พอวิดีโอจบ (ได้ผงแล้ว) ก็ดีใจหนึ่งครั้ง
 *  จอแคบหรือ reduced motion: ไม่โหลดวิดีโอ น้องนั่งนิ่ง */
function Stage({ onEnd }: { onEnd: () => void }) {
  const [video, setVideo] = useState(() => typeof window !== 'undefined' && !calmNow() && !window.matchMedia('(max-width: 859px)').matches);
  return (
    <div className="lg-stage" aria-hidden="true"><div className="lg-stage__box">
      <GenImg name="login-bg" ext="jpg" className="lg-stage__img" width={1080} height={1920} eager alt=""
        fallback={<GenImg name="hero-bg" ext="jpg" className="lg-stage__img lg-stage__img--wide" width={1920} height={1080} eager alt="" />} />
      {video ? (
        <video className="lg-stage__video" src={`${BASE}images/gen/login-bg.mp4`} muted playsInline autoPlay preload="auto"
          disablePictureInPicture tabIndex={-1} onError={() => setVideo(false)}
          onPlaying={(e) => e.currentTarget.setAttribute('data-ready', '')} onEnded={(e) => { e.currentTarget.setAttribute("data-done", ""); onEnd(); }} />
      ) : null}
    </div></div>
  );
}

const ROLES: { value: Role; title: string; sub: string; name: string }[] = [
  { value: 'operator', title: 'ผู้ปฏิบัติงานหน้างาน', sub: 'จดค่า จับเวลา บันทึกผลแล็บ', name: 'ผู้ปฏิบัติงานตัวอย่าง' },
  { value: 'reviewer', title: 'ผู้ทบทวน', sub: 'เทียบผล ตรวจรัน เปิดหน้าขั้นสูง', name: 'ผู้ทบทวนตัวอย่าง' },
  { value: 'admin', title: 'ผู้ดูแลระบบ', sub: 'ทุกอย่างของผู้ทบทวน และสำรองข้อมูล', name: 'ผู้ดูแลตัวอย่าง' },
];

export default function Login() {
  const savedMode = useAppState((s) => s.mode);
  const [role, setRole] = useState<Role>('operator');
  const [mode, setMode] = useState<AudienceMode>(savedMode);
  const [nick, setNick] = useState('');
  const [err, setErr] = useState<string | undefined>();
  const current = MODES.find((m) => m.value === mode) ?? MODES[0];
  const [buddy, setBuddy] = useState<{ pose: string; n: number }>({ pose: 'wave', n: 0 });
  const pickMode = (m: AudienceMode) => {
    setMode(m);
    setBuddy((b) => ({ pose: MODES.find((x) => x.value === m)?.mascot ?? 'joy', n: b.n + 1 }));
  };
  const hi = nick.trim();
  const [ran, setRan] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nick.trim();
    if (name.length > 24) {
      setErr('ชื่อเล่นยาวเกิน 24 ตัวอักษร ย่อให้สั้นลงหรือเว้นว่างไว้ ระบบจะใช้ชื่อตามบทบาทแทน');
      // พาโฟกัสกลับไปที่ช่องที่ผิด โปรแกรมอ่านจอจะอ่าน error ให้
      window.setTimeout(() => document.getElementById('nick')?.focus(), 0);
      return;
    }
    const x = ROLES.find((q) => q.value === role)!;
    // ไม่มีรหัสผ่านในระบบจำลอง เก็บเฉพาะชื่อ บทบาท และโหมดของเซสชันตัวอย่าง
    setState({ session: { name: name || x.name, role, email: `${role}@example.test`, at: new Date().toISOString() }, mode });
    // น้องดีใจหนึ่งจังหวะก่อนเข้าแอป (reduced motion เข้าเลย)
    if (calmNow()) { go('/'); return; }
    setBuddy((b) => ({ pose: 'celebrate', n: b.n + 1 }));
    window.setTimeout(() => go('/'), 520);
  };

  return (
    <div className="ld-root lg">
      <aside className="lg-art">
        <Stage onEnd={() => setRan((n) => n + 1)} />
        <a className="lg-brand" href="#/welcome" aria-label="กลับหน้าแรก LaOng">
          <LaongMark size={36} />
          <span><strong>LaOng</strong><small>SprayDry Copilot</small></span>
        </a>
        <div className="lg-art__body">
          <PanelBuddy cheer={ran} />
          <p className="lg-art__tag">จดค่า ทำนาย Tout และทบทวนรัน ในที่เดียว</p>
          <ul className="lg-art__points">
            <li><Icon name="check" size={18} />ทุกตัวเลขบอกที่มา วัดมา จดมา คำนวณ หรือทำนาย</li>
            <li><Icon name="check" size={18} />ร่างบันทึกอัตโนมัติ ปิดแท็บหรือไฟดับก็กลับมาต่อได้</li>
            <li><Icon name="check" size={18} />ใช้ได้บนมือถือ แท็บเล็ต และจอตั้งโต๊ะ</li>
          </ul>
          <p className="lg-art__fine">ระบบช่วยตัดสินใจ ไม่ได้ควบคุมเครื่อง ไม่มีการส่งคำสั่งไปยังเครื่องจริง</p>
        </div>
      </aside>

      <main className="lg-main" id="main-content">
        <div className="lg-card">
          <div className="lg-head">
            <span className="lg-head__buddy" key={buddy.n} data-hop={buddy.n ? '' : undefined}>
              <Mascot pose={buddy.pose} size={60} eager />
              {hi ? <span className="lg-say" aria-hidden="true">ยินดีที่ได้รู้จัก {hi.slice(0, 12)}</span> : null}
            </span>
            <div>
              <h1>เข้าสู่ระบบ</h1>
              <p>เลือกบทบาทและโหมด แล้วเข้าได้เลย</p>
            </div>
          </div>

          <form className="lg-form" onSubmit={submit} noValidate>
            <fieldset className="lg-set">
              <legend className="ld-label">บทบาท</legend>
              <div className="lg-roles">
                {ROLES.map((r) => (
                  <label key={r.value} className="lg-role" data-on={role === r.value ? '' : undefined}>
                    <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                    <span className="lg-role__t"><strong>{r.title}</strong><span>{r.sub}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="lg-set">
              <legend className="ld-label">โหมดผู้ใช้</legend>
              <div className="lg-seg">
                {MODES.map((m) => (
                  <label key={m.value} data-on={mode === m.value ? '' : undefined}>
                    <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => pickMode(m.value)} aria-describedby="lg-mode-desc" />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
              <p className="lg-seg__desc" id="lg-mode-desc">{current.sub}</p>
            </fieldset>

            <TextField id="nick" label="ชื่อเล่น (ไม่บังคับ)" value={nick} onChange={(v) => { setNick(v); setErr(undefined); }} autoComplete="off" error={err} hint="เว้นว่างได้ ระบบจะใช้ชื่อตามบทบาท" />

            <Btn variant="primary" type="submit" block icon="lock">เข้าสู่ระบบ</Btn>
          </form>

          <p className="lg-fine">ระบบจำลอง ไม่มีรหัสผ่านและยังไม่ตรวจสิทธิ์ที่เซิร์ฟเวอร์ การซ่อนเมนูตามบทบาทเป็นเพียงตัวอย่าง ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่างและอยู่ในเครื่องนี้เท่านั้น</p>
        </div>
      </main>
    </div>
  );
}
