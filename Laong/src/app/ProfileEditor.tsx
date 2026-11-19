// แก้และบันทึกโปรไฟล์เครื่อง (ค่าตัวอย่างสมมติ) ใช้ในลิ้นชักตั้งค่า
import { useEffect, useState } from 'react';
import { markOnboarding, setState, useAppState, useProfile } from '../data/store';
import { Btn, Chip, NumField, TextField } from '../ui/kit';
import { parseNum } from '../lib/util';
import type { Profile } from '../config/synthetic';

export function ProfileEditor() {
  const profile = useProfile();
  const profiles = useAppState((s) => s.profiles);
  const [f, setF] = useState({ airFlow: '', eta: '', ua: '', pump: '', name: '' });
  useEffect(() => { setF({ airFlow: String(profile.airFlow), eta: String(profile.eta), ua: String(profile.ua), pump: String(profile.pumpFactor), name: '' }); }, [profile.id, profile.airFlow, profile.eta, profile.ua, profile.pumpFactor]);
  const vals = { airFlow: parseNum(f.airFlow), eta: parseNum(f.eta), ua: parseNum(f.ua), pump: parseNum(f.pump) };
  const err = (v: number | null, label: string, min: number, max: number) => (v === null ? `ยังไม่มีค่า ${label}. ต้องมีเพื่อคำนวณ. กรอกตัวเลข.` : v < min || v > max ? `${label} ต้องอยู่ระหว่าง ${min} ถึง ${max}. ค่านอกช่วงเป็นไปไม่ได้ทางฟิสิกส์ของโมเดล. ตรวจค่าที่กรอก.` : null);
  const e = { airFlow: err(vals.airFlow, 'อัตราลม', 1, 200), eta: err(vals.eta, 'eta', 0.01, 1), ua: err(vals.ua, 'UA', 0.01, 500), pump: err(vals.pump, 'ตัวคูณปั๊ม', 0.01, 5) };
  const ok = !e.airFlow && !e.eta && !e.ua && !e.pump;
  const save = (asNew: boolean) => {
    if (!ok) return;
    const next: Profile = { ...profile, airFlow: vals.airFlow!, eta: vals.eta!, ua: vals.ua!, pumpFactor: vals.pump! };
    if (asNew) {
      const n = profiles.length + 1;
      const id = `custom-${Date.now().toString(36)}`;
      setState({ profiles: [...profiles, { ...next, id, name: f.name.trim() || `โปรไฟล์ของฉัน ${n}`, code: `USR-${n}`, sample: true }], activeProfileId: id });
    } else {
      setState({ profiles: profiles.map((p) => (p.id === profile.id ? next : p)) });
    }
    markOnboarding('profile');
  };
  return (
    <div className="stack">
      <div className="machine">
        <span className="machine__code">{profile.code}</span>
        <strong>{profile.name}</strong>
        <Chip kind="assumed" extra="ค่าตัวอย่าง" />
      </div>
      <div className="form-grid">
        <NumField id="pf-air" label="อัตราลม" unit="m³/h" value={f.airFlow} onChange={(v) => setF({ ...f, airFlow: v })} error={e.airFlow} chip={<Chip kind="assumed" />} />
        <NumField id="pf-eta" label="eta" value={f.eta} onChange={(v) => setF({ ...f, eta: v })} error={e.eta} chip={<Chip kind="assumed" />} />
        <NumField id="pf-ua" label="UA" unit="kJ/(h·K)" value={f.ua} onChange={(v) => setF({ ...f, ua: v })} error={e.ua} chip={<Chip kind="assumed" />} />
        <NumField id="pf-pump" label="ตัวคูณปั๊ม" unit="mL/min ต่อ 1 %" value={f.pump} onChange={(v) => setF({ ...f, pump: v })} error={e.pump} chip={<Chip kind="proxy" extra="water" />} hint="ใช้แปลง Pump % เป็น mL/min (Proxy)" />
      </div>
      <p className="cap">ค่าในโปรไฟล์นี้เป็นค่าสมมติ ห้ามใส่ค่าคาลิเบรตจริงของเครื่องในต้นแบบนี้ ค่าจริงต้องรอเจ้าของส่งผ่านช่องทางของทีม</p>
      <div className="row">
        <Btn variant="primary" icon="save" disabled={!ok} onClick={() => save(false)}>บันทึกโปรไฟล์นี้</Btn>
        <div className="row" style={{ flex: '1 1 260px' }}>
          <div style={{ flex: 1, minWidth: 160 }}><TextField id="pf-name" label="ชื่อโปรไฟล์ใหม่" value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="เช่น เครื่องห้องแล็บ 2" /></div>
          <Btn icon="plus" disabled={!ok} onClick={() => save(true)} style={{ alignSelf: 'flex-end' }}>บันทึกเป็นเครื่องใหม่</Btn>
        </div>
      </div>
    </div>
  );
}
