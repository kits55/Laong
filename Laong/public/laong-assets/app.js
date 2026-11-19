'use strict';

const phases = ['ก่อนทดลอง', 'ระหว่างทดลอง', 'หลังทดลอง'];
const statuses = {
  draft: 'ร่าง', ready: 'พร้อมรัน', running: 'กำลังรัน', results: 'รอผลแล็บ', closed: 'ปิดรันแล้ว',
};
const transitions = {
  draft: ['ready', 'ยืนยันแผน'],
  ready: ['running', 'เริ่มทดลอง'],
  running: ['results', 'จบการทดลอง'],
  results: ['closed', 'ปิดรัน'],
};
const templates = {
  spray: {
    name: 'Spray Dryer', icon: 'machine', description: 'ติดตามการทดลองทำผงและค่าที่อ่านจากเครื่อง',
    before: [
      ['goal', 'วัตถุประสงค์', 'textarea', true],
      ['machine', 'รหัสเครื่อง', 'text', true],
      ['sample', 'ชื่อหรือรหัสตัวอย่าง', 'text', true],
      ['tin', 'อุณหภูมิขาเข้า (°C)', 'number', false, 0, 250],
      ['volume', 'ปริมาตรตั้งต้น (mL)', 'number', false, 0, 20000],
      ['feed', 'อัตราป้อนตั้งต้น (mL/min)', 'number', false, 0, 100],
      ['solids', 'ของแข็งในสารป้อน (%)', 'number', false, 0, 100],
      ['batch', 'Batch', 'text'],
      ['formula', 'สูตรและวัสดุ', 'text'],
      ['profile', 'Machine Profile', 'text'],
      ['tfeed', 'อุณหภูมิสารป้อน (°C)', 'number', false, 0, 100],
      ['air', 'เงื่อนไขอากาศ', 'text'],
      ['solidsMethod', 'วิธีวัด Total Solids', 'text'],
      ['brix', '°Brix', 'number', false, 0, 100],
      ['notes', 'เงื่อนไขอื่น ๆ', 'textarea'],
    ],
    during: [
      ['tin', 'อุณหภูมิขาเข้าที่จด (°C)', 'number', false, 0, 250],
      ['tout', 'อุณหภูมิขาออกที่จด (°C)', 'number', false, 0, 200],
      ['feed', 'อัตราป้อนที่จด (mL/min)', 'number', false, 0, 100],
      ['volume', 'ปริมาตรที่ป้อนสะสม (mL)', 'number', false, 0, 20000],
      ['notes', 'สิ่งที่สังเกตหรือเหตุการณ์', 'text'],
    ],
    after: [
      ['yield', 'มวลผงที่ได้ (g)', 'number', false, 0],
      ['moisture', 'ความชื้น (% wb)', 'number', false, 0, 100],
      ['conclusion', 'สรุปผลและข้อสังเกต', 'textarea', true],
    ],
  },
  general: {
    name: 'การทดลอง R&D', icon: 'lab', description: 'วางแผนและติดตามการทดลองที่ทีมกำหนดวิธีเอง',
    before: [
      ['goal', 'วัตถุประสงค์', 'textarea', true],
      ['sample', 'ชื่อหรือรหัสตัวอย่าง', 'text', true],
      ['method', 'วิธีทดลองและเงื่อนไข', 'textarea', true],
      ['materials', 'วัสดุและอุปกรณ์', 'textarea'],
    ],
    during: [
      ['metric', 'รายการที่วัดหรือสังเกต', 'text'],
      ['value', 'ค่าที่วัด', 'number'],
      ['unit', 'หน่วย', 'text'],
      ['notes', 'สิ่งที่สังเกตหรือเหตุการณ์', 'text'],
    ],
    after: [
      ['result', 'ผลที่ได้', 'textarea', true],
      ['conclusion', 'ข้อสรุปหรือสิ่งที่จะปรับรอบต่อไป', 'textarea'],
    ],
  },
};

const storageKey = 'laong.experiments.v1';
const main = document.querySelector('#content');
const dialog = document.querySelector('#create-dialog');
const createForm = document.querySelector('#create-form');
const templateSelect = document.querySelector('#template-select');
const alertBox = document.querySelector('#storage-alert');
let readFailed = false;
let experiments = load();
let currentPhase = 0;
let preTab = 'plan';   // แท็บย่อยในขั้นก่อนทดลอง: plan | predict | extra

// Profile edits use the same named Web Lock in every tab; malformed data is never replaced with [].
async function updateMachineProfiles(update) {
  if (!globalThis.navigator?.locks || typeof globalThis.navigator.locks.request !== 'function') return {ok:false,error:storageSupportMessage('ระบบป้องกันการเขียนพร้อมกันไม่พร้อม')};
  try {
    return await globalThis.navigator.locks.request(profileStorageKey, () => {
      const text = localStorage.getItem(profileStorageKey);
      const rows = text === null ? [] : JSON.parse(text);
      if (!Array.isArray(rows) || rows.some(p => !p || typeof p !== 'object' || Array.isArray(p) || typeof p.key !== 'string' || !p.key) || new Set(rows.map(p => p.key)).size !== rows.length) return {ok:false,error:'ข้อมูลโปรไฟล์ในเครื่องผิดรูปแบบหรือรหัสซ้ำ ยังไม่ได้แก้ข้อมูลเดิม'};
      const result = update(rows);
      if (!result?.ok) return result || {ok:false,error:'ยังไม่ได้เปลี่ยนโปรไฟล์'};
      localStorage.setItem(profileStorageKey, JSON.stringify(result.rows));
      return {ok:true};
    });
  } catch { return {ok:false,error:'บันทึกโปรไฟล์ไม่ได้ ตรวจพื้นที่จัดเก็บและสิทธิ์เบราว์เซอร์ · ยังไม่ได้เขียนทับข้อมูล'}; }
}

/* ── โหมด "รายละเอียดวิจัย" ──
 * ค่าเริ่มต้น = ปิด (หน้าทดลองทั่วไป). เก็บต่อเบราว์เซอร์ใน localStorage
 * การซ่อน/แสดงเป็นเรื่องหน้าจอเท่านั้น ไม่ใช่ระบบสิทธิ์ และไม่ลบหรือเปลี่ยนข้อมูลใด ๆ */
const researchModeKey = 'laong.researchMode.v1';
function researchMode() {
  // เว็บสำหรับนักศึกษา (origin อื่นที่ไม่ใช่ TEST/จริง) ไม่มีเครื่องมือวิจัย — ไม่แสดงแม้เคยเปิดไว้
  if (globalThis.LAONG_MODE?.mode === 'other') return false;
  try { return localStorage.getItem(researchModeKey) === 'on'; } catch { return false; }
}
/* นับถอยหลัง "อีก N นาที" และแถบหยด "ป้อนแล้ว X / Y mL" คำนวณจากค่าที่ผู้ใช้จดเองและเวลาป้อนที่ตั้งสมมติ ยังไม่ใช่สถานะจริงของเครื่อง
 * จึงไม่แสดงในหน้าที่นักศึกษาดู (โค้ดและข้อมูลเดิมยังอยู่) — เปิดดูได้เฉพาะ TEST ที่เปิด "รายละเอียดวิจัย" */
function progressEstimatesVisible() {
  return globalThis.LAONG_MODE?.mode === 'test' && researchMode();
}
function setResearchMode(on) {
  try { localStorage.setItem(researchModeKey, on ? 'on' : 'off'); return true; } catch { return false; }
}

/* ── คำทำนาย Tout แบบ native (ตรรกะอยู่ใน run-prediction.js; ที่นี่เป็นหน้าจอ + โปรไฟล์ในเครื่อง) ── */
const profileStorageKey = 'laong.machineProfiles.v1';
const predictionApi = () => globalThis.LAONG_PREDICTION;
const physicsApi = () => (typeof PHYSICS === 'undefined' ? null : PHYSICS);
let physicsIntegrity = 'checking';   // checking | ok | mismatch | unavailable
let predictionPreview = null;        // { runId, snapshot } ผลคำนวณล่าสุดที่ยังไม่บันทึก
(async () => {
  const api = predictionApi();
  if (!api || !physicsApi() || !globalThis.crypto?.subtle) { physicsIntegrity = 'unavailable'; return; }
  try {
    const bytes = await (await fetch(`/laong-assets/${api.PHYSICS_FILE}`, { cache: 'no-store' })).arrayBuffer();
    const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    physicsIntegrity = hex === api.PHYSICS_SHA256 ? 'ok' : 'mismatch';
  } catch { physicsIntegrity = 'unavailable'; }
  if (route().name === 'run') render();
})();

function importedProfiles() {
  const api = predictionApi();
  if (!api) return [];
  try {
    const list = JSON.parse(localStorage.getItem(profileStorageKey) || '[]');
    return Array.isArray(list) ? list.map(p => api.validateProfile(p)).filter(r => r.ok).map(r => r.profile) : [];
  } catch { return []; }
}

function machineProfiles() {
  const api = predictionApi();
  const demo = api?.demoProfile(globalThis.SPRAYDRY_RUNTIME_CONFIG);
  return [...importedProfiles(), ...(demo ? [demo] : [])];
}

function profileClassLabel(profile) {
  return profile.classification === 'PUBLIC_SYNTHETIC' ? 'ข้อมูลสาธิต (สมมติ)' : 'ค่าคาลิเบรตเครื่องจริง · ข้อมูลภายในทีม';
}
let detailId = '';
let noticeTimer;
let unmountMascot;
const pendingForms = new Map();
let conflictRunId = '';
let writingRun = false;

function demoExperiments() {
  return [
    {
      id: 'R-018', title: 'ทดสอบการทำผงสูตรตัวอย่าง', template: 'spray', templateVersion: 1,
      createdAt: '2026-11-12T02:15:00Z', status: 'running', demo: true, dataOrigin: 'test',
      before: { goal: 'บันทึกค่าระหว่างการทดลองสำหรับทดสอบหน้าจอ', machine: 'SD-01', sample: 'ตัวอย่าง A', tin: 160, volume: 300, feed: 4 },
      logs: [
        { time: '2026-11-12T02:30:00Z', data: { tout: 84.2, feed: 4, volume: 60, notes: 'บันทึกตัวอย่างช่วงแรก' } },
        { time: '2026-11-12T02:55:00Z', data: { tout: 84.9, feed: 4, volume: 160, notes: 'บันทึกตัวอย่างช่วงถัดมา' } },
      ], after: {},
    },
    {
      id: 'R-017', title: 'เปรียบเทียบเนื้อสัมผัสของตัวอย่าง', template: 'general', templateVersion: 1,
      createdAt: '2026-11-11T03:10:00Z', status: 'closed', demo: true, dataOrigin: 'test',
      before: { goal: 'เปรียบเทียบตัวอย่างในเงื่อนไขเดียวกัน', sample: 'ตัวอย่าง B', method: 'บันทึกผลตามแบบประเมินของทีม' },
      logs: [{ time: '2026-11-11T03:20:00Z', data: { notes: 'ตรวจตัวอย่างรอบแรก' } }],
      after: { result: 'บันทึกผลตัวอย่างครบ', conclusion: 'ทดลองซ้ำเพื่อยืนยันผล' },
    },
  ];
}

function readRuns() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return isRealPreviewOrigin() || globalThis.LAONG_MODE?.sharedView ? [] : demoExperiments();
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.some((run) => !run || !Object.hasOwn(templates, run.template) || !Object.hasOwn(statuses, run.status) || !Array.isArray(run.logs))) throw new Error('Invalid records');
  if (isRealPreviewOrigin() && records.some(run => run.demo !== false || run.dataOrigin !== 'real')) throw new Error('Unverified record provenance');
  return records;
}

function load() {
  try {
    return readRuns();
  } catch {
    readFailed = true;
    showStorageError('เปิดข้อมูลในเบราว์เซอร์ไม่ได้ การบันทึกถูกพักไว้เพื่อเก็บข้อมูลเดิม');
    return [];
  }
}

function showStorageError(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
}

async function writeRuns(update) {
  if (readFailed || writingRun) return false;
  writingRun = true;
  try {
    if (!navigator.locks) throw new Error('Web Locks unavailable');
    return await navigator.locks.request(storageKey, () => {
      const next = update(readRuns());
      if (!next) return false;
      localStorage.setItem(storageKey, JSON.stringify(next));
      experiments = next;
      alertBox.hidden = true;
      return true;
    });
  } catch {
    showStorageError(storageSupportMessage('บันทึกไม่ได้ ตรวจพื้นที่จัดเก็บหรือสิทธิ์ของเบราว์เซอร์ แล้วลองอีกครั้ง'));
    return false;
  } finally {
    writingRun = false;
  }
}

function replace(original, updated) {
  return writeRuns((latest) => {
    const current = latest.find((record) => record.id === original.id);
    if (JSON.stringify(current) !== JSON.stringify(original)) {
      conflictRunId = original.id;
      document.querySelector('#run-conflict')?.removeAttribute('hidden');
      message('รันนี้เปลี่ยนจากอีกแท็บ กรุณาตรวจข้อมูลล่าสุดก่อนบันทึก');
      return null;
    }
    if (updated.status === 'running' && original.status !== 'running' && original.template === 'spray' &&
      latest.some((record) => record.id !== original.id && record.status === 'running' &&
        record.before.machine === original.before.machine && Boolean(record.demo) === Boolean(original.demo) &&
        !(globalThis.LAONG_MODE?.sharedView && ['R-018', 'R-017'].includes(record.id)))) {   // รันตัวอย่างที่ระบบใส่ให้ ไม่นับว่าเครื่องไม่ว่าง
      message('เครื่องนี้มีรันที่กำลังเดินอยู่');
      return null;
    }
    return latest.map((record) => record.id === original.id ? updated : record);
  });
}

