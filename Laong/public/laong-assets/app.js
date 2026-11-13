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
      ['tin', 'อุณหภูมิขาเข้า (°C)', 'number'],
      ['volume', 'ปริมาตรตั้งต้น (mL)', 'number', false, 0],
      ['feed', 'อัตราป้อนตั้งต้น (mL/min)', 'number', false, 0],
      ['solids', 'ของแข็งในสารป้อน (%)', 'number', false, 0, 100],
      ['batch', 'Batch', 'text'],
      ['formula', 'สูตรและวัสดุ', 'text'],
      ['profile', 'Machine Profile', 'text'],
      ['tfeed', 'อุณหภูมิสารป้อน (°C)', 'number'],
      ['air', 'เงื่อนไขอากาศ', 'text'],
      ['solidsMethod', 'วิธีวัด Total Solids', 'text'],
      ['brix', '°Brix', 'number', false, 0, 100],
      ['notes', 'เงื่อนไขอื่น ๆ', 'textarea'],
    ],
    during: [
      ['tin', 'อุณหภูมิขาเข้าที่จด (°C)', 'number'],
      ['tout', 'อุณหภูมิขาออกที่จด (°C)', 'number'],
      ['feed', 'อัตราป้อนที่จด (mL/min)', 'number', false, 0],
      ['volume', 'ปริมาตรที่ป้อนสะสม (mL)', 'number', false, 0],
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
      createdAt: '2026-11-12T02:15:00Z', status: 'running', demo: true,
      before: { goal: 'บันทึกค่าระหว่างการทดลองสำหรับทดสอบหน้าจอ', machine: 'SD-01', sample: 'ตัวอย่าง A', tin: 160, volume: 300, feed: 4 },
      logs: [
        { time: '2026-11-12T02:30:00Z', data: { tout: 84.2, feed: 4, volume: 60, notes: 'บันทึกตัวอย่างช่วงแรก' } },
        { time: '2026-11-12T02:55:00Z', data: { tout: 84.9, feed: 4, volume: 160, notes: 'บันทึกตัวอย่างช่วงถัดมา' } },
      ], after: {},
    },
    {
      id: 'R-017', title: 'เปรียบเทียบเนื้อสัมผัสของตัวอย่าง', template: 'general', templateVersion: 1,
      createdAt: '2026-11-11T03:10:00Z', status: 'closed', demo: true,
      before: { goal: 'เปรียบเทียบตัวอย่างในเงื่อนไขเดียวกัน', sample: 'ตัวอย่าง B', method: 'บันทึกผลตามแบบประเมินของทีม' },
      logs: [{ time: '2026-11-11T03:20:00Z', data: { notes: 'ตรวจตัวอย่างรอบแรก' } }],
      after: { result: 'บันทึกผลตัวอย่างครบ', conclusion: 'ทดลองซ้ำเพื่อยืนยันผล' },
    },
  ];
}

function readRuns() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return demoExperiments();
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.some((run) => !run || !Object.hasOwn(templates, run.template) || !Object.hasOwn(statuses, run.status) || !Array.isArray(run.logs))) throw new Error('Invalid records');
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
    showStorageError('บันทึกไม่ได้ ตรวจพื้นที่จัดเก็บหรือสิทธิ์ของเบราว์เซอร์ แล้วลองอีกครั้ง');
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
        record.before.machine === original.before.machine && Boolean(record.demo) === Boolean(original.demo))) {
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
  return `<img class="icon" src="/laong-assets/icons/${name}.svg" alt="" width="18" height="18">`;
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
  notifications: 'แจ้งเตือน', templates: 'แบบฟอร์มทดลอง', calendar: 'ปฏิทินแล็บ' };

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
    `<tr><td class="mono run-id">${e(run.id)}</td><td><small class="mono run-id-compact">${e(run.id)}</small><a class="record-link" href="${runLink(run)}">${e(run.title)}</a>${run.demo ? ' <small class="muted">· ตัวอย่าง</small>' : ''}</td><td class="run-secondary">${templates[run.template].name}</td><td>${status(run)}</td><td class="run-secondary">${dayLabel(run.createdAt)}</td><td class="run-action"><div class="row-tools"><a class="button ${run.status === 'draft' ? 'action-draft' : ''}" href="${runLink(run)}" aria-label="${actions[run.status]} ${e(run.id)}">${actions[run.status]} ${icon('next')}</a>${run.status === 'draft' ? `<button class="button icon-tool" data-action="delete-row-draft" data-id="${e(run.id)}" aria-label="ลบร่าง ${e(run.id)}" title="ลบร่าง"></button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
}

