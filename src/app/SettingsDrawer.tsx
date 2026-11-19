// ลิ้นชักตั้งค่าและช่วยเหลือ: เครื่อง, บอร์ดและกล้อง, ความหมายของป้าย, เพิ่มเติม
// รวมของที่ไม่ใช่งานหลักไว้ที่เดียว หน้าหลักจึงสั้นและไม่ต้องเลื่อนไล่หา
import { go } from './router';
import { closeDrawer, setDrawerTab, useUi, type DrawerTab } from '../data/ui';
import { markOnboarding, selectProfile, useAppState } from '../data/store';
import { CAM_LABEL, LINK_LABEL, device, useDevice } from '../device/link';
import { validateUrl } from '../device/protocol';
import { fmtTime } from '../lib/util';
import { Drawer, Switch } from '../ui/overlay';
import { Icon } from '../ui/icons';
import { Btn, Chip, Legend, MissingText, Notice, SelectField, Tabs, TextField, Val } from '../ui/kit';
import { ProfileEditor } from './ProfileEditor';
import { SOON } from './upcoming';
import type { Path } from './router';

export function BoardPanel() {
  const d = useDevice();
  const urlCheck = d.url.trim() ? validateUrl(d.url, window.location.protocol) : null;
  const urlErr = urlCheck && !urlCheck.ok ? `${urlCheck.what}. ${urlCheck.why}. ${urlCheck.fix}.` : null;
  const canConnect = d.enabled && !!urlCheck && urlCheck.ok;
  return (
    <div className="tabpanel">
      <div className="statusline" role="status">
        <span className="dot" data-s={d.enabled ? d.state : 'off'} aria-hidden="true" />
        {d.enabled ? LINK_LABEL[d.state] : 'ยังไม่เปิดใช้'}
      </div>
      <p className="muted small">เตรียมไว้สำหรับบอร์ด ESP32 ที่ส่งสัญญาณไปและกลับกับเว็บ เพื่อให้กล้องที่ต่อกับบอร์ดทำงานไปพร้อมกัน ตอนนี้ปิดอยู่ ไม่มีการเชื่อมต่อใด ๆ จนกว่าคุณจะเปิดใช้และใส่ที่อยู่บอร์ดเอง</p>
      <Notice kind="info" title="ขอบเขตของสัญญาณ">เว็บส่งได้เฉพาะเช็กสถานะและสั่งกล้องที่ต่อกับบอร์ด ไม่มีคำสั่งไปควบคุมเครื่อง Spray Dryer ค่าที่บอร์ดส่งกลับในระยะนี้มีแค่สถานะ ยังไม่ถูกนำเข้าเป็นค่าของรัน</Notice>

      <Switch id="dev-enabled" checked={d.enabled} onChange={(v) => device.setEnabled(v)} label="เปิดใช้งานการเชื่อมต่อบอร์ด" hint="ปิดไว้เป็นค่าเริ่มต้น" />
      <TextField id="dev-url" label="ที่อยู่บอร์ด (WebSocket)" value={d.url} onChange={(v) => device.setUrl(v)} placeholder="ws://192.168.1.50:81" error={d.enabled ? urlErr : null}
        hint="ไอพีของบอร์ดในเครือข่ายเดียวกัน ถ้าเปิดเว็บแบบ https ต้องใช้ wss://" autoComplete="off" />
      <div className="row">
        {d.state === 'online' || d.state === 'connecting' ? (
          <Btn icon="x" onClick={() => device.disconnect()}>ตัดการเชื่อมต่อ</Btn>
        ) : (
          <Btn variant="primary" icon="plug" disabled={!canConnect} onClick={() => device.connect()}>เชื่อมต่อ</Btn>
        )}
        <Btn icon="refresh" disabled={d.state !== 'online'} onClick={() => { device.ping(); device.requestStatus(); }}>เช็กสถานะ</Btn>
      </div>
      {d.enabled && d.state === 'error' && d.error ? <Notice kind="danger" title="เชื่อมต่อบอร์ดไม่ได้">{d.error}</Notice> : null}

      <div className="boardstat">
        <div><span className="k">ความหน่วงไปกลับ</span><span className="v">{d.rttMs === null ? <MissingText /> : <Val v={d.rttMs} digits={0} unit="ms" kind="measured" />}</span></div>
        <div><span className="k">ได้ยินจากบอร์ดล่าสุด</span><span className="v">{d.lastSeen === null ? <MissingText /> : <span className="ld-num">{fmtTime(d.lastSeen)}</span>}</span></div>
        <div><span className="k">บอร์ดและเฟิร์มแวร์</span><span className="v">{d.board || d.fw ? `${d.board ?? 'ไม่ระบุ'}${d.fw ? ` · ${d.fw}` : ''}` : <MissingText />}</span></div>
        <div><span className="k">กล้อง</span><span className="v">{d.cam === null ? <MissingText /> : CAM_LABEL[d.cam]}</span></div>
      </div>
      <p className="cap">ความหน่วงเป็นค่าที่แอปวัดเอง (Measured) ส่วนชื่อบอร์ด เฟิร์มแวร์ และสถานะกล้องเป็นข้อความที่บอร์ดแจ้งมา</p>

      <Switch id="dev-cam" checked={d.camWithTimer} onChange={(v) => device.setCamWithTimer(v)} label="ให้กล้องทำงานพร้อมตัวจับเวลา" hint="ส่งสัญญาณเริ่มและหยุดกล้องตอนกดเริ่มและจบการจับเวลา" />
      <div><Btn icon="camera" disabled={d.state !== 'online'} onClick={() => device.camSnap()}>ลองสั่งกล้องถ่ายหนึ่งภาพ</Btn></div>

      <details className="inline-details">
        <summary><span>ข้อความที่ส่งและรับ</span><span className="cap">{d.log.length} รายการ</span></summary>
        <div className="inline-details__body">
          {d.log.length ? (
            <ul className="loglist" aria-label="บันทึกข้อความกับบอร์ด">
              {[...d.log].reverse().map((l, i) => <li key={i} data-d={l.dir}>{fmtTime(l.t)} {l.dir === 'tx' ? 'ส่ง' : l.dir === 'rx' ? 'รับ' : 'ระบบ'} {l.text}</li>)}
            </ul>
          ) : <p className="muted small">ยังไม่มีข้อความ</p>}
          <p className="cap">วิธีต่อบอร์ดและตัวอย่างโค้ดอยู่ที่ docs/ESP32-LINK.md</p>
        </div>
      </details>
    </div>
  );
}

