// น้องละอองมุมจอ: ลากไปไหนก็ได้ ท่าเปลี่ยนตามทิศที่ลาก ปล่อยแล้วลอยกลับมุมเดิม
// ขยับเองเมื่อไม่มีใครใช้งาน (หยุดทันทีเมื่อมีการใช้งาน กำลังกรอกฟอร์ม พักท่า หรือเปิด reduced motion)
// ท่าตามสภาพอากาศและช่วงเวลา มีตัวเลือกให้ปิด พักท่า ซ่อน และเปลี่ยนพื้นที่อากาศ
import { useEffect, useRef, useState } from 'react';
import { setMascot, useAppState } from '../data/store';
import { coarse, PROVINCES, resolvePlace } from '../config/mascot';
import { modeInfo } from '../config/modes';
import { fetchWeather, WEATHER_LABEL, type WeatherNow, type WeatherPose } from '../lib/weather';
import { Icon } from './icons';
import { Btn, Check, prefersReducedMotion, SelectField } from './kit';
import { Mascot } from './themed';

const IDLE_MS = 15000; // เงียบนานเท่านี้ถึงเริ่มขยับเอง
const STEP_MS = 5000; // เปลี่ยนท่าขยับเองทุกกี่ ms
const SLEEP_MS = 75000; // เงียบนานเท่านี้ถึงหลับ
const IDLE_SEQ = ['look-left', 'look-right', 'hop', 'yawn', 'look-right', 'look-left'];
const PRELOAD = ['mode-student', 'mode-university', 'mode-company', 'mode-factory', 'left', 'right', 'up', 'down', 'press', 'joy', 'hot', 'cold', 'rain', 'fog', 'morning', 'night', ...IDLE_SEQ, 'sleep'];
const BASE = import.meta.env.BASE_URL;

const PREVIEWS: { value: '' | WeatherPose; label: string }[] = [
  { value: '', label: 'อัตโนมัติ' }, { value: 'hot', label: 'ร้อน' }, { value: 'cold', label: 'หนาว' }, { value: 'rain', label: 'ฝน' }, { value: 'fog', label: 'หมอก' },
];