function drops(run) {
  const volume = run.before.volume;
  const latest = [...run.logs].reverse().find((log) => log.data.volume != null)?.data.volume;
  if (!(volume > 0) || latest == null) return '';
  const filled = Math.round(12 * Math.max(0, Math.min(1, latest / volume)));
  return `<div>${dropletStrip(filled, 12)}<p class="hint">ป้อนแล้ว <span class="mono">${e(latest)} / ${e(volume)}</span> mL ${sourceTag(run.demo ? 'Assumed' : 'Observed')}${run.demo ? ' · ข้อมูลตัวอย่าง' : ''}</p></div>`;
}

function today() {
  const current = experiments.find((run) => run.status === 'running');
  const draft = experiments.find((run) => run.status === 'draft');
  const active = experiments.filter((run) => run.status !== 'closed');
  const waiting = experiments.filter((run) => run.status === 'results');
  const closed = experiments.filter((run) => run.status === 'closed');
  return pageHead('วันนี้', `${dayLabel(new Date())} · ติดตามการทดลองและแผนเข้าแล็บ`, newButton()) +
    `<div class="dashboard">
      <section class="panel panel-pad feature">
        <div class="feature-layout"><div class="feature-content">
        <div class="feature-meta">${current ? status(current) + `<span class="mono muted">${e(current.id)}</span>` : '<span class="muted">รันที่กำลังดำเนินการ</span>'}</div>
        <div><h2>${current ? e(current.title) : 'ยังไม่มีการทดลองที่กำลังเดิน'}</h2>
        <p class="muted">${current ? templates[current.template].name + (current.before.machine ? ' · ' + e(current.before.machine) : '') : 'สร้างรันเพื่อบันทึกแผนก่อนเริ่มทดลอง'}${current?.demo ? ' · ข้อมูลตัวอย่าง' : ''}</p></div>
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
    <section class="panel panel-pad preview-links"><div><h2>เครื่องของทีม</h2><p class="hint">${labWorkspace.machines.length} เครื่องในทะเบียน</p></div><a class="button" href="#machines">ดูทะเบียนเครื่อง</a></section>`;
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
    if (!experiments.length && !readFailed) return '<div class="empty empty-with-mascot"><img src="/laong-assets/icons/mascot-idle.svg" alt=""><h2>ยังไม่มีรัน</h2><p>สร้างรันแรกเพื่อบันทึกเงื่อนไขและผลการทดลอง</p></div>';
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
    return `<label for="${prefix}${key}">${label}${required ? ' *' : ''}${control}</label>`;
  }).join('');
}

function sourceTag(source) {
  return `<span class="source">${source}</span>`;
}

function fieldSource(run, stage, type, value) {
  if (value == null) return 'Missing';
  if (run.demo) return 'ข้อมูลจำลอง';
  return stage === 'before' ? 'ตามแผน' : 'ผู้ใช้บันทึก';
}

function recordedFields(specification, values, stage, run) {
  return `<dl class="recorded-fields">${specification.map(([key, label, type]) => {
    const value = values[key];
    const source = fieldSource(run, stage, type, value);
    return `<div><dt>${label}</dt><dd>${value == null ? 'ยังไม่มีค่า' : e(value)} ${sourceTag(source)}</dd></div>`;
  }).join('')}</dl>`;
}