function e(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function icon(name) {
  return `<img class="icon" src="laong-assets/icons/${name}.svg" alt="" width="18" height="18">`;
}

function status(run) {
  return `<span class="status ${run.status}">${statuses[run.status]}</span>`;
}

function timeLabel(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function dayLabel(value) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function newButton() {
  return `<button class="button primary" data-action="create">${icon('add')} สร้างการทดลอง</button>`;
}

function pageHead(title, description, actions = '', className = '') {
  return `<div class="page-head ${className}"><div><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}</div>${actions}</div>`;
}

const runOrigins = { today: 'วันนี้', machines: 'ทะเบียนเครื่อง', history: 'ประวัติการทดลอง', runs: 'รายการทดลอง',
  notifications: 'แจ้งเตือน', templates: 'แบบฟอร์มทดลอง', calendar: 'ปฏิทิน (ทดลอง)' };

function route() {
  const [path, query] = (location.hash.slice(1) || document.documentElement.dataset.laongRoute || '').split('?', 2);
  const [name, id] = path.split('/');
  const params = new URLSearchParams(query);
  const origin = params.get('from');
  return { name: name === 'run' || pageKeys.includes(name) ? name : 'today', id,
    origin: Object.hasOwn(runOrigins, origin) ? origin : 'runs', date: params.get('date') };
}

function runLink(run, from = route().name) {
  const source = from === 'run' ? route().origin : from;
  return `#run/${encodeURIComponent(run.id)}${Object.hasOwn(runOrigins, source) && source !== 'runs' ? `?from=${source}` : ''}`;
}

function table(records) {
  if (!records.length) return '<p class="empty">ยังไม่มีการทดลองในรายการนี้</p>';
  const actions = { draft: 'แก้ไขร่าง', ready: 'เปิดแผน', running: 'จดบันทึก', results: 'กรอกผล', closed: 'ดูผล' };
  return `<div class="table-wrap"><table class="run-table"><thead><tr><th scope="col" class="run-id">รัน</th><th scope="col">ชื่อการทดลอง</th><th scope="col" class="run-secondary">แบบฟอร์ม</th><th scope="col">สถานะ</th><th scope="col" class="run-secondary">สร้างเมื่อ</th><th scope="col" class="run-action">การดำเนินการ</th></tr></thead><tbody>${records.map((run) =>
    `<tr><td class="mono run-id">${e(run.id)}</td><td><small class="mono run-id-compact">${e(run.id)}</small><a class="record-link" href="${runLink(run)}">${e(run.title)}</a>${run.demo && !sharedLabel() ? ' <small class="muted">· ตัวอย่าง</small>' : ''}</td><td class="run-secondary">${templates[run.template].name}</td><td>${status(run)}</td><td class="run-secondary">${dayLabel(run.createdAt)}</td><td class="run-action"><div class="row-tools"><a class="button ${run.status === 'draft' ? 'action-draft' : ''}" href="${runLink(run)}" aria-label="${actions[run.status]} ${e(run.id)}">${actions[run.status]} ${icon('next')}</a>${run.status === 'draft' ? `<button class="button icon-tool" data-action="delete-row-draft" data-id="${e(run.id)}" aria-label="ลบร่าง ${e(run.id)}" title="ลบร่าง"></button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
}

function drops(run) {
  if (!progressEstimatesVisible()) return '';
  const volume = run.before.volume;
  const latest = [...run.logs].reverse().find((log) => log.data.volume != null)?.data.volume;
  if (!(volume > 0) || latest == null) return '';
  const filled = Math.round(12 * Math.max(0, Math.min(1, latest / volume)));
  return `<div>${dropletStrip(filled, 12)}<p class="hint">ป้อนแล้ว <span class="mono">${e(latest)} / ${e(volume)}</span> mL ${sourceTag(run.demo ? 'Assumed' : 'Observed')}${run.demo ? (sharedLabel() ? ' · เว็บทดลอง' : ' · ข้อมูลตัวอย่าง') : ''}</p></div>`;
}

/* ปุ่มลอย: ถ้านาฬิกาอยู่นอกจอ → "ไปที่นาฬิกา"; ถ้านาฬิกาอยู่ในจอ → "ไปที่บันทึกค่า" (ไม่เพิ่มช่องกรอก) */
let jumpFrame = 0;
function updateJumpButton() {
  jumpFrame = 0;
  const b = document.querySelector('[data-action="jump-clock"]'), c = document.querySelector('#run-clock');
  if (!b || !c) return;
  const r = c.getBoundingClientRect(), inView = r.top < innerHeight * 0.75 && r.bottom > 0;
  const dir = inView ? 'entry' : 'clock';
  if (b.dataset.dir !== dir) { b.dataset.dir = dir; b.textContent = inView ? '✎ ไปที่บันทึกค่า' : '⏱ ไปที่นาฬิกา'; }
}
addEventListener('scroll', () => { if (!jumpFrame) jumpFrame = requestAnimationFrame(updateJumpButton); }, { passive: true });

/* กราฟค่าที่จด + เหตุการณ์ (ไม่มีช่องกรอกเพิ่ม: ใช้ค่าที่จดอยู่แล้ว และปุ่มแตะไม่บังคับ) */
const chartApi = () => globalThis.LaongRunChart || null;
function eventTimeLabel(iso) { const d = new Date(iso); return Number.isFinite(d.getTime()) ? timeLabel(iso) : ''; }
function eventChips(run) {
  const C = chartApi();
  if (!C || run.status !== 'running') return '';
  return `<div class="event-chips" role="group" aria-label="บันทึกเหตุการณ์"><span class="hint">เกิดเหตุการณ์? แตะเพื่อบันทึกเวลา (ไม่บังคับ)</span>
    <div class="chip-row">${C.EVENT_TYPES.map(x => `<button type="button" class="button chip" data-action="log-event" data-event="${e(x.type)}">${e(x.label)}</button>`).join('')}</div></div>`;
}
function eventList(run) {
  const C = chartApi(), list = Array.isArray(run.events) ? run.events.filter(x => C?.EVENT_LABEL[x?.type]) : [];
  if (!C || !list.length) return '';
  return `<ul class="event-list">${[...list].reverse().map(x => `<li><span class="mono">${e(eventTimeLabel(x.time))}</span> ${e(C.EVENT_LABEL[x.type])}${run.status === 'running' ? ` <button type="button" class="button subtle" data-action="delete-event" data-id="${e(x.id)}" aria-label="ลบเหตุการณ์ ${e(C.EVENT_LABEL[x.type])} เวลา ${e(eventTimeLabel(x.time))}">ลบ</button>` : ''}</li>`).join('')}</ul>`;
}
function eventBox(run) {
  const list = eventList(run);
  return list ? `<div class="event-box"><h3>เหตุการณ์ที่บันทึก</h3>${list}</div>` : '';
}
function runChartBlock(run) {
  const C = chartApi();
  if (!C || !C.hasChart(run)) return '';
  return `<section class="run-chart" aria-label="กราฟค่าที่จดในรันนี้"><h3>กราฟค่าที่จดในรันนี้</h3>${C.svg(run)}<p class="hint">${e(C.caption(run))}</p></section>`;
}

/* ที่เก็บรันของฉัน: ส่งออกเป็นไฟล์ (ใช้ได้จริง ไฟล์อยู่ในเครื่องเท่านั้น) + ปุ่มที่ยังไม่เปิดใช้ (แสดงไว้ให้เห็นว่าระบบจะมีอะไร) */
function runMenu(run) {
  const closed = run.status === 'closed';
  const research = run.template === 'spray' && globalThis.LAONG_MODE?.mode !== 'other';
  const item = (attrs, iconName, label, note = '', extra = '') => `<button type="button" class="menu-item${extra}" ${attrs}>${icon(iconName)}<span>${label}</span>${note ? `<small>${note}</small>` : ''}</button>`;
  return `<details class="run-menu"><summary class="button">จัดการรัน ${icon('next')}</summary><div class="menu-list">
    ${item('data-action="export-run"', 'export', 'ส่งออกรันนี้ (JSON)')}
    ${item('data-action="export-all-runs"', 'export', 'ส่งออกทุกรัน (JSON)')}
    <hr>
    ${['PDF', 'Word', 'Excel'].map(f => item(`data-action="report" data-format="${f}" ${closed ? '' : 'disabled'}`, 'print', f, closed ? '' : 'เปิดเมื่อปิดรัน')).join('')}
    ${research ? `<hr>${item('data-action="toggle-research"', 'lab', researchMode() ? 'ซ่อนรายละเอียดวิจัย' : 'รายละเอียดวิจัย', 'สำหรับผู้พัฒนา')}` : ''}
    ${closed ? `<hr>${item('data-action="copy-run"', 'copy', 'ทำสำเนาเป็นร่าง')}` : run.status === 'draft' ? `<hr>${item('data-action="delete-draft"', 'trash', 'ลบร่าง', '', ' danger')}` : ''}
  </div></details>`;
}

function storageLine(run) {
  return `<div class="storage-line"><span>${icon('lock')} เก็บในเบราว์เซอร์นี้</span><details class="run-menu menu-up"><summary class="button">ส่งออกข้อมูล ${icon('next')}</summary><div class="menu-list">
    <p class="hint">ล้างข้อมูลเบราว์เซอร์แล้วรันหาย ไฟล์ที่ส่งออกอยู่ในเครื่องคุณเท่านั้น ยังไม่ได้ส่งให้ใคร</p>
    <button type="button" class="menu-item" data-action="export-run">${icon('export')}<span>ส่งออกรันนี้ (JSON)</span></button>
    <button type="button" class="menu-item" data-action="export-all-runs">${icon('export')}<span>ส่งออกทุกรัน (JSON)</span></button>
    <hr>
    <button type="button" class="menu-item" disabled aria-disabled="true">${icon('add')}<span>นำเข้าไฟล์รัน</span><small>กำลังพัฒนา</small></button>
    <button type="button" class="menu-item" disabled aria-disabled="true">${icon('user')}<span>ส่งรันให้ทีมใช้พัฒนาแอป</span><small>กำลังพัฒนา</small></button>
    <p class="hint">แผนที่วางไว้ (ยังไม่เปิดใช้): ส่งให้ทีมได้เมื่อคุณเลือกยินยอมเป็นรายรัน ค่าเริ่มต้นคือไม่ส่ง · รันทดสอบไม่ถูกนับเป็นข้อมูลอ้างอิง · รันในเว็บทดลองนี้เป็นรันทดสอบทุกรัน</p>
  </div></details></div>`;
}

/* แถบคำทำนายย่อในแท็บข้อมูลการทดลอง: บอกสถานะ และเปิดเครื่องมือทำนาย */
function predStrip(run) {
  const saved = latestPrediction(run);
  const value = saved && Number.isFinite(saved.result?.tout_C)
    ? `<b class="mono">${saved.result.tout_C.toFixed(1)} °C</b> <span class="pred-badge">คำทำนาย · ไม่ใช่ค่าวัดจริง</span>`
    : '<span class="muted">ยังไม่ได้คำนวณ</span>';
  return `<div class="pred-strip"><span class="pred-strip-title">${icon('run')} ทำนาย Tout ก่อนเริ่ม</span><span class="pred-strip-state">${value}</span><button type="button" class="button" data-action="pre-tab" data-tab="predict">เปิดเครื่องมือทำนาย</button></div>`;
}

function runStoragePanel(run) {
  const one = run ? '<button class="button" type="button" data-action="export-run">ส่งออกรันนี้ (ไฟล์ JSON)</button>' : '';
  return `<section class="panel panel-pad aside-body run-storage" aria-label="ที่เก็บรันของฉัน"><h2>ที่เก็บรันของฉัน</h2>
    <p class="hint">รันอยู่ในเบราว์เซอร์นี้ ล้างข้อมูลเบราว์เซอร์แล้วหาย ส่งออกเป็นไฟล์เก็บไว้ได้ ไฟล์อยู่ในเครื่องคุณเท่านั้น ยังไม่ได้ส่งให้ใคร</p>
    <div class="actions">${one}<button class="button" type="button" data-action="export-all-runs">ส่งออกทุกรัน (ไฟล์ JSON)</button></div>
    <details class="lab-extra storage-later"><summary>นำเข้าและส่งให้ทีม · กำลังพัฒนา</summary>
    <div class="actions"><button class="button" type="button" disabled aria-disabled="true">นำเข้าไฟล์รัน</button><span class="source">กำลังพัฒนา</span></div>
    <div class="actions"><button class="button" type="button" disabled aria-disabled="true">ส่งรันให้ทีมใช้พัฒนาแอป</button><span class="source">กำลังพัฒนา</span></div>
    <p class="hint">แผนที่วางไว้ (ยังไม่เปิดใช้): การส่งรันให้ทีมจะทำได้เมื่อคุณเลือกยินยอมเป็นรายรัน ค่าเริ่มต้นคือไม่ส่ง · รันทดสอบระบบจะไม่ถูกนับเป็นข้อมูลอ้างอิง · รันในเว็บทดลองนี้เป็นรันทดสอบทุกรัน</p></details>
  </section>`;
}

function exportRuns(list) {
  const F = globalThis.LaongRunFile;
  if (!F) { message('ส่งออกไฟล์ไม่ได้ในหน้านี้'); return; }
  if (!list.length) { message('ยังไม่มีรันให้ส่งออก'); return; }
  try {
    const now = new Date();
    const data = F.build(list, { mode: globalThis.LAONG_MODE?.mode, label: globalThis.LAONG_MODE?.label }, now);
    const url = URL.createObjectURL(new Blob([F.text(data)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = F.fileName(list, now); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    message(`ส่งออก ${data.runs.length} รันเป็นไฟล์แล้ว · ไฟล์อยู่ในเครื่องนี้ ยังไม่ได้ส่งให้ใคร`);
  } catch { message('ส่งออกไฟล์ไม่ได้ ลองอีกครั้ง'); }
}

const howtoKey = 'laong.howto.v1';
function howtoBox() {
  if (!globalThis.LAONG_MODE?.sharedView) return '';
  try { if (localStorage.getItem(howtoKey) === 'done') return ''; } catch { /* แสดงต่อได้ */ }
  return `<section class="panel panel-pad howto" aria-label="เริ่มใช้งาน"><div><h2>เริ่มใช้งานใน 3 ขั้น</h2>
    <ol class="howto-steps"><li><b>ก่อนทดลอง</b> · กรอกแผน แล้วดูคำทำนาย Tout และรันที่เคยทำใกล้เคียง</li>
    <li><b>ระหว่างทดลอง</b> · เริ่มนาฬิกา แล้วจดค่าเมื่ออยากบันทึก ไม่ต้องจดทุกนาที</li>
    <li><b>หลังทดลอง</b> · กรอกผลสรุป</li></ol>
    <p class="hint">เว็บนี้เป็นต้นแบบทดลองใช้ ข้อมูลเก็บในเบราว์เซอร์นี้ ยังไม่ใช่ที่เก็บผลการทดลองจริง</p></div>
    <button type="button" class="button" data-action="dismiss-howto">เข้าใจแล้ว</button></section>`;
}

function today() {
  const current = experiments.find((run) => run.status === 'running');
  const draft = experiments.find((run) => run.status === 'draft');
  const active = experiments.filter((run) => run.status !== 'closed');
  const waiting = experiments.filter((run) => run.status === 'results');
  const closed = experiments.filter((run) => run.status === 'closed');
  return pageHead('วันนี้', `${dayLabel(new Date())} · ติดตามการทดลองและแผนเข้าแล็บ`, newButton()) + howtoBox() +
    `<div class="dashboard">
      <section class="panel panel-pad feature">
        <div class="feature-layout"><div class="feature-content">
        <div class="feature-meta">${current ? status(current) + `<span class="mono muted">${e(current.id)}</span>` : '<span class="muted">รันที่กำลังดำเนินการ</span>'}</div>
        <div><h2>${current ? e(current.title) : 'ยังไม่มีการทดลองที่กำลังเดิน'}</h2>
        <p class="muted">${current ? templates[current.template].name + (current.before.machine ? ' · ' + e(current.before.machine) : '') : 'สร้างรันเพื่อบันทึกแผนก่อนเริ่มทดลอง'}${current?.demo ? (sharedLabel() ? ' · เว็บทดลอง' : ' · ข้อมูลตัวอย่าง') : ''}</p></div>
        ${current ? etaMarkup(current) + drops(current) : ''}
        <div class="actions">${current ? `<a class="button primary" href="${runLink(current)}">เปิดรัน ${icon('next')}</a>` : '<a class="button" href="#templates">เลือกแบบฟอร์ม</a>'}${draft ? `<a class="button" href="${runLink(draft)}">ทำต่อจากร่าง ${e(draft.id)}</a>` : ''}</div>
        </div><div class="mascot-corner" data-mascot></div></div>
      </section>
      <section class="panel panel-pad summary"><h2>ภาพรวมการทดลอง</h2>
        <div class="metrics"><div><strong class="mono">${active.length}</strong><small>ยังไม่ปิด</small></div><div><strong class="mono">${waiting.length}</strong><small>รอผลแล็บ</small></div><div><strong class="mono">${closed.length}</strong><small>ปิดแล้ว</small></div></div>
        <hr>${todayAgenda()}
      </section>
    </div>
    <section class="panel"><div class="panel-head"><div><h2>การทดลองล่าสุด</h2><p class="muted">กลับไปจดค่าหรือเปิดผลที่บันทึกไว้</p></div><a class="button" href="#runs">ดูรายการทั้งหมด</a></div>${table(experiments.slice(0, 5))}</section>
    ${globalThis.LAONG_MODE?.sharedView ? '' : `<section class="panel panel-pad preview-links"><div><h2>เครื่องของทีม</h2><p class="hint">${labWorkspace.machines.length} เครื่องในทะเบียน</p></div><a class="button" href="#machines">ดูทะเบียนเครื่อง</a></section>`}`;
}

const listFilters = new Map();
function listPage(history) {
  const title = history ? 'ประวัติและรายงาน' : 'รายการทดลอง';
  const metrics = [['รันทั้งหมด', experiments.length], ['กำลังรัน', experiments.filter(run => run.status === 'running').length],
    ['รอผลแล็บ', experiments.filter(run => run.status === 'results').length]];
  return pageHead(title, history ? 'เปิดรันที่ปิดแล้วเพื่อดูผลและออกรายงาน' : '', history ? '' : newButton(), history ? '' : 'run-register-heading') +
    (history ? '' : `<dl class="stitch-metrics">${metrics.map(([label, count]) =>
      `<div><dt>${label}</dt><dd class="mono">${count}</dd></div>`).join('')}</dl>`) +
    `<section class="panel${history ? '' : ' run-register'}"><div class="filters run-filters">
      <label>ค้นหาการทดลอง<input type="search" id="search" placeholder="ชื่อการทดลองหรือรหัสรัน"></label>
      <label>แบบฟอร์ม<select id="type-filter"><option value="">ทุกแบบฟอร์ม</option>${Object.entries(templates).map(([key, t]) => `<option value="${key}">${t.name}</option>`).join('')}</select></label>
      ${history ? '' : `<label>สถานะ<select id="status-filter"><option value="">ทุกสถานะ</option>${Object.entries(statuses).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></label>`}
      ${history ? '<button type="button" class="button subtle" data-action="clear-run-filters" disabled>ล้างตัวกรอง</button>' : ''}
    </div>${history ? '' : '<div class="run-result-bar"><p id="run-result-count" role="status"></p><button type="button" class="button subtle" data-action="clear-run-filters" disabled hidden>ล้างตัวกรอง</button></div>'}<div id="list-results"></div></section>`;
}

function runResults(records) {
  if (route().name === 'runs') {
    if (!experiments.length && !readFailed) return '<div class="empty empty-with-mascot"><img src="laong-assets/icons/mascot-idle.svg" alt=""><h2>ยังไม่มีรัน</h2><p>สร้างรันแรกเพื่อบันทึกเงื่อนไขและผลการทดลอง</p></div>';
    return table(records);
  }
  return `<p class="machine-count hint" role="status">แสดง ${records.length} การทดลอง</p>${table(records)}`;
}

function filterList() {
  const search = document.querySelector('#search').value;
  const query = search.trim().toLowerCase();
  const type = document.querySelector('#type-filter').value;
  const stage = document.querySelector('#status-filter')?.value || (route().name === 'history' ? 'closed' : '');
  listFilters.set(route().name, { search, type, stage });
  for (const [index, status] of ['all', 'running', 'results'].entries()) {
    const metric = main.querySelectorAll('.stitch-metrics dd')[index];
    if (metric) metric.textContent = experiments.filter(run => status === 'all' || run.status === status).length;
  }
  const results = experiments.filter((run) => (!query || `${run.title} ${run.id}`.toLowerCase().includes(query)) &&
    (!type || run.template === type) && (!stage || run.status === stage));
  const clear = main.querySelector('[data-action="clear-run-filters"]');
  clear.disabled = !(search || type || (route().name !== 'history' && stage));
  const count = main.querySelector('#run-result-count');
  if (count) {
    clear.hidden = clear.disabled;
    count.textContent = `แสดง ${results.length} การทดลอง`;
  }
  main.querySelector('#list-results').innerHTML = runResults(results);
}

function templatePage() {
  return pageHead('แบบฟอร์มทดลอง', 'เลือกแบบฟอร์มเพื่อสร้างรันใหม่ ระบบเตรียมช่องบันทึกก่อนทดลอง ระหว่างทดลอง และหลังทดลองให้') +
    '<div class="template-list">' + Object.entries(templates).map(([key, template]) => `<article class="panel template-card">
      <div class="template-intro"><span class="template-symbol">${icon(template.icon)}</span><div><h2>${template.name}</h2><p class="muted">${template.description}</p></div></div>
      <ol class="template-outline">${['before', 'during', 'after'].map((stage, index) =>
        `<li><span class="step-number">${index + 1}</span><div><h3>${phases[index]}</h3><p class="hint">${template[stage].slice(0, 3).map(([, label]) => label).join(' · ')}</p></div></li>`).join('')}</ol>
      <div class="template-footer"><button class="button primary" data-action="create" data-template="${key}">สร้างรัน ${key === 'spray' ? 'Spray Dryer' : 'R&D'} ${icon('next')}</button></div></article>`).join('') + '</div>';
}

function fields(specification, values, locked, prefix = '') {
  return specification.map(([key, label, type, required, min, max]) => {
    const attrs = `name="${key}" id="${prefix}${key}" ${required ? 'required' : ''} ${locked ? 'disabled' : ''}`;
    const numeric = type === 'number' ? `step="any" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}` : 'maxlength="160"';
    const control = type === 'textarea' ? `<textarea ${attrs} maxlength="2000">${e(values[key])}</textarea>` :
      `<input ${attrs} type="${type}" value="${e(values[key])}" ${numeric} ${key === 'machine' && !locked ? 'list="machine-register" autocomplete="off"' : ''}>`;
    const unit = type === 'number' ? (String(label).match(/\(([^)]+)\)\s*$/) || [])[1] : null;
    const boxed = unit ? `<span class="input-unit">${control}<span class="unit" aria-hidden="true">${unit}</span></span>` : control;
    return `<label for="${prefix}${key}"><span class="lbl">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</span>${boxed}</label>`;
  }).join('');
}

function sourceTag(source) {
  return `<span class="source">${source}</span>`;
}

const sharedLabel = () => globalThis.LAONG_MODE?.sharedView === true;
function fieldSource(run, stage, type, value) {
  if (value == null) return 'ยังไม่มีข้อมูล';
  if (run.demo) return globalThis.LAONG_MODE?.sharedView === true ? 'ผู้ใช้กรอก · เว็บทดลอง' : 'ข้อมูลจำลอง';
  // Presentation only: local integration ports are exclusively for synthetic TEST.
  // Do not change stored records or label any value as instrument-measured.
  if (location.hostname === '127.0.0.1' && ['19012', '19013'].includes(location.port)) {
    return stage === 'before' ? 'แผน TEST / ยังไม่ยืนยัน' : 'ผู้ใช้กรอก TEST / ยังไม่ยืนยัน';
  }
  return stage === 'before' ? 'ตามแผน' : 'ผู้ใช้บันทึก';
}

function recordedFields(specification, values, stage, run) {
  return `<dl class="recorded-fields">${specification.map(([key, label, type]) => {
    const value = values[key];
    const source = fieldSource(run, stage, type, value);
    return `<div><dt>${label}</dt><dd>${value == null ? '<span class="muted">ยังไม่มีข้อมูล</span>' : `${e(value)} ${sourceTag(source)}`}</dd></div>`;
  }).join('')}</dl>`;
}

const preTabNow = run => (preTab === 'extra' && run.status !== 'draft' ? 'plan' : preTab);
function preTabs(run) {
  const tabs = [['plan', 'ข้อมูลการทดลอง'], ['predict', 'ทำนาย Tout'], ...(run.status === 'draft' ? [['extra', 'สูตรและโปรไฟล์']] : [])];
  const now = preTabNow(run);
  return `<div class="pre-tabs" role="tablist" aria-label="ส่วนของแผนก่อนทดลอง">${tabs.map(([k, l]) => `<button type="button" role="tab" class="pre-tab" data-action="pre-tab" data-tab="${k}" aria-selected="${k === now}">${l}</button>`).join('')}</div>`;
}

function phaseHint(run, phase) {
  if (phase === 0) return run.status === 'draft' ? 'กรอกเงื่อนไข แล้วกดยืนยันเมื่อพร้อม' : 'แผนถูกล็อกหลังยืนยัน';
  if (phase === 1) return run.status === 'running' ? 'จดค่าหรือเหตุการณ์เมื่อมีสิ่งที่อยากบันทึก · ไม่ต้องจดทุกนาที' : 'เพิ่มรายการได้เมื่อรันอยู่ในสถานะกำลังรัน';
  return run.status === 'results' ? 'บันทึกผลก่อนปิดรัน' : run.status === 'closed' ? 'รันที่ปิดแล้วเปิดดูย้อนหลังได้' : 'กรอกผลได้หลังจบการทดลอง';
}

let editingReading;
function readingTimeFields(isoTime) {
  if (!isoTime) return {};
  const time = new Date(isoTime);
  if (!Number.isFinite(time.getTime())) return {};
  const [year, month, day] = labDate(time).split('-');
  return { readingDate: `${day}/${month}/${Number(year) + 543}`, readingClock: labTimeFormat.format(time) };
}

function parseReadingTime(date, clock) {
  const parts = /^(\d{2})(\/?)(\d{2})\2(\d{4})$/.exec(date);
  const hours = /^(\d{2}):?(\d{2})$/.exec(clock);
  if (!parts || !hours || Number(hours[1]) > 23 || Number(hours[2]) > 59) return null;
  const [, day, , month, year] = parts;
  const localDate = `${Number(year) - 543}-${month}-${day}`;
  const calendarDate = calendarDay(localDate);
  if (!Number.isFinite(calendarDate.getTime()) || dateKey(calendarDate) !== localDate) return null;
  return new Date(`${localDate}T${hours[1]}:${hours[2]}+07:00`);
}

function phaseContent(run, template) {
  if (currentPhase === 1) {
    const values = pendingValues(run, 'reading', {});
    const editIndex = editingReading?.run === run.id ? editingReading.index : null;
    const content = run.status === 'running' ? `<form class="entry-form" data-form="reading">
      <div class="actions">${globalThis.LAONG_MODE?.sharedView ? '' : '<a class="button" href="#monitor">ติดตามเครื่อง</a>'}<button class="button" type="button" data-action="reuse-reading" ${run.logs.length ? '' : 'disabled'}>ดึงค่าครั้งก่อน</button></div>
      ${predictionChip(run)}
      <div class="field-grid entry-grid" id="reading-entry">${fields(template.during, values, false, 'reading-')}</div>
      <details class="lab-extra reading-time-extra" ${values.readingDate || values.readingClock || editIndex != null ? 'open' : ''}><summary>เวลาที่จด: ${values.readingDate || values.readingClock ? 'กำหนดเอง' : 'ใช้เวลาที่กดบันทึก'} (กดเพื่อแก้เวลา)</summary>
      <fieldset class="reading-timestamp">
        <legend>เวลาที่จด <span class="hint">เวลาไทย</span></legend>
        <div class="reading-timestamp-fields">
          <label>วันที่ (พ.ศ.)<input type="text" name="readingDate" inputmode="numeric" maxlength="10" placeholder="วว/ดด/ปปปป" value="${e(values.readingDate)}" aria-describedby="reading-time-hint"></label>
          <label>เวลา<input type="text" name="readingClock" inputmode="numeric" maxlength="5" placeholder="ชม:นาที" value="${e(values.readingClock)}" aria-describedby="reading-time-hint"></label>
        </div>
        <div class="reading-timestamp-help"><p class="hint" id="reading-time-hint">${editIndex == null ? 'เว้นว่างทั้งคู่เพื่อใช้เวลาที่กดบันทึก' : 'ล้างทั้งคู่เพื่อใช้เวลาเดิม'}</p><button class="button subtle" type="button" data-action="reading-now">ใช้เวลาตอนนี้</button></div>
        <p class="hint field-error" id="reading-time-error" role="alert" hidden></p>
      </fieldset></details>
      <div class="actions"><button class="button primary">${editIndex == null ? 'เพิ่มบันทึก' : 'บันทึกการแก้ไข'}</button>
      ${editIndex == null ? '' : '<button type="button" class="button" data-action="cancel-reading-edit">ยกเลิกแก้ไข</button>'}${draftNote(run, 'reading')}</div></form>` : '';
    return content + eventChips(run) + runChartBlock(run) + eventBox(run) + `<div class="entry-list"><h3>บันทึกระหว่างทดลอง <small class="muted">(${run.logs.length})</small></h3>
      ${run.logs.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">เวลาบันทึก</th><th scope="col">ข้อมูล</th>${run.status === 'running' ? '<th scope="col" class="reading-actions">จัดการ</th>' : ''}</tr></thead><tbody>${[...run.logs].reverse().map((log, offset) => {
        const index = run.logs.length - 1 - offset;
        const time = timeLabel(log.time);
        return `<tr><td>${time}</td><td>${template.during.filter(([key]) => log.data[key] != null).map(([key, label, type]) => `<div><span class="muted">${label}</span> ${e(log.data[key])} ${sourceTag(fieldSource(run, 'during', type, log.data[key]))}</div>`).join('')}</td>${run.status === 'running' ? `<td class="reading-actions"><div class="row-tools"><button type="button" class="button icon-tool" data-action="edit-reading" data-index="${index}" aria-label="แก้ไขบันทึกเวลา ${time}" title="แก้ไขบันทึก"></button><button type="button" class="button icon-tool" data-action="delete-reading" data-index="${index}" aria-label="ลบบันทึกเวลา ${time}" title="ลบบันทึก"></button></div></td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>` : '<p class="empty">ยังไม่มีบันทึกระหว่างทดลอง</p>'}</div>`;
  }
  const before = currentPhase === 0;
  const stage = before ? 'before' : 'after';
  const locked = run.status !== (before ? 'draft' : 'results');
  const step = transitions[run.status];
  const expanded = before && run.template === 'spray';
  const values = pendingValues(run, stage, run[stage]);
  if (locked) return recordedFields(template[stage], run[stage], stage, run);
  return `<form class="form-body" data-form="${stage}">
    ${before ? `<label>ชื่อการทดลอง *<input id="run-title" name="runTitle" maxlength="100" required value="${e(pendingValues(run, stage, {}).runTitle ?? run.title)}"></label>` : ''}
    <div class="field-grid">${fields(expanded ? template[stage].slice(0, 7) : template[stage], values, locked)}</div>
    ${expanded ? `<button type="button" class="plan-extra-link" data-action="pre-tab" data-tab="extra">${icon('settings')}<span>สูตร โปรไฟล์เครื่อง และรายละเอียดเพิ่มเติม</span>${icon('next')}</button><details class="lab-extra plan-extra" open><summary>สูตร โปรไฟล์เครื่อง และรายละเอียดเพิ่มเติม</summary><div class="field-grid">${fields(template[stage].slice(7), values, locked)}</div></details>` : ''}
    ${before && run.template === 'spray' ? `<datalist id="machine-register">${labWorkspace.machines.filter((machine) => !machine.maintenance).map((machine) =>
      `<option value="${e(machine.id)}">${e(machine.name)}</option>`).join('')}</datalist>` : ''}
    ${expanded ? predStrip(run) : ''}
    <div class="actions run-form-actions">${expanded ? `<button type="button" class="button back-to-plan" data-action="pre-tab" data-tab="plan">${icon('back')} กลับข้อมูลการทดลอง</button>` : ''}<button class="button" name="intent" value="save" formnovalidate>${before ? 'บันทึกร่าง' : 'บันทึกผลไว้ก่อน'}</button><button class="button primary" name="intent" value="advance">${step[1]} ${icon('next')}</button>${draftNote(run, stage)}</div></form>`;
}

function formKey(run, stage) { return `${run.id}:${stage}`; }
function pendingValues(run, stage, saved) { return pendingForms.get(formKey(run, stage))?.values ?? saved; }
function draftNote(run, stage) {
  return `<span class="hint draft-note" ${pendingForms.has(formKey(run, stage)) ? '' : 'hidden'}>มีข้อมูลที่ยังไม่ได้บันทึก</span>`;
}
/* การเขียนของหน้านี้เองที่ไม่เกี่ยวกับช่องในฟอร์ม (นาฬิกา, คำทำนาย) ต้องไม่ทำให้ฟอร์มที่พิมพ์ค้างอยู่ขึ้นว่า "เปลี่ยนจากอีกแท็บ"
 * ย้ายเฉพาะฟิลด์เหล่านั้นของฐานไปที่ค่าล่าสุด — ฟิลด์อื่น (แผน, ค่าที่จด, สถานะ) ยังตรวจการชนกันข้ามแท็บตามเดิม */
function adoptOwnWrite(runId, keys) {
  const fresh = experiments.find(r => r.id === runId);
  if (!fresh) return;
  for (const entry of pendingForms.values()) {
    if (entry.base?.id !== runId) continue;
    const next = { ...entry.base };
    for (const k of keys) { if (Object.hasOwn(fresh, k)) next[k] = fresh[k]; else delete next[k]; }
    entry.base = next;
  }
}
function rememberForm(run, form) {
  const key = formKey(run, form.dataset.form);
  pendingForms.set(key, { base: pendingForms.get(key)?.base ?? run, values: Object.fromEntries(new FormData(form)) });
  form.querySelector('.draft-note').hidden = false;
}

function detail(run) {
  const template = templates[run.template];
  const next = transitions[run.status];
  const { origin } = route();
  const nextTask = { draft: 'แก้ชื่อหรือกรอกแผนก่อนทดลอง แล้วกดยืนยันแผนเมื่อพร้อม', ready: 'กดเริ่มทดลองเมื่อพร้อมใช้งาน',
    running: 'จดค่าระหว่างทดลอง แล้วกดจบการทดลองเมื่องานเสร็จ', results: 'กรอกผลหลังทดลอง แล้วกดปิดรันเพื่อส่งออกรายงาน' };
  const nextPhase = { draft: 0, ready: 0, running: 1, results: 2 }[run.status];
  const phaseAction = ['ready', 'running'].includes(run.status) && nextPhase === currentPhase;
  const preSheet = run.template === 'spray' && currentPhase === 0;
  return `<a href="#${origin}" class="back">${icon('back')} ${runOrigins[origin]}</a>` +
    pageHead(`${e(run.title)} ${status(run)}`, `${e(run.id)} · ${template.name} · ${dayLabel(run.createdAt)}${run.demo ? (sharedLabel() ? ' · เว็บทดลอง' : ' · ข้อมูลตัวอย่าง') : ''}`,
      runMenu(run), 'run-head') +
    `<section id="run-conflict" class="conflict notice" ${conflictRunId === run.id ? '' : 'hidden'}><p role="alert">รันนี้เปลี่ยนจากอีกแท็บ ข้อความที่กรอกในแท็บนี้ยังอยู่</p><button class="button" data-action="reload-run">โหลดล่าสุดและทิ้งข้อความที่ยังไม่บันทึก</button></section><div class="detail-grid"><section class="panel run-sheet">
      <nav class="steps" aria-label="ช่วงการทดลอง"><span class="step-indicator" aria-hidden="true" style="--phase: ${currentPhase}"></span>${phases.map((label, i) => `<button type="button" class="step" data-action="phase" data-phase="${i}" aria-pressed="${i === currentPhase}"><span class="step-number" aria-hidden="true">${i + 1}</span> <span>${label}</span></button>`).join('')}</nav>
      <div class="panel-pad"><div class="form-body"><div class="phase-heading"><div>${preSheet ? `<h2>เตรียมแผนการทดลอง</h2>${preTabs(run)}` : `<h2>${phases[currentPhase]}</h2><p class="muted">${phaseHint(run, currentPhase)}</p>`}</div>${phaseAction ? `<button type="button" class="button ${run.status === 'ready' ? 'primary' : ''}" data-action="advance">${next[1]}</button>` : ''}</div>${preSheet ? `<div class="pre-sheet" data-pre-tab="${preTabNow(run)}">${phaseContent(run, template)}${run.status === 'draft' ? '' : predStrip(run)}${predictionPanel(run)}</div>` : phaseContent(run, template)}${run.template === 'spray' && currentPhase === 2 ? predictionLine(run) + runChartBlock(run) + eventBox(run) : ''}</div></div>
    </section><aside class="detail-aside" aria-label="สถานะและรายงาน">
      <section class="panel panel-pad aside-body"><h2>สถานะรัน</h2><div>${status(run)}</div>
      ${nextTask[run.status] ? `<p class="hint">${nextTask[run.status]}</p>` : ''}
      ${nextPhase != null && nextPhase !== currentPhase ? `<button class="button" data-action="phase" data-phase="${nextPhase}">ไปช่วง${phases[nextPhase]} ${icon('next')}</button>` : ''}
      ${run.template === 'spray' ? etaMarkup(run) + drops(run) : ''}
      ${run.template === 'spray' ? timerPanel(run) : ''}
      ${run.status === 'closed' ? '<p class="hint">ข้อมูลที่ปิดรันแล้วแก้ไขไม่ได้</p>' : ''}
      ${storageLine(run)}
      </section>
      ${run.template === 'spray' && researchMode() && run.demo === true && location.hostname === '127.0.0.1' && location.port === '19012' ? `<section class="panel panel-pad aside-body dev-tools" data-test-timer="${e(run.id)}">
        <details class="lab-extra dev-tools-box"><summary>เครื่องมือทีมพัฒนา · ข้อมูลจำลอง TEST</summary>
        <p class="hint">ส่วนนี้ใช้ทดสอบการเชื่อมกับระบบเดิม ผู้ใช้ทั่วไปไม่ต้องเปิด · ไม่บันทึกลงรันนี้</p>
        <h3>ทดลองนาฬิการัน</h3><p class="hint">เฉพาะข้อมูลจำลอง · ใช้นาฬิกาและเงื่อนไขเดิมในพื้นที่ทดสอบแยก ไม่บันทึกลงรันนี้</p>
        <details class="lab-extra"><summary>กรอกข้อมูลเริ่มทดสอบ</summary><div class="field-grid">
          <label>คำถามของรัน TEST<input name="question" maxlength="100"></label><label>Batch TEST<input name="batch" maxlength="100"></label>
          <label>รหัสรัน TEST<input name="runCode" maxlength="100"></label><label>Tin TEST (°C)<input name="tin" type="number" min="120" max="200" step="any"></label>
          <label>Pump TEST (%)<input name="pump" type="number" min="0" max="100" step="any"></label><label>Atomizing air TEST (L/min)<input name="atom" type="number" min="0" max="25" step="any"></label>
        </div><p class="hint">กรอกทั้ง 6 ช่องก่อนเริ่ม ระบบไม่เติมค่าที่ขาด และเงื่อนไขเดิมจะตรวจอีกครั้ง</p></details>
        <p data-timer-status>ยังไม่ได้เชื่อมพื้นที่ทดสอบ</p>
        <p class="hint" data-timer-feedback role="status" aria-live="polite">นาฬิกานี้ยังไม่เชื่อมรันจริงหรือประวัติ</p>
        <p class="hint" data-timer-events>ยังไม่มีเหตุการณ์ TEST</p>
        <div class="actions"><button class="button primary" type="button" data-timer-action="start">เริ่ม Warm-up TEST</button>
          <button class="button" type="button" data-timer-action="feed" disabled>เริ่มป้อน TEST</button>
          <button class="button" type="button" data-timer-action="pause" disabled>พัก</button>
          <button class="button" type="button" data-timer-action="resume" disabled>ป้อนต่อ</button>
          <button class="button" type="button" data-timer-action="finishFeed" disabled>ป้อนเสร็จ</button>
          <button class="button" type="button" data-timer-action="stop" disabled>จบรันทดสอบ</button></div>
        <div class="actions"><button class="button" type="button" data-timer-action="saveSummary">เก็บสรุป TEST ชั่วคราว</button>
          <button class="button" type="button" data-timer-action="viewSummary">ดูสรุป TEST ที่เก็บไว้</button></div>
        <p class="hint" data-timer-saved>สรุปเก็บเฉพาะในแท็บนี้ ไม่ใช่ประวัติรันหรือผลการทดลอง</p>
        <div class="actions"><button class="button" type="button" data-timer-action="listTestRuns">ตรวจประวัติระบบเดิม TEST</button></div>
        <div class="hint" data-timer-history>ดูได้เฉพาะพื้นที่ TEST รอบนี้ ยังไม่เชื่อมกับประวัติรันของ Laong</div>
        <p class="hint" data-test-review aria-live="polite">ยังไม่ได้ตรวจรัน TEST</p>
        <button class="button" type="button" data-timer-action="exportTestReview">ส่งออกสรุป Review TEST (JSON)</button>
        <button class="button" type="button" data-timer-action="exportFullTestRun">ส่งออกรัน TEST เต็มรายการ (JSON)</button>
        <p class="hint">ไฟล์เต็มมีหมายเหตุและรายละเอียด TEST ที่กรอกไว้ · ไม่รวมโปรไฟล์เครื่อง แผน หรือ calibration · ไม่ใช่ backup ทั้งโครงการ</p>
        <div class="actions"><button class="button" type="button" data-timer-action="reportTestRun">ดูสรุปรายงาน TEST</button>
          <button class="button" type="button" data-timer-action="exportTestReport">ส่งออกสรุปรายงาน TEST (CSV)</button></div>
        <p class="hint" data-test-report aria-live="polite">ยังไม่ได้สร้างสรุปรายงาน TEST</p>
        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 0"><input type="checkbox" data-test-match-confirm style="width:24px;height:24px;min-width:24px;margin:0"> <span>ยืนยันว่ารัน TEST ที่ตรวจเป็นรันตัวอย่างเดียวกับหน้านี้</span></label>
        <div class="actions"><button class="button" type="button" data-timer-action="linkTestRun">จับคู่รหัสรัน TEST</button>
          <button class="button" type="button" data-timer-action="viewTestLink">ดูการจับคู่ TEST</button></div>
        <p class="hint" data-test-link>ยังไม่จับคู่ · เฉพาะแท็บ TEST ไม่แก้ประวัติรันหลัก</p>
        <div class="actions"><button class="button" type="button" data-timer-action="showConsole">เปิด/ซ่อนแบบบันทึกเดิม TEST</button></div>
        <p class="hint">พื้นที่ทดลองเท่านั้น: กรอกข้อมูลจำลอง ไม่ใช่เครื่องจริง · หลังรีโหลดอ่านประวัติ TEST ในแท็บเดิมได้อย่างเดียว ไม่กู้นาฬิกาหรือฟอร์ม</p>
        <div data-timer-console hidden style="position:fixed;inset:3%;z-index:1000;background:#fff;padding:12px;border:1px solid #d8ddd9;box-shadow:0 8px 40px #0005;overflow:auto">
          <p>แบบบันทึกเดิม · เฉพาะ Synthetic TEST ไม่ใช่รันจริง</p><button class="button" type="button" data-timer-action="hideConsole">ปิดแบบบันทึก TEST</button>
        </div>
        <p class="hint">เก็บได้หนึ่งสรุปต่อรันในแท็บนี้ ไม่เขียนทับ · สรุปอยู่จนปิดแท็บ ไม่ใช่การสำรองข้อมูลหรือ Timer สำหรับใช้งานจริง</p>
        </details>
      </section>` : ''}
      ${run.template === 'spray' && researchMode() ? researchPanel(run) : ''}
    </aside></div>`;
}

const runInitial = run => key => typeof run.before?.[key] === 'number' && Number.isFinite(run.before[key]) ? e(run.before[key]) : '';
const latestPrediction = run => (Array.isArray(run.predictions) && run.predictions.length ? run.predictions[run.predictions.length - 1] : null);

/* หน้าทั่วไป: ค่าที่ทำนาย คำเตือน และที่มา (ไม่มีการเปรียบเทียบกับค่าจริง — อยู่ในรายละเอียดวิจัย) */
function predictionPanel(run) {
  // ค่าเริ่มต้นดึงจากแผนก่อนทดลอง (รวมที่พิมพ์ค้างอยู่) ไม่ต้องกรอกซ้ำ
  const planned = pendingValues(run, 'before', run.before || {}) || {};
  const initial = key => { const v = planned[key]; const n = v === '' || v == null ? NaN : Number(v); return Number.isFinite(n) ? e(n) : ''; };
  const saved = latestPrediction(run);
  const materialKnown = saved?.inputs?.materialSource === 'operator_selected_unverified' && predictionApi()?.isSupportedMaterial?.(saved.inputs.materialId) === true;
  const tag = text => `<span class="source">${e(text)}</span>`;
  const summary = `<dl class="recorded-fields">
      ${saved ? '' : '<div class="pred-empty"><dt>Tout ทำนาย</dt><dd>ยังไม่ได้ทำนาย</dd></div>'}
    </dl>
    ${saved ? toutCard(saved.result.tout_C, 'บันทึกในรันแล้ว') + predictionInputsLine(saved, run) : ''}
    ${saved && !materialKnown ? '<p class="hint" role="note">คำทำนายเดิมไม่มีหลักฐานชนิดวัตถุดิบที่รองรับ · ยังตรวจความเหมาะสมไม่ได้ อย่าใช้เป็นผลยืนยัน</p>' : ''}
    ${saved ? warningList(saved.warnings) : ''}
    ${saved ? `<details class="lab-extra"><summary>ที่มาและข้อจำกัดของคำทำนายนี้</summary>
      <p class="hint"><b>โปรไฟล์:</b> ${e(saved.profile.label)} · ${e(profileClassLabel(saved.profile))}</p>
      <p class="hint">${e(saved.profile.provenance.summary)}</p>
      <p class="hint"><b>ลม:</b> ${e(saved.profile.airflow_m3h)} m³/h · ${e(saved.profile.provenance.airflow)}<br><b>UA:</b> ${e(saved.profile.ua_kJhK)} kJ/(h·K) · ${e(saved.profile.provenance.ua)}</p>
      ${saved.profile.provenance.pump ? `<p class="hint"><b>ปั๊ม:</b> ค่าเต็มสเกล ${e(saved.profile.pumpFullScale_mLmin)} mL/min (อนุมาน ไม่ได้วัดที่ 100%) · ${e(saved.profile.provenance.pump)}</p>` : ''}
      <p class="hint"><b>วัตถุดิบสำหรับคำทำนาย:</b> ${saved.inputs.materialLabel ? `${e(saved.inputs.materialLabel)} · ผู้ใช้เลือก ยังไม่ยืนยัน` : 'ไม่ระบุ / ข้อมูลเดิม'}</p>
      <p class="hint"><b>Input:</b> Air-in ${e(saved.inputs.airInPct)}% · Tin ${e(saved.inputs.tin_C)} °C · ${feedEntryText(saved.inputs, run)} · ของแข็ง ${e(saved.inputs.solidsPct)}% (${saved.inputs.solidsSource === 'brix_proxy' ? '°Brix proxy' : 'Total Solids ที่กรอก'}) · สารป้อน ${e(saved.inputs.tfeed_C)} °C${saved.inputs.tfeedSource === 'model_default' ? ' (สมมติ)' : ''}</p>
      ${saved.warnings.length ? `<ul class="hint">${saved.warnings.map(w => `<li>${e(w)}</li>`).join('')}</ul>` : ''}
      <p class="hint">ทำนายเมื่อ ${timeLabel(saved.createdAt)} · สมการ ${e(saved.model.fn)} (${e(saved.model.sha256.slice(0, 12))}…) · คำทำนายทั้งหมดในรันนี้ ${run.predictions.length} ครั้ง</p>
      </details>` : ''}`;
  const dlg = `pred-notes-${e(run.id)}`;
  return `<section class="prediction pred-v2" aria-labelledby="pred-title"><h3 id="pred-title" class="sr-only">ทำนายอุณหภูมิขาออก (Tout) ก่อนเริ่มทดลอง</h3>
    <div class="scope-banner" role="note">${icon('warn')}<div><b>ใช้ได้เฉพาะเครื่อง IN-SD Mini ของแล็บนี้ · Air-in 100%</b><span>ยังไม่ยืนยันความแม่นยำครอบคลุมทุกสภาวะ · ค่าลมและ UA เป็นค่าคำนวณ ไม่ใช่การตรวจสอบอิสระ</span></div><button type="button" class="link-button" data-open-dialog="${dlg}">อ่านรายละเอียด</button></div>
    ${globalThis.LAONG_MODE?.historyApi === false ? '' : `<div class="similar-runs" data-similar-runs aria-live="polite"><h4>รันที่เคยทำใกล้เคียงกับสภาวะนี้</h4><div data-similar-body><p class="hint">กรอก Tin หรืออัตราป้อน แล้วจะแสดงรันที่เคยทำใกล้เคียงและอุณหภูมิจริงที่ได้</p></div></div>`}
    ${run.status !== 'closed' ? predictionForm(run, saved, initial) : `${summary}<p class="hint">ปิดรันแล้ว ทำนายเพิ่มไม่ได้</p>`}
    <dialog class="pred-dialog" id="${dlg}" aria-labelledby="${dlg}-t"><div class="dialog-head"><h2 id="${dlg}-t">คำเตือนและที่มา</h2><button type="button" class="button subtle" data-close-dialog aria-label="ปิด">ปิด</button></div>
      <p class="notice scope-notice pred-scope" role="note"><b>ใช้ได้กับเครื่อง IN-SD Mini ของแล็บนี้ ที่ Air-in 100% เท่านั้น</b> · ค่าลมอบแห้งและ UA เป็นค่าคำนวณ (ไม่ได้วัดด้วย flowmeter) ที่ปรับให้พอดีกับรันน้ำ 3 รอบ (7 ส.ค. 2569, Tin 160 °C) การตรงกับรันเหล่านั้นจึงไม่ใช่การตรวจสอบอิสระ · เทียบกับโปรตีนได้ 1 รันที่ Tin 150 °C เท่านั้น · <b>ยังไม่ยืนยันความแม่นยำครอบคลุมทุกสภาวะ</b> · เครื่องอื่นหรือ Air-in อื่นใช้ค่านี้ไม่ได้</p>
      <p class="hint pred-note">เติมค่าจากแผนให้แล้ว แก้ในกล่องนี้ได้ <b>โดยไม่กระทบแผนด้านบน</b>${run.status !== 'draft' ? ' (แผนถูกล็อกแล้ว)' : ''} · ผลเป็นคำทำนาย ไม่ใช่ค่าที่วัด</p>
      ${saved ? summary : '<p class="hint">ยังไม่มีคำทำนายที่บันทึกในรันนี้ ที่มาของค่าและคำเตือนของคำทำนายจะแสดงที่นี่หลังบันทึก</p>'}
      <div class="dialog-actions"><button type="button" class="button" data-close-dialog>ปิด</button></div>
    </dialog>
    </section>`;
}

/* เครื่องมือคำนวณแบบกรอกค่าเอง (ย้ายมาจากกล่อง Tout เดิม ไม่ได้ลบ) — แสดงในรายละเอียดวิจัย */
function syntheticDevForm(run) {
  const initial = runInitial(run);
  const synthetic = run.demo === true && location.hostname === '127.0.0.1' && location.port === '19012';
  return `${synthetic ? `<details class="lab-extra dev-tools-box"><summary>เครื่องมือทีมพัฒนา · คำนวณแบบกรอกค่าเอง</summary>
      <p class="hint">ข้อมูลจำลองเท่านั้น · Tin และอัตราป้อนนำมาจากแผนที่บันทึกแล้ว ตรวจค่าก่อนคำนวณ ผลไม่ใช่ค่าที่วัดจริงและไม่ถูกบันทึกลงรัน</p>
      <form data-form="synthetic-model" novalidate><div class="field-grid">
      <label>อุณหภูมิขาเข้า (°C)<input type="number" name="tin" min="120" max="200" step="any" value="${initial('tin')}"></label>
      <label>อัตราป้อน (mL/min)<input type="number" name="feed" min="0" max="20" step="any" value="${initial('feed')}"></label>
      <label>Total Solids จำลอง (%)<input type="number" name="solids" min="0" max="35" step="any"><small class="hint">ไม่ใช่ °Brix · ช่วงในแอปเดิม 0 ถึง 35%</small></label>
      <label>°Brix จำลอง<input type="number" name="brix" min="0" max="8" step="any" value="${initial('brix')}"><small class="hint">ไม่ใช่ Total Solids</small></label>
      <label>อัตราลมจำลอง (m³/h)<input type="number" name="air" min="5" max="80" step="any"></label>
      <label>UA จำลอง (kJ/(h·K))<input type="number" name="ua" min="1" max="80" step="any"></label>
      <label>อุณหภูมิห้อง (°C)<input type="number" name="room" min="15" max="40" step="any"></label>
      <label>อุณหภูมิสารป้อน (°C)<input type="number" name="feedTemp" min="0" max="80" step="any" value="${initial('tfeed')}"></label>
      </div><label><input type="checkbox" name="brixProxy"> ยอมรับใช้ °Brix จำลองเป็น proxy ชั่วคราวเมื่อไม่มี Total Solids</label>
      <p class="hint">ใช้เฉพาะเมื่อเลือกเอง ผลจะเป็น proxy ไม่ใช่ผลวัด Total Solids · อัตราลมและ UA ยังไม่ได้เชื่อมโปรไฟล์หรือคาลิเบรตเครื่องจริง</p>
      <button class="button" type="button" data-action="synthetic-model-profile">ใช้โปรไฟล์ตัวอย่าง TEST</button>
      <p class="hint">เลือกแล้วจึงเติมค่าลม, UA และอุณหภูมิห้องจากโปรไฟล์สาธิตเท่านั้น ไม่ใช่ค่าคาลิเบรตจริง</p>
      <button class="button primary" type="submit">คำนวณข้อมูลจำลอง</button>
      <p class="hint" data-model-result role="status" aria-live="polite">ยังไม่ได้คำนวณ</p>
      </form>
      <a href="/integration-tout-test.html" target="_blank" rel="noopener">ดูการทดสอบโมเดลด้วยข้อมูลจำลอง</a></details>` : ''}`;
}

/* ── รายละเอียดวิจัย (เปิดจากตั้งค่าหรือปุ่มในหน้ารัน) ── */
function researchPanel(run) {
  const C = clockApi(), CAP = captureApi(), api = predictionApi();
  const saved = latestPrediction(run);
  const reading = [...run.logs].reverse().find(log => log.data.tout != null);
  const resid = saved && reading ? api?.residual(saved, reading.data.tout) : null;
  const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`;
  const snap = C && CAP ? C.summary(run, CAP, Date.now()) : null;
  const steps = snap ? snap.transitions.map(x => `<li>${e(C.ACTION_LABELS[x.action] || x.action)} · ${timeLabel(x.at)}${Number.isFinite(x.runElapsed_min) ? ` · นาทีที่ ${x.runElapsed_min.toFixed(2)}` : ''}</li>`).join('') : '';
  const resets = Array.isArray(run.clockResets) ? run.clockResets : [];
  const resetBlock = C && CAP ? C.resetGuard(run, CAP, Date.now()) : 'นาฬิกายังไม่พร้อม';
  return `<section class="panel panel-pad aside-body research-panel">
    <h2>รายละเอียดวิจัย</h2>
    <p class="hint">สำหรับผู้พัฒนาและงานวิจัย · การซ่อน/แสดงส่วนนี้<b>ไม่ใช่ระบบสิทธิ์</b> ข้อมูลทั้งหมดยังอยู่และส่งออกในรายงานตามปกติ · ไม่มีข้อมูลใดในหน้านี้ถูกส่งเข้าชุดฝึกโมเดลอัตโนมัติ</p>

    <h3>เทียบคำทำนายกับค่าที่จด</h3>
    <dl class="recorded-fields">
      <div><dt>Tout ทำนายล่าสุด</dt><dd>${saved ? `${saved.result.tout_C.toFixed(1)} °C <span class="source">ทำนาย</span>` : 'ยังไม่ได้ทำนาย'}</dd></div>
      <div><dt>Tout ที่จดล่าสุด</dt><dd>${reading ? `${e(reading.data.tout)} °C ${sourceTag(fieldSource(run, 'during', 'number', reading.data.tout))}` : 'ยังไม่มีข้อมูล'}</dd></div>
      ${resid != null ? `<div><dt>ส่วนต่าง (จด − ทำนาย)</dt><dd>${signed(resid)} °C</dd></div>` : ''}
    </dl>
    ${reading ? `<p class="hint">จดเมื่อ ${timeLabel(reading.time)} · ค่าเดียวยังไม่ใช่ steady state ที่ยืนยัน ต้องดูหลายค่าติดกันก่อนสรุป · ห้ามใช้ทำ correction</p>` : ''}
    ${Array.isArray(run.predictions) && run.predictions.length > 1 ? `<details class="lab-extra"><summary>คำทำนายทั้งหมด (${run.predictions.length})</summary><ol class="hint">${run.predictions.map(p => `<li>${timeLabel(p.createdAt)} · ${p.result.tout_C.toFixed(1)} °C · ${e(p.profile.label)}</li>`).join('')}</ol></details>` : ''}

    <h3>นาฬิการันแบบละเอียด</h3>
    ${steps ? `<details class="lab-extra"><summary>ลำดับที่กด (${snap.transitions.length})</summary><ol class="hint">${steps}</ol></details>` : '<p class="hint">ยังไม่ได้เริ่มนาฬิกา</p>'}
    ${resets.length ? `<details class="lab-extra"><summary>ประวัติการล้างนาฬิกา (${resets.length})</summary><ol class="hint">${resets.map(r => `<li>${timeLabel(r.resetAt)} · ${e(r.reason)} · ก่อนล้าง: ${e(C?.STATUS_LABELS[r.summary?.status] || r.summary?.status || 'ไม่มีค่า')}, ${r.summary?.transitions?.length ?? 0} ขั้น · TEST</li>`).join('')}</ol></details>` : ''}
    ${run.status !== 'closed' ? `<details class="lab-extra"><summary>ล้างนาฬิกา (เฉพาะรัน TEST)</summary>
      ${resetBlock ? `<p class="hint">${e(resetBlock)}</p>` : `<form data-form="clock-reset" novalidate>
        <p class="hint">นาฬิกาเดิมจะถูกเก็บเป็นประวัติในรันนี้ ไม่ถูกลบ · ค่าที่จด คำทำนาย แผน และสถานะรันไม่ถูกแตะ</p>
        <label>เหตุผลที่ล้าง<input name="reason" maxlength="300" required></label>
        <button class="button" type="submit">ตรวจผลกระทบแล้วล้างนาฬิกา</button></form>`}
    </details>` : ''}
    <details class="lab-extra timer-gap"><summary>ส่วนนาฬิกาที่ยังไม่ได้ย้ายจากระบบเดิม</summary>
      <ul class="hint">${(C ? C.NOT_PORTED : []).map(x => `<li>${e(x)}</li>`).join('')}</ul></details>

    <h3>ยังอยู่ในระบบเดิม (ยังไม่ได้ย้ายเข้า Laong)</h3>
    <ul class="hint">
      <li>การจดอุณหภูมิรายเวลา (time series) และ Segment</li>
      <li>เหตุการณ์ละเอียดพร้อมชนิดและระดับความรุนแรง</li>
      <li>การเลือก steady window และสรุป steady state</li>
      <li>การประเมินสิทธิ์ข้อมูลสำหรับพัฒนาโมเดล (eligibility) · ระบบเดิมไม่ส่งเข้าชุดฝึกอัตโนมัติ</li>
    </ul>

    <h3>โปรไฟล์เครื่อง</h3>
    ${profileManager()}
    ${syntheticDevForm(run)}
  </section>`;
}

/* ── นาฬิการัน (ขั้นย่อย 1): แกนเดิม run-capture.js ผ่าน laong-clock.js ── */
const clockApi = () => globalThis.LAONG_CLOCK;
const captureApi = () => (typeof RUN_CAPTURE === 'undefined' ? null : RUN_CAPTURE);
const clockMin = v => (Number.isFinite(v) ? `${v.toFixed(2)} นาที` : 'ไม่มีค่า');
function clockMmss(min) {
  if (!Number.isFinite(min)) return '00:00';
  const s = Math.max(0, Math.floor(min * 60));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function timerPanel(run) {
  const C = clockApi(), CAP = captureApi();
  if (!C || !CAP) {
    return run.status === 'closed' ? '' : '<p class="hint timer-gap" role="note"><b>นาฬิการันยังไม่พร้อมในหน้านี้</b> · เปิดแอปผ่านตัวเปิด START-LAONG-TEST</p>';
  }
  const snap = C.summary(run, CAP, Date.now());
  if (run.status === 'closed' && snap.status === 'idle') return '';
  // รันจบช่วงทดลองแล้วโดยไม่ได้ใช้นาฬิกา: บอกสั้น ๆ บรรทัดเดียว ไม่ต้องโชว์ 00:00 กับคำเตือนก่อนป้อน
  if (run.status === 'results' && snap.status === 'idle') return '<div class="run-clock" id="run-clock" data-clock-run="' + e(run.id) + '" data-clock-status="idle"><h3>นาฬิการัน</h3><p class="hint">ไม่ได้ใช้นาฬิกาในรันนี้</p></div>';
  const reason = run.status === 'closed' ? null : C.guard(run, snap.status === 'idle' ? 'start_run' : 'pause');
  const isOn = a => run.status !== 'closed' && C.enabled(snap.status, a) && !C.guard(run, a);
  const anyOn = C.ACTIONS.some(isOn);
  const buttons = C.ACTIONS.map(a => {
    const on = isOn(a);
    return `<button class="button${['start_run', 'start_feed'].includes(a) ? ' primary' : ''}" type="button" data-action="clock" data-clock="${a}" ${on ? '' : 'disabled'}>${C.ACTION_LABELS[a]}</button>`;
  }).join('');
  return `<div class="run-clock" id="run-clock" data-clock-run="${e(run.id)}" data-clock-status="${e(snap.status)}">
    <h3>นาฬิการัน ${run.demo ? `<span class="source">${sharedLabel() ? 'เว็บทดลอง' : 'ข้อมูลจำลอง'}</span>` : ''}</h3>
    <p class="clock-time" data-clock-time aria-live="off">${clockMmss(snap.runElapsed_min)}</p>
    <p><b>${e(C.STATUS_LABELS[snap.status] || snap.status)}</b></p>
    ${snap.status === 'idle' ? '' : `<dl class="recorded-fields clock-fields">
      <div><dt>Warm-up</dt><dd data-clock-field="warmupElapsed_min">${clockMin(snap.warmupElapsed_min)}</dd></div>
      <div><dt>ป้อนสุทธิ</dt><dd data-clock-field="activeFeeding_min">${clockMin(snap.activeFeeding_min)}</dd></div>
      <div><dt>พักรวม</dt><dd data-clock-field="interruptionTotal_min">${clockMin(snap.interruptionTotal_min)}</dd></div>
      <div><dt>หลังป้อน</dt><dd data-clock-field="postFeedObservation_min">${clockMin(snap.postFeedObservation_min)}</dd></div>
    </dl>`}
    ${run.status !== 'closed' && !anyOn && reason ? `<p class="clock-note" role="note">${icon('lock')} ${e(reason)}</p>` : ''}
    ${run.status === 'closed' ? '' : `<div class="actions clock-actions">${buttons}</div>`}
    ${run.status !== 'closed' && ['idle', 'warmup'].includes(snap.status) ? `<p class="hint atom-reminder" role="note"><b>ก่อนป้อน:</b> ตรวจว่าลมหัวฉีดไหลจริงตาม SOP</p>` : ''}
    ${run.status !== 'closed' && ['feeding', 'paused'].includes(snap.status) ? `<p class="hint atom-reminder" role="note"><b>ขณะพ่น:</b> สังเกตรูปแบบละอองตามวิธีที่ผู้ดูแลเครื่องกำหนด · ถ้าพ่นเป็นสายให้หยุดป้อนและแจ้งผู้ดูแล</p>` : ''}
    ${reason && anyOn ? `<p class="hint" role="note">${e(reason)}</p>` : ''}
    ${researchMode() ? '<p class="hint timer-gap" role="note">นาฬิกานี้ยังไม่มี Segment, เหตุการณ์ละเอียด และการผูกเวลากับค่าที่จด แบบระบบเดิม · ดูรายการเต็มในรายละเอียดวิจัย</p>' : ''}
  </div>`;
}

let clockTick = null;
function startClockTick() {
  clearInterval(clockTick);
  clockTick = setInterval(() => {
    const box = main.querySelector('.run-clock');
    if (!box || !['warmup', 'feeding', 'paused', 'post_feed'].includes(box.dataset.clockStatus)) return;
    const run = experiments.find(r => r.id === box.dataset.clockRun);
    const C = clockApi(), CAP = captureApi();
    if (!run || !C || !CAP) return;
    const snap = C.summary(run, CAP, Date.now());
    box.querySelector('[data-clock-time]').textContent = clockMmss(snap.runElapsed_min);
    for (const el of box.querySelectorAll('[data-clock-field]')) el.textContent = clockMin(snap[el.dataset.clockField]);
  }, 1000);
}
startClockTick();

/* อัตราป้อนที่ใช้จริงในฟอร์มทำนาย (mL/min): โหมดปั๊ม % → แปลงด้วยค่าสอบเทียบของโปรไฟล์; โหมดวัดได้ → ค่าที่กรอก; ไม่พร้อม → null */
function selectedPredictionProfile(form) {
  const key = form.elements.profile?.value;
  return machineProfiles().find(p => p.key === key) || null;
}
function feedFromForm(form) {
  const mode = form.elements.feedMode.value;
  if (mode === 'measured') { const v = form.elements.feed.value.trim(); const n = Number(v); return v !== '' && Number.isFinite(n) ? { mode, mLmin: n } : null; }
  const profile = selectedPredictionProfile(form), v = form.elements.pumpPct.value.trim(), pct = Number(v);
  if (!profile || !(profile.pumpFullScale_mLmin > 0) || v === '' || !Number.isFinite(pct)) return null;
  return { mode, mLmin: Math.round(pct / 100 * profile.pumpFullScale_mLmin * 10000) / 10000, pct, profile };
}
function updateFeedConverted(form) {
  const out = form?.querySelector('[data-feed-converted]');
  if (!out) return;
  const mode = form.elements.feedMode.value;
  for (const label of form.querySelectorAll('[data-feed-field]')) {
    const on = label.dataset.feedField === mode;
    label.hidden = !on;
    label.querySelector('input').disabled = !on;
  }
  if (mode === 'measured') { out.textContent = 'ใช้ค่าที่กรอกตามที่ระบุว่าวัดได้จริง (ผู้ใช้ระบุ ระบบไม่ตรวจซ้ำ)'; return; }
  const profile = selectedPredictionProfile(form), raw = form.elements.pumpPct.value.trim(), pct = Number(raw);
  if (!profile || !(profile.pumpFullScale_mLmin > 0)) { out.textContent = 'โปรไฟล์นี้ไม่มีค่าสอบเทียบปั๊ม · เปลี่ยนเป็นกรอกอัตราป้อนที่วัดได้ (mL/min)'; return; }
  if (raw === '') { out.textContent = `กรอกค่าปั๊มตามหน้าเครื่อง (แปลงด้วยค่าเต็มสเกล ${profile.pumpFullScale_mLmin} mL/min ซึ่งอนุมานจากการวัดน้ำที่ ${profile.pumpCalibratedAtPct ?? '?'}% ไม่ได้วัดที่ 100%)`; return; }
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) { out.textContent = 'ค่าปั๊มต้องอยู่ระหว่าง 0 ถึง 100%'; return; }
  const feed = feedFromForm(form), cal = profile.pumpCalibratedAtPct;
  let text = `= ${feed.mLmin} mL/min · proxy จากการสอบเทียบน้ำ (ค่าเต็มสเกล ${profile.pumpFullScale_mLmin} mL/min อนุมานจากการวัดที่ ${cal ?? '?'}%) ไม่ใช่อัตราป้อนจริงของสาร`;
  if (feed.mLmin > 20) text += ' · เกินช่วงที่โมเดลรับ (0 ถึง 20 mL/min) คำนวณไม่ได้';
  else if (cal != null && pct > cal) text += ` · สูงกว่าจุดที่สอบเทียบปั๊ม (${cal}%) เป็นการประมาณนอกช่วงที่วัด`;
  else if (cal != null) text += ` · อยู่ในช่วงที่ใช้ได้ แต่วัดปริมาตรจริงไว้จุดเดียวที่ ${cal}%`;
  else if (cal == null) text += ' · โปรไฟล์ไม่ระบุจุดสอบเทียบปั๊ม';
  out.textContent = text;
}
let similarTimer = null, similarSeq = 0;
function refreshSimilar() {
  clearTimeout(similarTimer);
  similarTimer = setTimeout(async () => {
    const box = main.querySelector('[data-similar-body]'), form = main.querySelector('form[data-form="run-prediction"]');
    if (!box || !form) return;
    const q = new URLSearchParams();
    for (const [k, name] of [['tin', 'tin'], ['brix', 'brix']]) { const v = form.elements[name]?.value.trim(); if (v) q.set(k, v); }
    const feedNow = feedFromForm(form);
    if (feedNow) q.set('feed', String(feedNow.mLmin));
    if (form.elements.materialId?.value) q.set('material', form.elements.materialId.value);
    if (![...q.keys()].length) { box.innerHTML = '<p class="hint">กรอก Tin หรืออัตราป้อน แล้วจะแสดงรันที่เคยทำใกล้เคียงและอุณหภูมิจริงที่ได้</p>'; return; }
    const mine = ++similarSeq;
    try {
      const res = await fetch('/api/history/similar?' + q + '&k=3', { credentials: 'same-origin', cache: 'no-store' });
      if (mine !== similarSeq || !box.isConnected) return;
      if (res.status === 401) { box.innerHTML = '<p class="hint">ใส่รหัสเข้าใช้ที่หน้า <a href="/insights">ข้อมูลย้อนหลัง</a> หนึ่งครั้ง แล้วรันใกล้เคียงจะแสดงตรงนี้</p>'; return; }
      const body = await res.json();
      if (!res.ok || !globalThis.LaongInsights) { box.innerHTML = '<p class="hint">ดูรันใกล้เคียงไม่ได้ในตอนนี้</p>'; return; }
      box.innerHTML = globalThis.LaongInsights.similarMarkup(body.results, 3, body.timeSummary) + '<p class="hint">ใช้ประกอบการตัดสินใจเท่านั้น · รันที่ผ่านมาเป็นวัตถุดิบ/สูตรคนละชุด อาจให้ผลต่างกัน</p>';
    } catch { if (box.isConnected) box.innerHTML = '<p class="hint">ดูรันใกล้เคียงไม่ได้ในตอนนี้</p>'; }
  }, 450);
}
function lastTout(run) { const r = [...(run.logs || [])].reverse().find(log => log.data?.tout != null && log.data.tout !== ''); const n = r ? Number(r.data.tout) : NaN; return Number.isFinite(n) ? n : null; }
function predictionLine(run) {
  const saved = latestPrediction(run);
  if (!saved) return '';
  const t = lastTout(run);
  const diff = t == null ? '' : ` · Tout ที่จดล่าสุด <b>${t.toFixed(1)} °C</b> (ต่าง ${t - saved.result.tout_C > 0 ? '+' : t - saved.result.tout_C < 0 ? '−' : '±'}${Math.abs(t - saved.result.tout_C).toFixed(1)})`;
  return `<p class="pred-line hint" role="note">ทำนายก่อนทดลอง <b>${saved.result.tout_C.toFixed(1)} °C</b>${diff} · <span class="source">ทำนาย ไม่ใช่ค่าวัด</span>${researchMode() ? '' : ' · ดูการวิเคราะห์ส่วนต่างในรายละเอียดวิจัย'}</p>`;
}
function predictionChip(run) {
  const saved = latestPrediction(run);
  return saved ? `<p class="pred-chip" data-pred="${e(saved.result.tout_C)}" role="note">คาดการณ์ Tout <b>${saved.result.tout_C.toFixed(1)} °C</b> <span data-pred-diff class="hint"></span></p>` : '';
}
function predictionForm(run, saved, initial) {
  if (!predictionApi() || physicsIntegrity === 'unavailable') return '<p class="hint">ยังทำนายในหน้านี้ไม่ได้: ไม่พบไฟล์สมการ (เปิดแอปผ่านตัวเปิด START-LAONG-TEST)</p>';
  if (physicsIntegrity === 'mismatch') return '<p class="hint"><b>ปิดการทำนาย:</b> ไฟล์สมการไม่ตรงกับฉบับที่ตรวจแล้ว แจ้งทีมพัฒนา</p>';
  const profiles = machineProfiles();
  const preview = predictionPreview?.runId === run.id ? predictionPreview.snapshot : null;
  const options = profiles.map((p, i) => `<option value="${e(p.key)}" ${i === 0 ? 'selected' : ''}>${e(p.label)} · ${e(profileClassLabel(p))}</option>`).join('');
  const id = e(run.id);
  const resultNow = preview ? predictionPreviewMarkup(preview)
    : saved ? toutCard(saved.result.tout_C, 'บันทึกในรันแล้ว') + warningList(saved.warnings)
    : `<div class="pred-empty-state"><img src="laong-assets/icons/mascot-idle.svg" width="72" height="78" alt=""><p><b>ยังไม่ได้คำนวณ</b><span>เลือกวัตถุดิบ กรอก Tin กับค่าปั๊ม แล้วกด "คำนวณ" ละอองจะบอกคำทำนายพร้อมคำเตือนที่ต้องอ่าน</span></p></div>`;
  return `<form data-form="run-prediction" novalidate class="pred-grid">
    <div class="pred-col pred-inputs"><h4>เงื่อนไขทำนาย</h4>
      <div class="field-grid compact">
        <label>ชนิดวัตถุดิบ<select name="materialId" required><option value="">เลือกชนิดวัตถุดิบ</option><option value="water">น้ำ</option><option value="pinto">ถั่วลายเสือ</option><option value="soy">ถั่วเหลือง</option><option value="mango_measured">เนื้อมะม่วง · ข้อมูลอ้างอิงบางส่วนไม่พร้อม</option><option value="mango_ndm">มะม่วงน้ำดอกไม้</option><option value="mango_usda">มะม่วง Tommy Atkins / Kent / Keitt</option><option value="mango_generic">มะม่วงไม่ระบุพันธุ์</option><option value="mung_bean">ถั่วเขียว · ยังไม่รองรับคำทำนาย</option><option value="other">อื่น ๆ · ยังไม่รองรับคำทำนาย</option></select></label>
        <label>อุณหภูมิขาเข้า Tin (°C)<input type="number" name="tin" min="120" max="200" step="any" inputmode="decimal" value="${initial('tin')}" required></label>
        <label>Air-in Volume (%)<input type="number" name="airIn" min="1" max="100" step="any" inputmode="decimal" value="${e(profiles[0]?.airInPct ?? '')}" required></label>
        <fieldset class="feed-entry" aria-describedby="feed-converted">
          <legend>อัตราป้อน</legend>
          <div class="feed-mode">
            <label class="check-row"><input type="radio" name="feedMode" value="pump_pct" checked> กรอกค่าปั๊ม (% ตามหน้าเครื่อง)</label>
            <label class="check-row"><input type="radio" name="feedMode" value="measured"> กรอกอัตราป้อนที่วัดได้ (mL/min)</label>
          </div>
          <label data-feed-field="pump_pct">ค่าปั๊ม (%)<input type="number" name="pumpPct" min="0" max="100" step="any" inputmode="decimal"></label>
          <label data-feed-field="measured" hidden>อัตราป้อนที่วัดได้ (mL/min)<input type="number" name="feed" min="0" max="20" step="any" inputmode="decimal" disabled></label>
          <p class="hint" id="feed-converted" data-feed-converted role="status" aria-live="polite">กรอกค่าปั๊มตามหน้าเครื่อง ระบบจะแสดงค่าที่แปลงเป็น mL/min</p>
          <p class="hint" data-plan-feed-hint>${initial('feed') ? `แผนระบุอัตราป้อนตั้งต้น ${initial('feed')} mL/min · ถ้าเป็นค่าที่ตั้งจากปั๊ม ให้กรอกเป็น % ตามหน้าเครื่อง` : ''}</p>
        </fieldset>
        <label>Total Solids (%)<input type="number" name="solidsPct" min="0" max="35" step="any" inputmode="decimal" value="${initial('solids')}"></label>
        <label>°Brix<input type="number" name="brix" min="0" max="8" step="any" inputmode="decimal" value="${initial('brix')}"></label>
      </div>
      <p class="hint">Air-in ต้องตรงกับที่โปรไฟล์คาลิเบรตไว้</p>
      <label class="check-row" data-brix-proxy-row hidden><input type="checkbox" name="useBrixProxy"> ใช้ °Brix เป็น proxy ชั่วคราว</label>
      <p class="hint" data-brix-proxy-note>ถ้ากรอกแค่ °Brix (ไม่กรอก Total Solids) ระบบจะใช้ °Brix เป็น proxy ให้เอง และขึ้นคำเตือนว่า °Brix ไม่เท่ากับ Total Solids</p>
      <div class="pred-tools">
        <button type="button" class="button" data-open-dialog="pred-profile-${id}">${icon('settings')} โปรไฟล์เครื่องและสารป้อน</button>
        <button type="button" class="button" data-open-dialog="pred-target-${id}">${icon('search')} หาสภาวะจาก Tout เป้าหมาย</button>
      </div>
      <p class="pred-profile-now">โปรไฟล์ที่ใช้ · <span data-profile-now>${e(profiles[0] ? `${profiles[0].label} · ${profileClassLabel(profiles[0])}` : 'ยังไม่มีโปรไฟล์')}</span></p>
      <div class="actions"><button class="button primary" type="submit">คำนวณ</button></div>
    </div>
    <div class="pred-col pred-output"><h4>ผลทำนาย</h4>
      <div data-prediction-result role="status" aria-live="polite">${resultNow}</div>
      <button class="button primary pred-save" type="button" data-action="save-prediction" ${preview ? '' : 'disabled'}>${icon('done')} บันทึกค่าทำนายลงรัน</button>
    </div>
    <dialog class="pred-dialog" id="pred-profile-${id}" aria-labelledby="pred-profile-${id}-t"><div class="dialog-head"><h2 id="pred-profile-${id}-t">โปรไฟล์เครื่องและสารป้อน</h2><button type="button" class="button subtle" data-close-dialog>ปิด</button></div>
      <div class="field-grid compact">
        <label>โปรไฟล์เครื่อง<select name="profile">${options}</select></label>
        <label>อุณหภูมิสารป้อน (°C)<input type="number" name="tfeed" min="0" max="80" step="any" inputmode="decimal" value="${initial('tfeed')}"><small class="hint">เว้นว่าง = 25 °C (สมมติ)</small></label>
      </div>
      <p class="hint">Air-in ต้องตรงกับที่โปรไฟล์สอบเทียบ · โปรไฟล์สาธิตห้ามใช้อ้างอิงเครื่องจริง</p>
      <div class="dialog-actions"><button type="button" class="button primary" data-close-dialog>ใช้ค่าชุดนี้</button></div>
    </dialog>
    <dialog class="pred-dialog" id="pred-target-${id}" aria-labelledby="pred-target-${id}-t"><div class="dialog-head"><h2 id="pred-target-${id}-t">หาสภาวะจาก Tout เป้าหมาย</h2><button type="button" class="button subtle" data-close-dialog>ปิด</button></div>
      <div class="field-grid compact"><label>Tout ที่ต้องการ (°C)<input type="number" name="targetTout" min="30" max="120" step="any" inputmode="decimal"></label></div>
      <p class="hint">ใช้วัตถุดิบ Air-in และ °Brix ที่กรอกด้านบน · ค้นเฉพาะ Tin 120 ถึง 160 °C และค่าปั๊มไม่เกินจุดที่สอบเทียบ</p>
      <div data-target-result role="status" aria-live="polite"></div>
      <div class="dialog-actions"><button type="button" class="button" data-close-dialog>ยกเลิก</button><button class="button primary" type="button" data-action="find-target">หาสภาวะที่ใกล้เคียง</button></div>
    </dialog>
    </form>`;
}

/* ตัวเลข Tout ที่ทำนาย: ใหญ่ อ่านง่าย และต้องมีป้าย "คำทำนาย ไม่ใช่ค่าวัดจริง" ติดอยู่เสมอ (ห้ามแสดงเดี่ยว ๆ เหมือนค่าที่วัด) */
function feedEntryText(inputs, run) {
  const fe = inputs.feedEntry;
  if (fe && fe.mode === 'pump_pct') {
    const range = fe.withinCalibratedRange === false ? ` · สูงกว่าจุดที่สอบเทียบปั๊ม (${e(fe.pumpCalibratedAtPct)}%)` : fe.withinCalibratedRange === null ? ' · ไม่ระบุจุดสอบเทียบปั๊ม' : '';
    return `ค่าปั๊มที่กรอก ${e(fe.entered)}% → ${e(fe.converted_mLmin)} mL/min (proxy จากการสอบเทียบน้ำ ค่าเต็มสเกล ${e(fe.pumpFullScale_mLmin)} mL/min อนุมานจากจุดวัดที่ ${e(fe.pumpCalibratedAtPct ?? '?')}% · ไม่ใช่อัตราป้อนจริงของสาร${range})`;
  }
  const measured = inputs.feedSource === 'measured';
  return `ป้อน ${e(inputs.feed_mLmin)} mL/min (${measured ? (run && run.demo ? 'ผู้ใช้ระบุว่าวัด · TEST' : 'ผู้ใช้ระบุว่าวัด') : 'proxy จากปั๊ม'})`;
}
function predictionInputsLine(snap, run) {
  const i = snap.inputs;
  return `<p class="pred-used hint"><b>ค่าที่ใช้ทำนาย:</b> Tin ${e(i.tin_C)} °C · ${feedEntryText(i, run)} · Air-in ${e(i.airInPct)}% · ของแข็ง ${e(i.solidsPct)}% (${i.solidsSource === 'brix_proxy' ? '°Brix proxy' : 'Total Solids'}) · ${e(i.materialLabel || 'ไม่ระบุวัตถุดิบ')}</p>`;
}
function toutCard(valueC, savedState) {
  return `<div class="tout-card" role="group" aria-label="ผลทำนายอุณหภูมิขาออก ไม่ใช่ค่าที่วัดจริง">
    <div class="tout-label">อุณหภูมิขาออกที่ทำนาย</div>
    <div class="tout-value"><span class="tout-num mono">${valueC.toFixed(1)}</span><span class="tout-unit">°C</span></div>
    <div class="tout-badges"><span class="pred-badge">คำทำนาย · ไม่ใช่ค่าวัดจริง</span> <span class="source">${e(savedState)}</span></div>
  </div>`;
}
/* คำเตือนที่เกี่ยวกับ "ความถูกต้องของคำทำนาย" (นอกช่วง/ไม่มีจุดยืนยัน/โปรไฟล์สาธิต) เปิดให้เห็นเสมอ
 * หมายเหตุเรื่องค่าที่กรอก (proxy, ค่าเริ่มต้นของโมเดล) แยกเป็นกลุ่มรอง ยังเห็นได้ครบแต่ไม่ท่วมหน้าจอ — ไม่มีข้อใดถูกลบ */
const minorWarning = w => /proxy|ค่าเริ่มต้นของโมเดล/.test(w);
function warningList(warnings) {
  if (!warnings.length) return '';
  const major = warnings.filter(w => !minorWarning(w)), minor = warnings.filter(minorWarning);
  const li = list => list.map(w => `<li>${e(w)}</li>`).join('');
  return `<div class="pred-warnings-visible" role="note">${major.length ? `<b>คำเตือนที่ต้องอ่านก่อนใช้ค่านี้</b><ul class="hint">${li(major)}</ul>` : ''}
    ${minor.length ? `<details class="pred-minor" ${major.length ? '' : 'open'}><summary>หมายเหตุเรื่องค่าที่กรอก (${minor.length})</summary><ul class="hint">${li(minor)}</ul></details>` : ''}</div>`;
}
function predictionPreviewMarkup(snapshot) {
  return `${toutCard(snapshot.result.tout_C, 'ยังไม่บันทึก')}${warningList(snapshot.warnings)}`;
}

function profileManager() {
  if (!predictionApi()) return '';
  const imported = importedProfiles();
  return `<details class="lab-extra"><summary>จัดการโปรไฟล์เครื่อง</summary>
    ${machineProfiles().map(p => `<div class="profile-row"><p><b>${e(p.label)}</b> · ${e(profileClassLabel(p))}<br>
      <span class="hint">Air-in ${e(p.airInPct)}% · ลม ${e(p.airflow_m3h)} m³/h · UA ${e(p.ua_kJhK)} kJ/(h·K) · ห้อง ${e(p.room_C)} °C${p.calibratedAt ? ` · คาลิเบรต ${e(p.calibratedAt)}` : ''}</span><br>
      <span class="hint">${e(p.provenance.summary)}</span></p>
      ${p.builtin ? '' : `<button class="button" type="button" data-action="remove-profile" data-profile="${e(p.key)}">ลบออกจากเครื่องนี้</button>`}</div>`).join('')}
    <p class="hint">โปรไฟล์เครื่องจริงรับเป็นไฟล์ <code>.laong-profile.json</code> จากทีมเท่านั้น เก็บไว้ในเบราว์เซอร์ของเครื่องนี้ ไม่ส่งไปที่ใด${imported.length ? '' : ' · ตอนนี้ยังไม่มีโปรไฟล์เครื่องจริงในเครื่องนี้'}</p>
    <button class="button" type="button" data-action="import-profile">นำเข้าโปรไฟล์จากไฟล์ทีม</button>
    <input type="file" accept=".json,application/json" data-profile-file hidden>
  </details>`;
}

function readPredictionInput(form) {
  const f = form.elements;
  return { materialId: f.materialId.value, airIn: f.airIn.value, tin: f.tin.value, feed: f.feed.value, feedMode: f.feedMode.value, pumpPct: f.pumpPct.value,
    solidsPct: f.solidsPct.value, brix: f.brix.value, useBrixProxy: f.useBrixProxy.checked || (f.solidsPct.value.trim() === '' && f.brix.value.trim() !== ''), tfeed: f.tfeed.value };
}

function render(focusMain = false) {
  unmountMascot?.();
  unmountMascot = undefined;
  window.unmountLaongMonitor?.();
  const { name, id } = route();
  const selected = name === 'run' ? experiments.find((run) => encodeURIComponent(run.id) === id) : null;
  const page = name === 'run' ? 'runs' : name;
  const admin = name.startsWith('admin');
  const executive = name.startsWith('executive');
  const preview = admin || executive;
  if (preview) document.querySelector('#notification').hidden = true;
  const hiddenPages = globalThis.LAONG_MODE?.sharedView ? globalThis.LAONG_MODE.hiddenWhenShared : [];
  const pages = (admin ? adminPages : executive ? executivePages : operatorPages).filter(([key]) => !hiddenPages.includes(key));
  const unread = preview ? 0 : alerts().filter(({ key }) => !labWorkspace.readAlerts.includes(key)).length;
  document.querySelector('#navigation').innerHTML = `<span class="nav-heading">${admin ? 'พรีวิว Admin' : executive ? 'พรีวิวผู้บริหาร' : 'สมุดบันทึกการทดลอง'}</span>` + pages.map(([key, glyph, label]) =>
    `<a class="nav-link" href="#${key}" ${key === page ? 'aria-current="page"' : ''}>${icon(glyph)}${label}${key === 'notifications' && unread ? `<span class="nav-count mono">${unread}</span>` : ''}</a>`).join('') +
    (preview ? `<a class="nav-link" href="#settings">${icon('back')} กลับพื้นที่ทดลอง</a>` : '');
  document.querySelector('.rail-footer').innerHTML = `<span class="rail-indicator"></span><div>${preview ? 'ข้อมูลสังเคราะห์' : e(labWorkspace.preferences.name || 'พื้นที่ทดลองบนเครื่อง')}<small>${preview ? 'พรีวิวหน้าจอ' : 'ข้อมูลอยู่ในเบราว์เซอร์นี้'}</small></div>`;
  document.querySelector('#breadcrumb').textContent = selected ? `การทดลอง / ${selected.id}` : preview ? 'ข้อมูลสังเคราะห์' : 'พื้นที่ทำงาน';
  if (selected && detailId !== id) {
    currentPhase = ['draft', 'ready'].includes(selected.status) ? 0 : selected.status === 'running' ? 1 : 2;
  }
  detailId = selected ? id : '';
  const views = {
    today, templates: templatePage, runs: () => listPage(false), history: () => listPage(true), machines: machinesPage,
    notifications: notificationsPage, settings: settingsPage, calendar: calendarPage,
    insights: () => pageHead('ข้อมูลย้อนหลัง', 'กราฟรันจริงที่ผ่านมา และค้นหาสภาวะใกล้เคียงก่อนตั้งค่าเครื่อง') + '<div id="insights-root" aria-live="polite">กำลังเปิดข้อมูลย้อนหลัง</div>',
    monitor: () => pageHead('ติดตามเครื่อง', 'ทดลองดูสถานะเครื่องและภาพกล้อง') + '<div id="monitor-root" aria-live="polite">กำลังเปิดหน้าจำลอง</div>',
  };
  main.innerHTML = selected ? detail(selected) : name === 'run' ? pageHead('ไม่พบรัน', 'เปิดรันจากรายการการทดลองอีกครั้ง', '<a class="button" href="#runs">กลับไปรายการ</a>') :
    name === 'admin-monitor' ? pageHead('การเชื่อมต่อเครื่อง', 'ตั้งค่าการแสดงผลในโหมดจำลอง') + '<div id="monitor-root" aria-live="polite">กำลังเปิดหน้าจำลอง</div>' :
    admin ? '<div id="admin-preview" class="admin-preview" aria-busy="true"><p role="status">กำลังเปิดพื้นที่ Admin</p></div>' : executive ? executivePage(name === 'executive-reports') : views[name]();
  const adminRoot = main.querySelector('#admin-preview');
  if (adminRoot) mountAdminPreview(adminRoot, name);
  // ปุ่มลอยต้องอยู่ที่ body (ใน main มีตัวห่อที่ทำให้ position:fixed เกาะผิดที่) — สร้างใหม่ทุกครั้งที่วาดหน้า
  document.querySelector('.jump-fab')?.remove();
  if (selected && selected.template === 'spray' && selected.status === 'running' && currentPhase === 1) {
    const fab = document.createElement('button');
    fab.type = 'button'; fab.className = 'button primary jump-fab'; fab.dataset.action = 'jump-clock'; fab.dataset.dir = 'clock'; fab.textContent = 'ไปที่นาฬิกา';
    document.body.append(fab);
  }
  updateJumpButton();
  if (main.querySelector('[data-similar-runs]')) { refreshSimilar(); updateFeedConverted(main.querySelector('form[data-form="run-prediction"]')); }
  const insights = main.querySelector('#insights-root');
  if (insights) { if (globalThis.LaongInsights) globalThis.LaongInsights.mount(insights); else insights.textContent = 'หน้าข้อมูลย้อนหลังยังไม่พร้อมในเวอร์ชันนี้'; }
  const mascot = main.querySelector('[data-mascot]');
  if (mascot) unmountMascot = mountLaongMascot(mascot);
  const monitor = main.querySelector('#monitor-root');
  if (monitor) window.loadLaongMonitor().then(() => {
    if (monitor.isConnected) window.unmountLaongMonitor = window.mountLaongMonitor(monitor, admin);
  }).catch(() => {
    monitor.textContent = 'เปิดหน้าจำลองไม่ได้ ลองตรวจอินเทอร์เน็ตแล้วโหลดหน้าใหม่';
  });
  const filters = listFilters.get(name);
  if (filters) {
    main.querySelector('#search').value = filters.search;
    main.querySelector('#type-filter').value = filters.type;
    const stage = main.querySelector('#status-filter');
    if (stage) stage.value = filters.stage;
  }
  if (name === 'runs' || name === 'history') filterList();
  if (focusMain) main.focus({ preventScroll: true });
  updateLabClock();
}

function confirmDeletion(title, description) {
  const popup = document.querySelector('#delete-confirmation');
  if (popup.open) return Promise.resolve(false);
  popup.returnValue = 'cancel';
  popup.querySelector('h2').textContent = title;
  popup.querySelector('p').textContent = description;
  return new Promise(resolve => {
    const listeners = new AbortController();
    const finish = (value) => {
      listeners.abort();
      popup.close(value);
      resolve(value === 'delete');
    };
    const options = { signal: listeners.signal };
    popup.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(event.submitter?.value === 'delete' ? 'delete' : 'cancel');
    }, options);
    popup.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish('cancel');
    }, options);
    popup.showModal();
  });
}

function message(text, celebrate = false) {
  const notice = document.querySelector('#notification');
  notice.textContent = text;
  notice.classList.toggle('notification-celebration', celebrate);
  if (celebrate) {
    const mascot = new Image(40, 44);
    mascot.src = 'laong-assets/icons/mascot-done.svg';
    mascot.alt = '';
    notice.prepend(mascot);
  }
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 3200);
}

let requestedMachine = '';
function showCreate(template, machine) {
  createForm.reset();
  document.querySelector('#create-error').hidden = true;
  requestedMachine = machine || '';
  templateSelect.value = template || 'spray';
  document.querySelector('#template-help').textContent = templates[templateSelect.value].description;
  dialog.showModal();
}

function currentRun() {
  return experiments.find((run) => encodeURIComponent(run.id) === route().id);
}

function readFields(form, spec) {
  const values = new FormData(form);
  return Object.fromEntries(spec.flatMap(([key, , type]) => {
    const raw = String(values.get(key) ?? '').trim();
    return raw ? [[key, type === 'number' ? Number(raw) : raw]] : [];
  }));
}

function canSaveNumbers(form) {
  const invalid = [...form.querySelectorAll('input[type="number"]')].find((input) => !input.validity.valid);
  if (!invalid) return true;
  invalid.reportValidity();
  return false;
}

async function advance(run, changes = {}, stage) {
  const [next] = transitions[run.status];
  const now = new Date().toISOString();
  const timing = next === 'running' ? { startedAt: now } : next === 'results' ? { feedEndedAt: now } : next === 'closed' ? { closedAt: now } : {};
  if (!await replace(run, { ...run, ...changes, ...timing, status: next, stageChangedAt: now })) return;
  if (stage) pendingForms.delete(formKey(run, stage));
  currentPhase = ['ready', 'draft'].includes(next) ? 0 : next === 'running' ? 1 : 2;
  render(true);
  message(`เปลี่ยนสถานะเป็น ${statuses[next]}`, next === 'closed');
}

async function createRun(title, template, before = {}, demo = false) {
  const from = route().name;
  const realPreview = isRealPreviewOrigin();
  if (realPreview && demo) { message('ไม่คัดลอกรันทดสอบเข้าโหมดจริง'); return false; }
  let run;
  const saved = await writeRuns((latest) => {
    const sequence = latest.reduce((max, record) => Math.max(max, Number(record.id.slice(2)) || 0),
      Number(localStorage.getItem(storageKey + '.lastDeletedId')) || 0) + 1;
    run = { id: `R-${String(sequence).padStart(3, '0')}`, title, template, templateVersion: 1,
      status: 'draft', createdAt: new Date().toISOString(), before, logs: [], after: {},
      // Real-preview creation is dormant: workspace.tsx still blocks this origin.
      demo: !realPreview, dataOrigin: realPreview ? 'real' : 'test',
      ...(realPreview ? {appEnvironment:'local-pilot-preview'} : {}) };
    return [run, ...latest];
  });
  if (!saved) return false;
  location.hash = runLink(run, from);
  return true;
}

templateSelect.innerHTML = Object.entries(templates).map(([key, value]) => `<option value="${key}">${value.name}</option>`).join('');
templateSelect.addEventListener('change', () => {
  document.querySelector('#template-help').textContent = templates[templateSelect.value].description;
});
createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (createForm.getAttribute('aria-busy') === 'true') return;
  const fields = new FormData(createForm);
  const title = String(fields.get('title')).trim();
  if (!title) {
    createForm.elements.title.focus();
    document.querySelector('#create-error').textContent = 'กรอกชื่อการทดลองก่อนสร้างรัน';
    document.querySelector('#create-error').hidden = false;
    return;
  }
  const template = templateSelect.value;
  const machine = requestedMachine || labWorkspace.preferences.defaultMachine;
  document.querySelector('#create-error').hidden = true;
  setCreateBusy(true);
  try {
    if (!await createRun(title, template, machine && template === 'spray' ? { machine } : {})) {
      document.querySelector('#create-error').textContent = 'สร้างรันไม่ได้ ข้อมูลที่กรอกยังอยู่ ลองอีกครั้ง';
      document.querySelector('#create-error').hidden = false;
      return;
    }
    dialog.close();
    message('สร้างรันแล้ว · กรอกแผนก่อนทดลองได้เลย', true);
  } finally {
    setCreateBusy(false);
  }
});

function setCreateBusy(busy) {
  createForm.setAttribute('aria-busy', String(busy));
  document.querySelector('#create-pending').hidden = !busy;
  for (const control of createForm.elements) control.disabled = busy;
}

dialog.addEventListener('cancel', (event) => {
  if (createForm.getAttribute('aria-busy') === 'true') event.preventDefault();
});

main.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'clock-reset') {
    const run = currentRun(), C = clockApi(), CAP = captureApi();
    if (!run || !C || !CAP) return;
    const reason = String(form.elements.reason.value || '').trim();
    const plan = C.resetImpact(run, CAP, Date.now());
    if (!plan.ok) { message(plan.error); return; }
    if (reason.length < 3) { message('ระบุเหตุผลที่ล้างนาฬิกาก่อน (อย่างน้อย 3 ตัวอักษร)'); form.elements.reason.focus(); return; }
    const i = plan.impact;
    const ok = confirm(`ล้างนาฬิกาของรัน ${run.id} (TEST)?\n\n`
      + `จะรีเซ็ต: นาฬิกาสถานะ "${C.STATUS_LABELS[i.clockStatus] || i.clockStatus}" · กดไปแล้ว ${i.transitions} ขั้น · ป้อนสุทธิ ${clockMin(i.activeFeeding_min)}\n`
      + `นาฬิกาเดิมเก็บเป็นประวัติในรันนี้ (ครั้งที่ ${i.previousResets + 1}) ไม่ถูกลบ\n\n`
      + `ไม่แตะ: ค่าที่จด ${i.keptReadings} รายการ · คำทำนาย ${i.keptPredictions} ครั้ง · แผน · สถานะรัน\n\nเหตุผล: ${reason}`);
    if (!ok) return;
    let error = null, changedKeys = [];
    const saved = await writeRuns(latest => {
      const current = latest.find(r => r.id === run.id);
      const out = C.reset(current, reason, CAP, Date.now());
      if (!out.ok) { error = out.error; return false; }
      changedKeys = Object.keys(out.changes || {});
      return latest.map(r => (r.id === run.id ? { ...r, ...out.changes } : r));
    });
    if (saved) { adoptOwnWrite(run.id, changedKeys.concat(['feedClock'])); message('ล้างนาฬิกาแล้ว · นาฬิกาเดิมเก็บเป็นประวัติ'); render(); }
    else message(error || 'ล้างนาฬิกาไม่ได้ ลองอีกครั้ง');
    return;
  }
  if (form.dataset.form === 'run-prediction') {
    const out = form.querySelector('[data-prediction-result]');
    const save = form.querySelector('[data-action="save-prediction"]');
    const run = currentRun();
    predictionPreview = null; save.disabled = true;
    if (!run || run.template !== 'spray' || run.status === 'closed') { out.innerHTML = '<p class="hint">รันนี้ทำนายไม่ได้</p>'; return; }
    if (physicsIntegrity !== 'ok') { out.innerHTML = '<p class="hint">ยังตรวจไฟล์สมการไม่เสร็จหรือไม่ผ่าน ลองใหม่อีกครั้ง</p>'; return; }
    const profile = machineProfiles().find(p => p.key === form.elements.profile.value);
    const result = predictionApi().compute(readPredictionInput(form), profile, physicsApi());
    if (!result.ok) {
      out.innerHTML = `<p class="hint"><b>ยังคำนวณไม่ได้:</b> ${e(result.error)}</p>`;
      if (result.field && form.elements[result.field]) form.elements[result.field].focus();
      return;
    }
    predictionPreview = { runId: run.id, snapshot: result.snapshot };
    out.innerHTML = predictionPreviewMarkup(result.snapshot);
    save.disabled = false;
    return;
  }
  if (form.dataset.form === 'synthetic-model') {
    const resultEl = form.querySelector('[data-model-result]');
    const run = currentRun();
    if (location.hostname !== '127.0.0.1' || location.port !== '19012' || run?.demo !== true || run.template !== 'spray') {
      resultEl.textContent = 'ใช้ได้เฉพาะรันตัวอย่างในพื้นที่ทดสอบ'; return;
    }
    const specs = [['tin','อุณหภูมิขาเข้า',120,200],['feed','อัตราป้อน',0,20],
      ['air','อัตราลม',5,80],['ua','UA',1,80],['room','อุณหภูมิห้อง',15,40],['feedTemp','อุณหภูมิสารป้อน',0,80]];
    const values = {};
    for (const [key,label,min,max] of specs) {
      const input = form.elements[key];
      const text = String(input.value).trim();
      const value = text === '' ? NaN : Number(text);
      if (!Number.isFinite(value) || value < min || value > max) {
        resultEl.textContent = `ยังคำนวณไม่ได้ · ตรวจ ${label} (${min} ถึง ${max})`;
        input.focus(); return;
      }
      values[key] = value;
    }
    const solidsText = String(form.elements.solids.value).trim();
    const solids = solidsText === '' ? null : Number(solidsText);
    const brixText = String(form.elements.brix.value).trim();
    const brix = brixText === '' ? null : Number(brixText);
    let solidsSource = 'Total Solids จำลองที่ผู้ใช้กรอก';
    if (solidsText !== '' && (!Number.isFinite(solids) || solids < 0 || solids > 35)) {
      resultEl.textContent = 'ยังคำนวณไม่ได้ · ตรวจ Total Solids (0 ถึง 35)'; form.elements.solids.focus(); return;
    }
    if (solids !== null) values.solids = solids;
    else if (form.elements.brixProxy.checked && brix !== null && Number.isFinite(brix) && brix >= 0 && brix <= 8) {
      values.solids = brix;
      solidsSource = '°Brix proxy จำลองที่ผู้ใช้เลือก · ไม่ใช่ Total Solids ที่วัด';
    } else {
      resultEl.textContent = 'ยังคำนวณไม่ได้ · กรอก Total Solids หรือเลือก °Brix proxy (0 ถึง 8)';
      form.elements.solids.focus(); return;
    }
    try {
      const heat = PHYSICS.outletTempUA(values.tin, values.feed, values.solids / 100, values.air, values.ua, values.room, values.feedTemp);
      if (!Number.isFinite(heat.raw) || !Number.isFinite(heat.Tout) || heat.extrapolated) {
        resultEl.textContent = 'ผลทดสอบไม่พร้อม · ผลนอกขอบเขตหรือคำนวณไม่ได้'; return;
      }
      const warning = heat.Tout < 30 || heat.Tout > 120 ? ' · นอกช่วงเซนเซอร์ 30 ถึง 120 °C' :
        heat.Tout <= 33 || heat.Tout >= 117 ? ' · ใกล้ขอบช่วงเซนเซอร์ 30 ถึง 120 °C' : '';
      resultEl.textContent = `${heat.Tout.toFixed(1)} °C · ผลคำนวณจำลอง ไม่ใช่ค่าที่วัดจริง · ${solidsSource}${warning}`;
    } catch { resultEl.textContent = 'ทดสอบไม่สำเร็จ · ไม่สามารถเรียกโมเดลได้'; }
    return;
  }
  if (form.dataset.form === 'settings') {
    const fields = new FormData(form);
    const saved = await updateWorkspace((state) => ({ ...state, preferences: { ...state.preferences,
      name: String(fields.get('displayName')).trim(), defaultMachine: String(fields.get('defaultMachine')),
      feedAlerts: fields.has('feedAlerts'), resultAlerts: fields.has('resultAlerts'),
    } }));
    if (saved) { render(true); message('บันทึกการตั้งค่าแล้ว'); }
    return;
  }
  const stage = form.dataset.form;
  const visibleRun = currentRun();
  if (!visibleRun || !['reading', 'before', 'after'].includes(stage) || !canSaveNumbers(form)) return;
  rememberForm(visibleRun, form);
  const run = pendingForms.get(formKey(visibleRun, stage)).base;
  const template = templates[run.template];
  if (stage === 'reading' && run.status === 'running') {
    const data = readFields(form, template.during);
    if (!Object.keys(data).length) {
      form.querySelector('input').focus();
      message('กรอกค่าหรือเหตุการณ์อย่างน้อยหนึ่งรายการ');
      return;
    }
    const readingDate = form.elements.readingDate.value.trim();
    const readingClock = form.elements.readingClock.value.trim();
    const editIndex = editingReading?.run === run.id ? editingReading.index : null;
    const originalTime = editIndex == null ? null : run.logs[editIndex].time;
    const originalFields = readingTimeFields(originalTime);
    const time = !readingDate && !readingClock || readingDate === originalFields.readingDate && readingClock === originalFields.readingClock
      ? new Date(originalTime ?? Date.now()) : parseReadingTime(readingDate, readingClock);
    if (!time || !Number.isFinite(time.getTime())) {
      const error = form.querySelector('#reading-time-error');
      error.textContent = 'กรอกวันที่ พ.ศ. และเวลา 24 ชั่วโมง เช่น 13/11/2569 และ 09:30';
      error.hidden = false;
      form.elements[readingDate && !readingClock ? 'readingClock' : 'readingDate'].focus();
      return;
    }
    const entry = { time: time.toISOString(), data };
    const logs = editIndex == null ? [...run.logs, entry] : run.logs.map((log, index) => index === editIndex ? entry : log);
    if (await replace(run, { ...run, logs })) {
      editingReading = null;
      pendingForms.delete(formKey(run, stage));
      render();
      main.querySelector('.entry-form input')?.focus();
      message(editIndex == null ? 'เพิ่มบันทึกแล้ว' : 'แก้ไขบันทึกแล้ว', true);
    }
    return;
  }
  if (!(stage === 'before' && run.status === 'draft') && !(stage === 'after' && run.status === 'results')) return;
  const data = readFields(form, template[stage]);
  const title = stage === 'before' ? form.elements.runTitle.value.trim() : run.title;
  if (!title) {
    form.elements.runTitle.focus();
    message('กรอกชื่อการทดลองก่อนบันทึก');
    return;
  }
  if (event.submitter?.value === 'advance') {
    const missing = template[stage].find(([key, , , required]) => required && data[key] == null);
    if (missing) {
      form.elements[missing[0]].focus();
      message(`กรอก${missing[1]}ก่อนเปลี่ยนสถานะ`);
      return;
    }
    if (stage === 'before' && run.template === 'spray') {
      data.machine = data.machine.toUpperCase();
      const machine = labWorkspace.machines.find(({ id }) => id === data.machine);
      if (!machine || machine.maintenance) {
        form.elements.machine.focus();
        message(machine?.maintenance ? 'เครื่องนี้อยู่ระหว่างรอซ่อม' : 'เลือก Machine ID จากทะเบียนเครื่อง');
        return;
      }
    }
    await advance(run, { title, [stage]: data }, stage);
  } else if (await replace(run, { ...run, title, [stage]: data })) {
    pendingForms.delete(formKey(run, stage));
    form.querySelector('.draft-note').hidden = true;
    if (currentRun()?.id === run.id) main.querySelector('h1').textContent = title;
    message(stage === 'before' ? 'บันทึกร่างแล้ว' : 'บันทึกผลแล้ว', true);
  }
});

document.addEventListener('click', async (event) => {
  const alertLink = event.target.closest('a[data-alert-key]');
  if (alertLink) void markAlerts([alertLink.dataset.alertKey], false);
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, phase, template, format } = button.dataset;
  if (action === 'jump-clock') {
    const goEntry = button.dataset.dir === 'entry';
    // กระโดดทันที (ไม่ใช้ smooth): คาดเดาได้ ไม่ค้างกลางทางเมื่อหน้าถูกวาดใหม่ และเหมาะกับผู้ที่ลดการเคลื่อนไหว
    document.querySelector(goEntry ? '#reading-entry' : '#run-clock')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    updateJumpButton();   // เลื่อนทันทีแล้ว จึงสลับป้ายปุ่มได้เลย ไม่ต้องรอเหตุการณ์ scroll
    return;
  }
  if (action === 'dismiss-howto') {
    try { localStorage.setItem(howtoKey, 'done'); } catch { /* ปิดไม่ได้ก็แสดงต่อ */ }
    button.closest('.howto')?.remove();
    return;
  }
  if (action === 'create') showCreate(template, button.dataset.machine);
  if (action === 'cancel-create') dialog.close();
  if (action === 'clear-run-filters') {
    for (const input of main.querySelectorAll('.run-filters input, .run-filters select')) input.value = '';
    filterList();
    main.querySelector('#search').focus();
  }
  if (action === 'add-machine') showMachine();
  if (action === 'edit-machine') showMachine(button.dataset.machine);
  if (action === 'delete-machine') await deleteMachine(button.dataset.machine);
  if (action === 'cancel-machine') machineDialog.close();
  if (action === 'filter-alerts') {
    alertSource = button.dataset.source;
    render();
    main.querySelector('[data-action="filter-alerts"][aria-pressed="true"]').focus();
    return;
  }
  if (action === 'read-alerts') void markAlerts(visibleAlerts(alerts()).map(({ key }) => key));
  if (action === 'reading-now') {
    const form = button.form;
    const { readingDate, readingClock } = readingTimeFields(new Date());
    form.elements.readingDate.value = readingDate;
    form.elements.readingClock.value = readingClock;
    form.elements.readingClock.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (action === 'clear-machine-filter') clearMachineFilters();
  if (action === 'executive-period') {
    executivePeriod = Number(button.dataset.days);
    render();
    main.querySelector('.period [aria-pressed="true"]').focus();
  }
  if (action === 'summary-export') exportSummary();
  if (action === 'pre-tab') {
    preTab = button.dataset.tab;
    const sheet = main.querySelector('.pre-sheet');
    if (sheet) sheet.dataset.preTab = preTab;
    main.querySelectorAll('.pre-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === preTab)));
    main.querySelector('.pre-tabs')?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (action === 'phase') {
    const nextPhase = Number(phase);
    if (nextPhase === currentPhase) return;
    const previousX = main.querySelector('.step-indicator')?.getBoundingClientRect().x;
    currentPhase = nextPhase;
    render();
    const indicator = main.querySelector('.step-indicator');
    if (indicator && previousX != null && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const offset = previousX - indicator.getBoundingClientRect().x;
      window.animateLaong?.(indicator, { x: [offset, 0] }, { duration: 0.18, ease: [0.22, 1, 0.36, 1] });
    }
    main.querySelector('.step[aria-pressed="true"]').focus({ preventScroll: true });
    return;
  }
  const run = currentRun();
  if (action === 'synthetic-model-profile') {
    const form = button.closest('form[data-form="synthetic-model"]');
    const config = window.SPRAYDRY_RUNTIME_CONFIG;
    const profile = config?.defaultMachineProfile;
    if (!form || run?.demo !== true || run.template !== 'spray' || location.hostname !== '127.0.0.1' || location.port !== '19012' ||
        config?.classification !== 'PUBLIC_SYNTHETIC' || profile?.source !== 'synthetic' ||
        !Number.isFinite(profile.airflow_m3h) || profile.airflow_m3h < 5 || profile.airflow_m3h > 80 ||
        !Number.isFinite(profile.ua_kJhK) || profile.ua_kJhK < 1 || profile.ua_kJhK > 80 ||
        !Number.isFinite(profile.room_C) || profile.room_C < 15 || profile.room_C > 40) {
      if (form) form.querySelector('[data-model-result]').textContent = 'โปรไฟล์ตัวอย่างไม่พร้อม · กรอกข้อมูลจำลองเอง';
      return;
    }
    form.elements.air.value = String(profile.airflow_m3h);
    form.elements.ua.value = String(profile.ua_kJhK);
    form.elements.room.value = String(profile.room_C);
    form.querySelector('[data-model-result]').textContent = 'เลือกโปรไฟล์ตัวอย่าง TEST แล้ว · ไม่ใช่ค่าคาลิเบรตจริง';
    return;
  }
  if (action === 'synthetic-model-transfer') {
    if (!run || run.demo !== true || run.template !== 'spray' || location.hostname !== '127.0.0.1' || location.port !== '19012') {
      message('ใช้ได้เฉพาะรันตัวอย่างในพื้นที่ทดสอบ');
      return;
    }
    const values = {};
    for (const [source, destination] of [['tin','tin'], ['feed','feed'], ['tfeed','feedTemp']]) {
      const value = run.before?.[source];
      if (typeof value === 'number' && Number.isFinite(value)) values[destination] = value;
    }
    try {
      sessionStorage.setItem('laong.syntheticModelTransfer.v1', JSON.stringify({source:'synthetic_demo',values}));
      location.assign('/integration-tout-test.html?from=demo');
    } catch {
      message('เปิดหน้าทดสอบไม่ได้ ตรวจสิทธิ์พื้นที่จัดเก็บชั่วคราว');
    }
    return;
  }
  if (run?.status === 'running' && ['edit-reading', 'delete-reading', 'cancel-reading-edit'].includes(action)) {
    const key = formKey(run, 'reading');
    const index = Number(button.dataset.index);
    const entry = run.logs[index];
    if (action === 'cancel-reading-edit') {
      editingReading = null;
      pendingForms.delete(key);
    } else if (!entry) return;
    else if (action === 'edit-reading') {
      if (pendingForms.has(key) && !confirm('แทนที่ค่าที่กำลังกรอกด้วยบันทึกที่เลือก?')) return;
      editingReading = { run: run.id, index };
      pendingForms.set(key, { base: run, values: { ...entry.data, ...readingTimeFields(entry.time) } });
    } else {
      if (pendingForms.has(key)) {
        message('บันทึกหรือยกเลิกการแก้ไขก่อนลบรายการ');
        return;
      }
      if (!await confirmDeletion(`ลบบันทึกเวลา ${timeLabel(entry.time)}?`,
        'รายการนี้จะหายจาก Timeline และรายงานที่ส่งออกครั้งถัดไป')) return;
      if (!await replace(run, { ...run, logs: run.logs.filter((_, i) => i !== index) })) return;
      if (editingReading?.run === run.id) {
        editingReading = null;
        pendingForms.delete(key);
      }
      message('ลบบันทึกจาก Timeline แล้ว');
    }
    render();
    main.querySelector('.entry-form input')?.focus();
    return;
  }
  const draft = action === 'delete-draft' ? run : action === 'delete-row-draft'
    ? experiments.find(record => record.id === button.dataset.id) : null;
  if (draft?.status === 'draft' &&
    await confirmDeletion(`ลบร่าง ${draft.id} · ${draft.title}?`, 'ชื่อและแผนที่บันทึกในร่างนี้จะหายจากรายการทดลอง')) {
    const saved = await writeRuns((latest) => {
      if (JSON.stringify(latest.find(record => record.id === draft.id)) !== JSON.stringify(draft)) {
        message('ร่างเปลี่ยนจากอีกแท็บ กรุณาเปิดข้อมูลล่าสุดก่อนลบ');
        return null;
      }
      const key = storageKey + '.lastDeletedId';
      localStorage.setItem(key, Math.max(Number(localStorage.getItem(key)) || 0, Number(draft.id.slice(2))));
      return latest.filter(record => record.id !== draft.id);
    });
    if (saved) {
      pendingForms.delete(formKey(draft, 'before'));
      if (action === 'delete-draft') location.hash = '#' + route().origin;
      else if (route().name === 'runs') filterList();
      else render(true);
      message('ลบร่างแล้ว');
    }
  }
  if (action === 'reuse-reading' && run) {
    const form = button.closest('form');
    const previous = run.logs.at(-1)?.data;
    if (previous) {
      for (const [key] of templates[run.template].during) {
        const input = form.elements[key];
        if (key !== 'notes' && input.value === '' && previous[key] != null) input.value = previous[key];
      }
      rememberForm(run, form);
      message('เติมค่าครั้งก่อนลงในช่องว่างแล้ว');
    }
  }
  if (action === 'reload-run' && run) {
    try {
      experiments = readRuns();
      for (const stage of ['before', 'reading', 'after']) pendingForms.delete(formKey(run, stage));
      conflictRunId = '';
      detailId = '';
      render(true);
    } catch { showStorageError('เปิดข้อมูลล่าสุดไม่ได้'); }
  }
  if (action === 'copy-run' && run?.status === 'closed') {
    if (await createRun(`สำเนา · ${run.title}`.slice(0, 100), run.template, { ...run.before }, Boolean(run.demo))) message('ทำสำเนาเป็นร่างแล้ว');
  }
  if (action === 'advance' && run && ['ready', 'running'].includes(run.status)) {
    // กด "จบการทดลอง" ขณะมีค่าที่พิมพ์ค้างและยังไม่เพิ่มบันทึก: ห้ามทิ้งเงียบ ๆ (จบแล้วเพิ่มไม่ได้อีก)
    const pending = run.status === 'running' ? pendingForms.get(formKey(run, 'reading')) : null;
    const keys = templates[run.template]?.during.map(([k]) => k) || [];
    const hasTyped = pending && keys.some(k => String(pending.values?.[k] ?? '').trim() !== '');
    if (hasTyped) {
      if (!confirm('มีค่าที่พิมพ์ไว้แต่ยังไม่ได้กด "เพิ่มบันทึก"\n\nตกลง = เพิ่มเป็นบันทึกสุดท้าย แล้วจบการทดลอง\nยกเลิก = กลับไปตรวจก่อน (ยังไม่จบ)')) return;
      const before = run.logs.length, form = main.querySelector('form[data-form="reading"]');
      if (!form) { message('ไม่พบฟอร์มบันทึก ลองอีกครั้ง'); return; }
      form.requestSubmit();
      for (let i = 0; i < 30 && (experiments.find(r => r.id === run.id)?.logs.length ?? before) <= before; i++) await new Promise(r => setTimeout(r, 100));
      const after = experiments.find(r => r.id === run.id);
      if (!after || after.logs.length <= before) { message('ยังไม่ได้จบการทดลอง: เพิ่มบันทึกสุดท้ายไม่สำเร็จ ตรวจค่าที่พิมพ์แล้วลองอีกครั้ง'); return; }
      advance(after);
      return;
    }
    advance(run);
  }
  if (action === 'toggle-research') {
    const next = !researchMode();
    if (setResearchMode(next)) { message(next ? 'แสดงรายละเอียดวิจัยแล้ว (ไม่ใช่ระบบสิทธิ์)' : 'ซ่อนรายละเอียดวิจัยแล้ว · ข้อมูลยังอยู่ครบ'); render(); }
    else message('บันทึกการตั้งค่าไม่ได้ (พื้นที่เบราว์เซอร์ถูกปิด)');
  }
  if (action === 'export-run' && run) { exportRuns([run]); return; }
  if (action === 'export-all-runs') { exportRuns(experiments); return; }
  if (action === 'log-event' && run && run.status === 'running') {
    const C = chartApi(), type = button.dataset.event, last = [...(Array.isArray(run.events) ? run.events : [])].reverse().find(x => x?.type === type);
    if (!C || !C.EVENT_LABEL[type]) return;
    if (last && Date.now() - Date.parse(last.time) < 5000) { message('บันทึกเหตุการณ์นี้ไปแล้ว'); return; }   // กันแตะซ้ำสองครั้ง
    const ev = C.makeEvent(type);
    const saved = await writeRuns(latest => latest.map(r => (r.id === run.id && r.status === 'running' ? { ...r, events: C.addEvent(r.events, ev) } : r)));
    if (saved) { adoptOwnWrite(run.id, ['events']); message(`บันทึก "${C.EVENT_LABEL[type]}" แล้ว`); render(); }
    else message('บันทึกเหตุการณ์ไม่ได้ ลองอีกครั้ง');
    return;
  }
  if (action === 'delete-event' && run && run.status === 'running') {
    const id = button.dataset.id;
    const saved = await writeRuns(latest => latest.map(r => (r.id === run.id && r.status === 'running' ? { ...r, events: chartApi().removeEvent(r.events, id) } : r)));
    if (saved) { adoptOwnWrite(run.id, ['events']); message('ลบเหตุการณ์แล้ว'); render(); }
    return;
  }
  if (action === 'find-target') {
    const form = button.closest('form[data-form="run-prediction"]'), out = form?.querySelector('[data-target-result]'), api = predictionApi();
    if (!form || !out || !api) return;
    if (physicsIntegrity !== 'ok') { out.innerHTML = '<p class="hint">ยังตรวจไฟล์สมการไม่เสร็จหรือไม่ผ่าน ลองใหม่อีกครั้ง</p>'; return; }
    const input = readPredictionInput(form);
    const res = api.findConditions({ materialId: input.materialId, airIn: input.airIn, solidsPct: input.solidsPct, brix: input.brix, useBrixProxy: input.useBrixProxy, tfeed: input.tfeed },
      selectedPredictionProfile(form), physicsApi(), { target: form.elements.targetTout.value });
    if (!res.ok) {
      out.innerHTML = `<p class="hint"><b>ยังหาไม่ได้:</b> ${e(res.error)}</p>`;
      const field = { targetTout: 'targetTout', materialId: 'materialId', airIn: 'airIn', solidsPct: 'solidsPct' }[res.field];
      if (field && form.elements[field]) form.elements[field].focus();
      return;
    }
    const s = res.searched;
    const items = res.results.map(x => `<li>Tin <b>${e(x.tin_C)} °C</b> · ปั๊ม <b>${e(x.pumpPct)}%</b> (= ${e(x.feed_mLmin)} mL/min) → ทำนาย <b>${e(x.tout_C)} °C</b> <span class="hint">(${x.diff_C > 0 ? '+' : ''}${e(x.diff_C)})</span> <button type="button" class="button" data-action="use-target" data-tin="${e(x.tin_C)}" data-pct="${e(x.pumpPct)}">ใช้ค่านี้</button></li>`).join('');
    out.innerHTML = (res.results.length
      ? `<p class="hint">สภาวะที่โมเดลคำนวณได้ใกล้ ${e(res.target)} °C (ไม่เกิน ±${e(res.tolerance)} °C):</p><ol class="target-list">${items}</ol>`
      : `<p class="hint">ไม่พบสภาวะที่ให้ Tout ใกล้ ${e(res.target)} °C ในขอบเขต Tin ${e(s.tinMin)} ถึง ${e(s.tinMax)} °C และปั๊มไม่เกิน ${e(s.pumpMaxPct)}% · ลองเป้าอื่น</p>`)
      + '<p class="hint pred-note"><b>ผลจากโมเดลเท่านั้น ไม่ใช่คำแนะนำให้ใช้สภาวะนี้</b> ไม่ตรวจคุณภาพผงหรือการติดผนัง · เทียบกับ "รันที่เคยทำใกล้เคียง" ด้านบน และทำตาม SOP/ผู้ดูแลเครื่อง · กด "ใช้ค่านี้" แล้วกด "คำนวณ" เพื่อดูคำเตือนครบ (ไม่เปลี่ยนแผนทดลอง)</p>';
    return;
  }
  if (action === 'use-target') {
    const form = button.closest('form[data-form="run-prediction"]');
    if (!form) return;
    const set = (name, value) => { form.elements[name].value = value; form.elements[name].dispatchEvent(new Event('input', { bubbles: true })); };
    const pumpMode = [...form.querySelectorAll('input[name=feedMode]')].find(r => r.value === 'pump_pct');
    if (pumpMode && !pumpMode.checked) { pumpMode.checked = true; pumpMode.dispatchEvent(new Event('change', { bubbles: true })); }
    set('tin', button.dataset.tin); set('pumpPct', button.dataset.pct);
    button.closest('dialog')?.close();
    form.querySelector('button[type=submit]')?.focus();
    message('ใส่ค่าในฟอร์มทำนายแล้ว กด "คำนวณ" เพื่อดูผลและคำเตือน');
    return;
  }
  if (action === 'clock' && run) {
    const act = button.dataset.clock;
    const C = clockApi();
    if (act === 'stop_run' && !confirm('จบรันบนนาฬิกา?\nย้อนกลับไม่ได้ และยังไม่มีปุ่มล้างนาฬิกาในหน้านี้')) return;
    let error = null;
    // เปลี่ยนสถานะจากข้อมูลล่าสุดในที่เก็บ (ไม่ใช้สำเนาเก่าในหน้า) แล้วบันทึกในครั้งเดียว
    const saved = await writeRuns(latest => {
      const current = latest.find(r => r.id === run.id);
      const out = C ? C.apply(current, act, captureApi(), Date.now()) : { ok: false, error: 'นาฬิกายังไม่พร้อม' };
      if (!out.ok) { error = out.error; return false; }
      return latest.map(r => (r.id === run.id ? { ...r, feedClock: out.clock } : r));
    });
    if (saved) { adoptOwnWrite(run.id, ['feedClock']); message(`${C.ACTION_LABELS[act]} แล้ว`); render(); }
    else message(error || 'บันทึกนาฬิกาไม่ได้ ลองอีกครั้ง');
  }
  if (action === 'import-profile') button.parentElement.querySelector('[data-profile-file]')?.click();
  if (action === 'remove-profile') {
    const key = button.dataset.profile;
    const p = importedProfiles().find(x => x.key === key);
    if (p && confirm(`ลบโปรไฟล์ "${p.label}" ออกจากเบราว์เซอร์นี้?\nคำทำนายที่บันทึกในรันแล้วจะยังอยู่ และไฟล์ทีมไม่ถูกแตะ`)) {
      const saved = await updateMachineProfiles(rows => {
        const current = rows.find(x => x.key === key);
        if (!current || JSON.stringify(current) !== JSON.stringify(p)) return {ok:false,error:'โปรไฟล์เปลี่ยนจากอีกแท็บ กรุณาตรวจใหม่ก่อนลบ'};
        return {ok:true,rows:rows.filter(x => x.key !== key)};
      });
      if (saved.ok) { message('ลบโปรไฟล์แล้ว'); render(); } else message(saved.error);
    }
  }
  if (action === 'save-prediction' && run && predictionPreview?.runId === run.id && run.status !== 'closed') {
    const snapshot = predictionPreview.snapshot;
    const saved = await writeRuns(latest => latest.map(r => r.id === run.id && r.status !== 'closed'
      ? { ...r, predictions: [...(Array.isArray(r.predictions) ? r.predictions : []), snapshot] } : r));
    if (saved) {
      // บันทึกคำทำนายเปลี่ยนตัวรันเอง — ย้ายฐานของฟอร์มที่พิมพ์ค้างไปที่รันล่าสุด ไม่งั้นการกดยืนยันแผนครั้งถัดไปจะขึ้น "เปลี่ยนจากอีกแท็บ" ทั้งที่ไม่มีแท็บอื่น
      adoptOwnWrite(run.id, ['predictions']);
      predictionPreview = null; message(`บันทึกคำทำนาย ${snapshot.result.tout_C.toFixed(1)} °C ลงรันแล้ว`); render();
    }
    else message('บันทึกคำทำนายไม่ได้ ลองอีกครั้ง');
  }
  if (action === 'report' && run?.status === 'closed') {
    try {
      window.LaongReports.exportRun(format, run, templates[run.template], statuses[run.status], timeLabel, fieldSource);
    } catch {
      message('ส่งออกรายงานไม่ได้ ลองอีกครั้ง');
    }
  }
});

main.addEventListener('input', (event) => {
  if (event.target.id === 'search') filterList();
  if (event.target.id === 'machine-search') updateMachineFilters();
  // แผนก่อนทดลอง → ฟอร์มทำนาย: เติมค่าให้เองจนกว่าผู้ใช้จะแก้ช่องทำนายเอง
  const planForm = event.target.closest('form[data-form="before"]');
  const predForm = main.querySelector('form[data-form="run-prediction"]');
  if (planForm && predForm) {
    const target = { tin: 'tin', solids: 'solidsPct', brix: 'brix', tfeed: 'tfeed' }[event.target.name];
    const field = target && predForm.elements[target];
    if (field && field.dataset.touched !== '1' && field.value !== event.target.value) {
      field.value = event.target.value;
      const hadResult = predictionPreview?.runId != null;
      predictionPreview = null;
      predForm.querySelector('[data-action="save-prediction"]').disabled = true;
      if (hadResult) predForm.querySelector('[data-prediction-result]').textContent = 'ค่าเปลี่ยนแล้ว · กด "คำนวณ" ใหม่';
    }
  }
  if (event.target.closest('form[data-form="run-prediction"]')) { event.target.dataset.touched = '1'; updateFeedConverted(event.target.closest('form')); }
  if (planForm && event.target.name === 'feed' && predForm) {
    const hint = predForm.querySelector('[data-plan-feed-hint]'), v = event.target.value.trim();
    if (hint) hint.textContent = v ? `แผนระบุอัตราป้อนตั้งต้น ${v} mL/min · ถ้าเป็นค่าที่ตั้งจากปั๊ม ให้กรอกเป็น % ตามหน้าเครื่อง` : '';
  }
  if (event.target.closest('form[data-form="run-prediction"], form[data-form="before"]')) refreshSimilar();
  // ค่า Tout ที่จดนอกช่วงที่เซนเซอร์เครื่องแสดง (30–120 °C): เตือนใต้ช่อง ไม่บล็อก (ผู้ใช้อาจพิมพ์ผิดหรืออ่านผิดหน่วย)
  if (event.target.name === 'tout' && event.target.closest('form[data-form="reading"]')) {
    const field = event.target, v = Number(field.value);
    let note = field.parentElement.querySelector('[data-sensor-note]');
    const out = field.value.trim() !== '' && Number.isFinite(v) && (v < 30 || v > 120);
    if (out && !note) { note = document.createElement('small'); note.className = 'hint field-warn'; note.dataset.sensorNote = ''; field.insertAdjacentElement('afterend', note); }
    if (note) { note.textContent = out ? 'ค่านี้อยู่นอกช่วงที่เซนเซอร์เครื่องแสดง (30 ถึง 120 °C) · ตรวจค่าอีกครั้งก่อนบันทึก' : ''; note.hidden = !out; }
  }
  // ระหว่างทดลอง: ส่วนต่างระหว่างค่าที่จดกับค่าคาดการณ์ (แสดงอย่างเดียว ไม่บันทึก)
  if (event.target.name === 'tout' && event.target.closest('form[data-form="reading"]')) {
    const chip = main.querySelector('.pred-chip');
    const diffEl = chip?.querySelector('[data-pred-diff]');
    if (chip && diffEl) {
      const v = Number(event.target.value), pred = Number(chip.dataset.pred);
      diffEl.textContent = event.target.value.trim() !== '' && Number.isFinite(v) ? `· ที่จดต่างจากคาด ${v - pred > 0 ? '+' : v - pred < 0 ? '−' : '±'}${Math.abs(v - pred).toFixed(1)} °C` : '';
    }
  }
  const form = event.target.closest('form');
  if (form?.dataset.form === 'run-prediction') {
    // ผลเก่าไม่ตรงกับค่าที่กรอกแล้ว — ห้ามบันทึกจนกว่าจะคำนวณใหม่
    const hadResult = predictionPreview?.runId != null;
    predictionPreview = null;
    form.querySelector('[data-action="save-prediction"]').disabled = true;
    if (hadResult) form.querySelector('[data-prediction-result]').innerHTML = '<p class="hint">ค่าเปลี่ยนแล้ว · กด "คำนวณ" ใหม่</p>';
    return;
  }
  if (form?.dataset.form === 'synthetic-model') {
    form.querySelector('[data-model-result]').textContent = 'ข้อมูลเปลี่ยนแล้ว · กรุณาคำนวณใหม่';
    return;
  }
  if (['readingDate', 'readingClock'].includes(event.target.name)) form.querySelector('#reading-time-error').hidden = true;
  const run = currentRun();
  if (run && ['before', 'after', 'reading'].includes(form?.dataset.form)) rememberForm(run, form);
});
main.addEventListener('change', async (event) => {
  const predictionFormChanged = event.target.closest?.('form[data-form="run-prediction"]');
  if (predictionFormChanged) {
    if (event.target.name === 'feedMode' || event.target.name === 'profile') updateFeedConverted(predictionFormChanged);
    if (event.target.name === 'profile') { const now = predictionFormChanged.querySelector('[data-profile-now]'); if (now) now.textContent = event.target.selectedOptions[0]?.textContent || ''; }
    const hadResult = predictionPreview?.runId != null;
    predictionPreview = null;
    predictionFormChanged.querySelector('[data-action="save-prediction"]').disabled = true;
    if (hadResult) predictionFormChanged.querySelector('[data-prediction-result]').textContent = 'ค่าเปลี่ยนแล้ว · กด "คำนวณ" ใหม่';
    return;
  }
  if (event.target.matches?.('[data-profile-file]')) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 20000) { message('ไฟล์ใหญ่เกินกว่าจะเป็นโปรไฟล์เครื่อง'); return; }
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch { message('อ่านไฟล์ไม่ได้ (ไม่ใช่ JSON)'); return; }
    const checked = predictionApi().validateProfile(parsed);
    if (!checked.ok) { message(`นำเข้าไม่ได้: ${checked.error}`); return; }
    const p = checked.profile;
    if (machineProfiles().some(x => x.key === p.key)) { message('มีโปรไฟล์รหัสนี้ในเครื่องแล้ว · ลบอันเดิมก่อนถ้าต้องการแทนที่'); return; }
    if (!confirm(`นำเข้าโปรไฟล์ "${p.label}"\n${profileClassLabel(p)} · Air-in ${p.airInPct}%\n\n${p.provenance.summary}\n\nเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น`)) return;
    const saved = await updateMachineProfiles(rows => {
      if (rows.some(x => x.key === p.key)) return {ok:false,error:'มีโปรไฟล์รหัสนี้ในเครื่องแล้ว · ไม่มีการเขียนทับ'};
      return {ok:true,rows:[...rows,p]};
    });
    if (saved.ok) { message(`นำเข้าโปรไฟล์ ${p.label} แล้ว`); render(); } else message(saved.error);
    return;
  }
  if (['type-filter', 'status-filter'].includes(event.target.id)) filterList();
  if (event.target.id === 'machine-status') updateMachineFilters();
});
document.querySelector('.skip').addEventListener('click', (event) => { event.preventDefault(); main.focus(); });
window.addEventListener('hashchange', () => {
  const location = route();
  if (location.name !== 'run' && !readFailed && !writingRun) experiments = load();
  if (location.name === 'calendar') setCalendarRouteDate(location.date);
  window.scrollTo(0, 0);
  render(true);
});
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey || route().name === 'run' || dialog.open) return;
  experiments = load();
  const { name } = route();
  if (name === 'machines') refreshMachineResults();
  if (name === 'today' || name === 'notifications') render();
  if (name === 'runs' || name === 'history') filterList();
});
if (route().name === 'calendar') setCalendarRouteDate(route().date);
render();

/* เมนูจัดการรัน: ปิดเมื่อเลือกรายการ คลิกนอกเมนู หรือกด Esc */
document.addEventListener('click', (event) => {
  for (const menu of document.querySelectorAll('details.run-menu[open]')) {
    if (!menu.contains(event.target) || event.target.closest('.menu-item')) menu.open = false;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  for (const menu of document.querySelectorAll('details.run-menu[open]')) { menu.open = false; menu.querySelector('summary')?.focus(); }
});

/* หน้าต่างในแท็บทำนาย: เปิดด้วย data-open-dialog ปิดด้วย data-close-dialog หรือ Esc (ของเบราว์เซอร์) */
document.addEventListener('click', (event) => {
  const open = event.target.closest?.('[data-open-dialog]');
  if (open) { document.getElementById(open.dataset.openDialog)?.showModal(); return; }
  const close = event.target.closest?.('[data-close-dialog]');
  if (close) close.closest('dialog')?.close();
});