function isTyping(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  return a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function MascotCorner() {
  const prefs = useAppState((s) => s.mascot);
  const mode = modeInfo(useAppState((s) => s.mode));
  const [reaction, setReaction] = useState('');
  const [pressed, setPressed] = useState(false);
  const [idlePose, setIdlePose] = useState('');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [preview, setPreview] = useState<'' | WeatherPose>('');
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [returning, setReturning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [geo, setGeo] = useState<'idle' | 'asking' | 'denied' | 'unsupported'>('idle');
  const [hour, setHour] = useState(() => new Date().getHours());

  const rootRef = useRef<HTMLDivElement>(null);
  const optRef = useRef<HTMLButtonElement>(null);
  const lastActive = useRef(Date.now());
  const offsetRef = useRef(offset);
  const justDragged = useRef(false);
  const reactionTimer = useRef<number | undefined>(undefined);
  const returnTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ id: number; sx: number; sy: number; minX: number; maxX: number; minY: number; maxY: number; moved: boolean } | null>(null);
  offsetRef.current = offset;

  const place = resolvePlace(prefs.place);

  /* ---------- โหลดภาพท่าไว้ล่วงหน้า ไม่ให้วูบตอนสลับท่า ---------- */
  useEffect(() => {
    const run = () => { for (const p of PRELOAD) for (const s of ['', '-dark']) new Image().src = `${BASE}mascot/mascot-${p}${s}.svg`; };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run); else setTimeout(run, 600);
  }, []);

  /* ---------- ช่วงเวลาของวัน ---------- */
  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 10 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------- สภาพอากาศ ---------- */
  useEffect(() => {
    if (!prefs.weatherOn || prefs.hidden) { setWeather(null); return; }
    let alive = true;
    const load = () => { void fetchWeather(place.lat, place.lon).then((w) => { if (alive) setWeather(w); }); };
    load();
    const t = window.setInterval(load, 20 * 60 * 1000);
    return () => { alive = false; window.clearInterval(t); };
  }, [prefs.weatherOn, prefs.hidden, place.lat, place.lon]);

  /* ---------- ขยับเองเมื่อไม่มีใครใช้งาน ---------- */
  useEffect(() => {
    const bump = () => { lastActive.current = Date.now(); setIdlePose((p) => (p ? '' : p)); };
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    for (const e of evs) window.addEventListener(e, bump, { passive: true });
    return () => { for (const e of evs) window.removeEventListener(e, bump); };
  }, []);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const tick = () => {
      if (reduced || prefs.paused || prefs.hidden || dragging || open || document.hidden || isTyping()) { setIdlePose((p) => (p ? '' : p)); return; }
      const idle = Date.now() - lastActive.current;
      if (idle >= SLEEP_MS) setIdlePose('sleep');
      else if (idle >= IDLE_MS) setIdlePose(IDLE_SEQ[Math.floor((idle - IDLE_MS) / STEP_MS) % IDLE_SEQ.length]);
      else setIdlePose((p) => (p ? '' : p));
    };
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [prefs.paused, prefs.hidden, dragging, open]);

  /* ---------- ปิดแผงเมื่อกดข้างนอก หรือกด Esc ---------- */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); optRef.current?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  useEffect(() => () => { window.clearTimeout(reactionTimer.current); window.clearTimeout(returnTimer.current); }, []);

  /* บนมือถือ: จางลงขณะเลื่อนหน้า ไม่บังตัวเลขที่กำลังอ่าน */
  useEffect(() => {
    let t: number | undefined;
    const onScroll = () => {
      const el = rootRef.current;
      if (!el) return;
      el.dataset.scrolling = '1';
      window.clearTimeout(t);
      t = window.setTimeout(() => { if (rootRef.current) delete rootRef.current.dataset.scrolling; }, 900);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(t); };
  }, []);

  const timePose = hour >= 5 && hour < 9 ? 'morning' : hour >= 22 || hour < 4 ? 'night' : '';
  const weatherPose = prefs.weatherOn && weather && weather.pose !== 'calm' ? weather.pose : '';
  // ท่าตั้งต้นคือชุดแต่งตัวตามโหมดผู้ใช้ (บอกโหมดโดยไม่ต้องมีแถบเพิ่มบนหน้า)
  const pose = reaction || (pressed ? 'press' : '') || preview || idlePose || weatherPose || timePose || mode.mascot;

  function showReaction(p: string, ms: number) {
    if (drag.current?.moved) return;
    window.clearTimeout(reactionTimer.current);
    setReaction(p);
    reactionTimer.current = window.setTimeout(() => setReaction(''), ms);
  }

  /* ---------- ลาก ---------- */
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!e.isPrimary || e.button !== 0) return;
    window.clearTimeout(reactionTimer.current);
    window.clearTimeout(returnTimer.current);
    justDragged.current = false;
    const cur = offsetRef.current;
    const r = rootRef.current!.getBoundingClientRect();
    const home = { left: r.left - cur.x, right: r.right - cur.x, top: r.top - cur.y, bottom: r.bottom - cur.y };
    drag.current = {
      id: e.pointerId, sx: e.clientX - cur.x, sy: e.clientY - cur.y, moved: false,
      minX: -home.left, maxX: window.innerWidth - home.right, minY: -home.top, maxY: window.innerHeight - home.bottom,
    };
    setReturning(false);
    setReaction('');
    setPressed(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ตัวชี้ที่ไม่ใช่ของจริง ลากต่อได้โดยไม่จับตัวชี้ */ }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
    if (!d.moved) { d.moved = true; setDragging(true); setOpen(false); setPressed(false); }
    setOffset({ x: clamp(dx, d.minX, d.maxX), y: clamp(dy, d.minY, d.maxY) });
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    setReaction((r) => (r === dir ? r : dir));
  }

  function endDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setPressed(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) return;
    justDragged.current = true; // กันคลิกที่ตามหลังการลาก (รีเซ็ตตอนเริ่มกดครั้งถัดไป)
    setDragging(false);
    setOffset({ x: 0, y: 0 });
    if (!prefersReducedMotion()) {
      setReturning(true);
      returnTimer.current = window.setTimeout(() => setReturning(false), 400);
    }
    showReaction('joy', 900);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dir = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as Record<string, string>)[e.key];
    if (!dir) return;
    e.preventDefault();
    showReaction(dir, 800);
  }

  function askLocation() {
    if (!('geolocation' in navigator)) { setGeo('unsupported'); return; }
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => { setMascot({ place: { kind: 'gps', lat: coarse(p.coords.latitude), lon: coarse(p.coords.longitude) }, weatherOn: true }); setGeo('idle'); },
      () => setGeo('denied'),
      { timeout: 8000, maximumAge: 600000 },
    );
  }

  if (prefs.hidden) {
    return (
      <button type="button" className="mascot__show" onClick={() => setMascot({ hidden: false })} aria-label="แสดงน้องละออง" title="แสดงน้องละออง">
        <Icon name="drop" size={20} />
      </button>
    );
  }

  const placeValue = prefs.place.kind === 'gps' ? 'gps' : prefs.place.kind === 'province' ? prefs.place.id : 'default';
  const placeOptions = [
    { value: 'default', label: 'กรุงเทพฯ (ค่าเริ่มต้น)' },
    ...(prefs.place.kind === 'gps' ? [{ value: 'gps', label: 'ตำแหน่งปัจจุบัน (พิกัดหยาบ)' }] : []),
    ...PROVINCES.map((p) => ({ value: p.id, label: p.name })),
  ];
  const status = preview ? 'กำลังลองท่า'
    : !prefs.weatherOn ? 'ปิดท่าตามอากาศอยู่'
    : weather ? `${place.name} · ${WEATHER_LABEL[weather.pose]} ${weather.tempC} °C`
    : `${place.name} · ยังไม่มีข้อมูลอากาศ`;

  return (
    <div className="mascot" ref={rootRef} data-dragging={dragging ? 'true' : undefined} data-returning={returning ? 'true' : undefined} data-pose={pose}>
      <div className="mascot__move" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <button type="button" className="mascot__grab" aria-label="เล่นกับน้องละออง ลากหรือกดลูกศรเพื่อเปลี่ยนท่า"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          onClick={() => { if (justDragged.current) { justDragged.current = false; return; } showReaction('joy', 1200); }}
          onKeyDown={onKeyDown}>
          <Mascot pose={pose} size={96} eager />
        </button>
        <button type="button" ref={optRef} className="mascot__opt" aria-expanded={open} aria-controls="mascot-panel" aria-label="ตัวเลือกน้องละออง" onClick={() => setOpen(!open)}>
          <span aria-hidden="true"><Icon name="settings" size={16} /></span>
        </button>
      </div>

      {open ? (
        <div className="mascot__panel" id="mascot-panel" role="group" aria-label="ตัวเลือกน้องละออง">
          <div className="mascot__phead">
            <strong>น้องละออง <span className="mascot__mode">โหมด{mode.label}</span></strong>
            <button type="button" className="mascot__x" onClick={() => { setOpen(false); optRef.current?.focus(); }} aria-label="ปิดตัวเลือก"><Icon name="x" size={18} /></button>
          </div>
          <Check id="mc-pause" checked={prefs.paused} onChange={(v) => setMascot({ paused: v })}>พักท่าที่ขยับเอง</Check>
          <Check id="mc-weather" checked={prefs.weatherOn} onChange={(v) => setMascot({ weatherOn: v })}>ท่าตามสภาพอากาศ</Check>
          {prefs.weatherOn ? (
            <div className="stack-sm">
              <SelectField id="mc-place" label="พื้นที่อากาศ" value={placeValue} options={placeOptions}
                onChange={(v) => { if (v === 'gps') return; setMascot(v === 'default' ? { place: { kind: 'default' } } : { place: { kind: 'province', id: v } }); }} />
              <Btn onClick={askLocation} disabled={geo === 'asking'}>{geo === 'asking' ? 'กำลังขอตำแหน่ง' : 'ใช้ตำแหน่งปัจจุบัน'}</Btn>
              {geo === 'denied' ? <p className="mascot__msg" role="status">ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เลือกจังหวัดจากรายการแทนได้</p> : null}
              {geo === 'unsupported' ? <p className="mascot__msg" role="status">อุปกรณ์นี้ไม่รองรับตำแหน่ง เลือกจังหวัดจากรายการแทนได้</p> : null}
            </div>
          ) : null}
          <fieldset className="mascot__prev">
            <legend className="ld-label">ลองท่าอากาศ</legend>
            <div className="mascot__prevrow">
              {PREVIEWS.map((p) => (
                <label key={p.value || 'auto'} data-on={preview === p.value ? 'true' : undefined}>
                  <input type="radio" name="mc-preview" checked={preview === p.value} onChange={() => setPreview(p.value)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mascot__status" role="status">{status}</p>
          <p className="mascot__note">ส่งออกเฉพาะพิกัดแบบหยาบ (ทศนิยม 1 ตำแหน่ง) ไปยัง Open-Meteo ไม่ส่งชื่อหรือข้อมูลรัน ข้อมูลอากาศจาก <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0)</p>
          <Btn variant="quiet" onClick={() => { setMascot({ hidden: true }); setOpen(false); }}>ซ่อนน้องละออง</Btn>
        </div>
      ) : null}
    </div>
  );
}