function phaseHint(run, phase) {
  if (phase === 0) return run.status === 'draft' ? 'กรอกเงื่อนไข แล้วกดยืนยันเมื่อพร้อม' : 'แผนถูกล็อกหลังยืนยัน';
  if (phase === 1) return run.status === 'running' ? 'เพิ่มค่าที่อ่านจริงหรือเหตุการณ์ได้ตลอดการทดลอง' : 'เพิ่มรายการได้เมื่อรันอยู่ในสถานะกำลังรัน';
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
      <div class="actions"><a class="button" href="#monitor">ติดตามเครื่อง</a><button class="button" type="button" data-action="reuse-reading" ${run.logs.length ? '' : 'disabled'}>ดึงค่าครั้งก่อน</button></div>
      <div class="field-grid">${fields(template.during, values, false, 'reading-')}
      <fieldset class="reading-timestamp">
        <legend>เวลาที่จด <span class="hint">เวลาไทย</span></legend>
        <div class="reading-timestamp-fields">
          <label>วันที่ (พ.ศ.)<input type="text" name="readingDate" inputmode="numeric" maxlength="10" placeholder="วว/ดด/ปปปป" value="${e(values.readingDate)}" aria-describedby="reading-time-hint"></label>
          <label>เวลา<input type="text" name="readingClock" inputmode="numeric" maxlength="5" placeholder="ชม:นาที" value="${e(values.readingClock)}" aria-describedby="reading-time-hint"></label>
        </div>
        <div class="reading-timestamp-help"><p class="hint" id="reading-time-hint">${editIndex == null ? 'เว้นว่างทั้งคู่เพื่อใช้เวลาที่กดบันทึก' : 'ล้างทั้งคู่เพื่อใช้เวลาเดิม'}</p><button class="button subtle" type="button" data-action="reading-now">ใช้เวลาตอนนี้</button></div>
        <p class="hint field-error" id="reading-time-error" role="alert" hidden></p>
      </fieldset></div>
      <div class="actions"><button class="button primary">${editIndex == null ? 'เพิ่มบันทึก' : 'บันทึกการแก้ไข'}</button>
      ${editIndex == null ? '' : '<button type="button" class="button" data-action="cancel-reading-edit">ยกเลิกแก้ไข</button>'}${draftNote(run, 'reading')}</div></form>` : '';
    return content + `<div class="entry-list"><h3>บันทึกระหว่างทดลอง <small class="muted">(${run.logs.length})</small></h3>
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
    ${expanded ? `<details class="lab-extra"><summary>สูตร โปรไฟล์เครื่อง และรายละเอียดเพิ่มเติม</summary><div class="field-grid">${fields(template[stage].slice(7), values, locked)}</div></details>` : ''}
    ${before && run.template === 'spray' ? `<datalist id="machine-register">${labWorkspace.machines.filter((machine) => !machine.maintenance).map((machine) =>
      `<option value="${e(machine.id)}">${e(machine.name)}</option>`).join('')}</datalist>` : ''}
    <div class="actions run-form-actions"><button class="button" name="intent" value="save" formnovalidate>${before ? 'บันทึกร่าง' : 'บันทึกผลไว้ก่อน'}</button><button class="button primary" name="intent" value="advance">${step[1]} ${icon('next')}</button>${draftNote(run, stage)}</div></form>`;
}

function formKey(run, stage) { return `${run.id}:${stage}`; }
function pendingValues(run, stage, saved) { return pendingForms.get(formKey(run, stage))?.values ?? saved; }
function draftNote(run, stage) {
  return `<span class="hint draft-note" ${pendingForms.has(formKey(run, stage)) ? '' : 'hidden'}>มีข้อมูลที่ยังไม่ได้บันทึก</span>`;
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
  return `<a href="#${origin}" class="back">${icon('back')} ${runOrigins[origin]}</a>` +
    pageHead(e(run.title), `${e(run.id)} · ${template.name} · ${dayLabel(run.createdAt)}${run.demo ? ' · ข้อมูลตัวอย่าง' : ''}`,
      run.status === 'closed' ? `<button class="button" data-action="copy-run">${icon('copy')} ทำสำเนาเป็นร่าง</button>` :
      run.status === 'draft' ? '<button class="button subtle" data-action="delete-draft">ลบร่าง</button>' : '') +
    `<section id="run-conflict" class="conflict notice" ${conflictRunId === run.id ? '' : 'hidden'}><p role="alert">รันนี้เปลี่ยนจากอีกแท็บ ข้อความที่กรอกในแท็บนี้ยังอยู่</p><button class="button" data-action="reload-run">โหลดล่าสุดและทิ้งข้อความที่ยังไม่บันทึก</button></section><div class="detail-grid"><section class="panel run-sheet">
      <nav class="steps" aria-label="ช่วงการทดลอง"><span class="step-indicator" aria-hidden="true" style="--phase: ${currentPhase}"></span>${phases.map((label, i) => `<button type="button" class="step" data-action="phase" data-phase="${i}" aria-pressed="${i === currentPhase}"><span class="step-number" aria-hidden="true">${i + 1}</span> <span>${label}</span></button>`).join('')}</nav>
      <div class="panel-pad"><div class="form-body"><div class="phase-heading"><div><h2>${phases[currentPhase]}</h2><p class="muted">${phaseHint(run, currentPhase)}</p></div>${phaseAction ? `<button type="button" class="button ${run.status === 'ready' ? 'primary' : ''}" data-action="advance">${next[1]}</button>` : ''}</div>${phaseContent(run, template)}</div></div>
    </section><aside class="detail-aside" aria-label="สถานะและรายงาน">
      <section class="panel panel-pad aside-body"><h2>สถานะรัน</h2><div>${status(run)}</div>
      ${nextTask[run.status] ? `<p class="hint">${nextTask[run.status]}</p>` : ''}
      ${nextPhase != null && nextPhase !== currentPhase ? `<button class="button" data-action="phase" data-phase="${nextPhase}">ไปช่วง${phases[nextPhase]} ${icon('next')}</button>` : ''}
      ${run.template === 'spray' ? etaMarkup(run) + drops(run) : ''}
      ${run.status === 'closed' ? '<p class="hint">ข้อมูลที่ปิดรันแล้วแก้ไขไม่ได้</p>' : ''}
      </section>
      ${run.template === 'spray' ? predictionPanel(run) : ''}
      <section class="panel panel-pad aside-body"><h2>ส่งออกรายงาน</h2><p class="hint">${run.status === 'closed' ? 'ใช้ข้อมูลที่บันทึกในรันนี้' : 'เปิดใช้เมื่อปิดรันแล้ว'}</p><div class="actions">${['PDF', 'Word', 'Excel'].map((format) => `<button class="button" data-action="report" data-format="${format}" ${run.status === 'closed' ? '' : 'disabled'}>${format}</button>`).join('')}</div></section>
    </aside></div>`;
}

function predictionPanel(run) {
  const reading = [...run.logs].reverse().find(log => log.data.tout != null);
  return `<section class="panel panel-pad aside-body prediction"><h2>อุณหภูมิขาออก (Tout)</h2>
    <dl class="recorded-fields">
      <div><dt>Tout ทำนาย</dt><dd><strong>รอไฟล์โมเดล</strong></dd></div>
      <div><dt>Machine Profile</dt><dd>${e(run.before.profile || 'ยังไม่ระบุ')}</dd></div>
      <div><dt>Tout ที่จดล่าสุด</dt><dd>${reading ? `${e(reading.data.tout)} °C ${sourceTag(fieldSource(run, 'during', 'number', reading.data.tout))}` : 'ยังไม่มีข้อมูล'}</dd></div>
    </dl>${reading ? `<p class="hint">บันทึกเมื่อ ${timeLabel(reading.time)}</p>` : ''}</section>`;
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
  const pages = admin ? adminPages : executive ? executivePages : operatorPages;
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
    monitor: () => pageHead('ติดตามเครื่อง', 'ทดลองดูสถานะเครื่องและภาพกล้อง') + '<div id="monitor-root" aria-live="polite">กำลังเปิดหน้าจำลอง</div>',
  };
  main.innerHTML = selected ? detail(selected) : name === 'run' ? pageHead('ไม่พบรัน', 'เปิดรันจากรายการการทดลองอีกครั้ง', '<a class="button" href="#runs">กลับไปรายการ</a>') :
    name === 'admin-monitor' ? pageHead('การเชื่อมต่อเครื่อง', 'ตั้งค่าการแสดงผลในโหมดจำลอง') + '<div id="monitor-root" aria-live="polite">กำลังเปิดหน้าจำลอง</div>' :
    admin ? '<div id="admin-preview" class="admin-preview" aria-busy="true"><p role="status">กำลังเปิดพื้นที่ Admin</p></div>' : executive ? executivePage(name === 'executive-reports') : views[name]();
  const adminRoot = main.querySelector('#admin-preview');
  if (adminRoot) mountAdminPreview(adminRoot, name);
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
    mascot.src = '/laong-assets/icons/mascot-done.svg';
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
  let run;
  const saved = await writeRuns((latest) => {
    const sequence = latest.reduce((max, record) => Math.max(max, Number(record.id.slice(2)) || 0),
      Number(localStorage.getItem(storageKey + '.lastDeletedId')) || 0) + 1;
    run = { id: `R-${String(sequence).padStart(3, '0')}`, title, template, templateVersion: 1,
      status: 'draft', createdAt: new Date().toISOString(), before, logs: [], after: {}, demo };
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
  if (action === 'advance' && run && ['ready', 'running'].includes(run.status)) advance(run);
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
  const form = event.target.closest('form');
  if (['readingDate', 'readingClock'].includes(event.target.name)) form.querySelector('#reading-time-error').hidden = true;
  const run = currentRun();
  if (run && ['before', 'after', 'reading'].includes(form?.dataset.form)) rememberForm(run, form);
});
main.addEventListener('change', (event) => {
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