function MorePanel() {
  const cur = useAppState((s) => s.cur);
  const onboarding = useAppState((s) => s.onboarding);
  const steps = [
    { key: 'profile', label: 'เลือกเครื่องและบันทึกโปรไฟล์', done: !!onboarding.profile, to: null as Path | null },
    { key: 'legend', label: 'อ่านความหมายของป้ายที่มา', done: !!onboarding.legend, to: null },
    { key: 'predict', label: 'ลองประเมิน Tout หนึ่งครั้ง', done: cur.done[1] || !!onboarding.predict, to: '/pre' as Path },
    { key: 'timer', label: 'ลองจับเวลาและจดค่า', done: cur.done[2] || !!onboarding.timer, to: '/run' as Path },
    { key: 'export', label: 'ส่งออกรายงานไฟล์แรก', done: !!onboarding.export, to: '/report' as Path },
  ];
  const n = steps.filter((s) => s.done).length;
  return (
    <div className="tabpanel">
      <div className="stack-sm">
        <h3 className="h3">เริ่มใช้งานใน 10 นาที <span className="cap">{n} จาก {steps.length}</span></h3>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={n} aria-label="ความคืบหน้าการเริ่มใช้งาน"><span style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      </div>
      <ul className="todo">
        {steps.map((s) => (
          <li key={s.key} data-done={s.done ? 'true' : undefined}>
            <span className="todo__mark" aria-hidden="true">{s.done ? '✓' : ''}</span>
            <span className="todo__t">{s.label}<span className="sr-only">{s.done ? ' (ทำแล้ว)' : ' (ยังไม่ทำ)'}</span></span>
            {s.to && !s.done ? <Btn variant="quiet" onClick={() => { closeDrawer(); go(s.to as Path); }}>ไป</Btn> : null}
          </li>
        ))}
      </ul>
      <hr className="divider" />
      <div className="stack-sm">
        <h3 className="h3">กำลังจะมา <span className="soon">ยังไม่เปิดใช้</span></h3>
        <p className="muted small">ยังไม่มีข้อมูลหรือสเปกที่ยืนยัน จึงไม่แสดงตัวเลขใด ๆ</p>
      </div>
      <ul className="upnext">
        {SOON.map((t) => (
          <li key={t.title}>
            <span className="upnext__ic"><Icon name={t.icon} size={20} /></span>
            <span className="upnext__t"><strong>{t.title}</strong><span>{t.body}</span><span className="cap">{t.wait}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SettingsDrawer() {
  const ui = useUi();
  const profiles = useAppState((s) => s.profiles);
  const activeId = useAppState((s) => s.activeProfileId);
  const d = useDevice();
  const tabs: { key: DrawerTab; label: string; badge?: string }[] = [
    { key: 'machine', label: 'เครื่อง' },
    { key: 'board', label: 'บอร์ด', badge: d.enabled && d.state === 'online' ? '●' : undefined },
    { key: 'legend', label: 'ป้าย' },
    { key: 'more', label: 'เพิ่มเติม' },
  ];
  return (
    <Drawer open={ui.open} onClose={closeDrawer} title="ตั้งค่าและช่วยเหลือ">
      <Tabs<DrawerTab> label="หมวดตั้งค่า" value={ui.tab} onChange={setDrawerTab} tabs={tabs} />
      {ui.tab === 'machine' ? (
        <div className="tabpanel" key="machine">
          <SelectField id="drawer-machine" label="เครื่องที่ใช้งาน" value={activeId} onChange={selectProfile} options={profiles.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
          <ProfileEditor />
        </div>
      ) : null}
      {ui.tab === 'board' ? <BoardPanel key="board" /> : null}
      {ui.tab === 'legend' ? (
        <div className="tabpanel" key="legend">
          <p className="muted small">ทุกตัวเลขในแอปมีป้ายบอกที่มา ป้ายแยกกันด้วยไอคอน คำ และลายขอบ ไม่ใช้สีอย่างเดียว</p>
          <Legend />
          <div><Btn variant="quiet" icon="check" onClick={() => markOnboarding('legend')}>เข้าใจแล้ว</Btn></div>
          <p className="cap">ป้าย Synthetic, TEST และ UNVALIDATED ที่แถบด้านบนแปลว่าข้อมูลทั้งหมดเป็นตัวอย่างและผลคำนวณยังไม่ผ่านการตรวจสอบ</p>
          <div><Chip kind="unvalidated" /></div>
        </div>
      ) : null}
      {ui.tab === 'more' ? <MorePanel key="more" /> : null}
    </Drawer>
  );
}
