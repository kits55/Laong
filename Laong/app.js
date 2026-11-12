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
      ['notes', 'เงื่อนไขอื่น ๆ', 'textarea'],
    ],
    during: [
      ['tout', 'อุณหภูมิขาออกจริง (°C)', 'number'],
      ['feed', 'อัตราป้อนจริง (mL/min)', 'number', false, 0],
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
let mascotPaused = false;
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
  return `<img class="icon" src="icons/${name}.svg" alt="" width="18" height="18">`;
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

function pageHead(title, description, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1><p class="muted">${description}</p></div>${actions}</div>`;
}

const runOrigins = { today: 'วันนี้', machines: 'ทะเบียนเครื่อง', history: 'ประวัติการทดลอง', runs: 'รายการทดลอง',
  notifications: 'แจ้งเตือน', templates: 'แบบฟอร์มทดลอง', calendar: 'ปฏิทินแล็บ' };

function route() {
  const [path, query] = location.hash.slice(1).split('?', 2);
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
  return `<div class="table-wrap"><table class="run-table"><thead><tr><th scope="col">รัน</th><th scope="col">ชื่อการทดลอง</th><th scope="col" class="run-secondary">แบบฟอร์ม</th><th scope="col">สถานะ</th><th scope="col" class="run-secondary">สร้างเมื่อ</th><th scope="col" class="run-action">การดำเนินการ</th></tr></thead><tbody>${records.map((run) =>
    `<tr><td class="mono">${e(run.id)}</td><td><a class="record-link" href="${runLink(run)}">${e(run.title)}</a>${run.demo ? ' <small class="muted">· ตัวอย่าง</small>' : ''}</td><td class="run-secondary">${templates[run.template].name}</td><td>${status(run)}</td><td class="run-secondary">${dayLabel(run.createdAt)}</td><td class="run-action"><a class="button ${run.status === 'draft' ? 'action-draft' : ''}" href="${runLink(run)}" aria-label="${actions[run.status]} ${e(run.id)}">${actions[run.status]} ${icon('next')}</a></td></tr>`).join('')}</tbody></table></div>`;
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
        <div class="actions">${current ? `<a class="button primary" href="${runLink(current)}">เปิดรัน ${icon('next')}</a>` : '<a class="button" href="#templates">เลือกแบบฟอร์ม</a>'}</div>
        </div><figure class="mascot-corner">
          <img class="mascot-ambient" src="icons/mascot-${current ? 'running' : 'idle'}.svg" width="210" height="228" alt="">
          <figcaption>น้องละออง</figcaption>
          <button class="mascot-control" type="button" data-action="pause-mascot" aria-pressed="${mascotPaused}">หยุดการขยับ</button>
        </figure></div>
      </section>
      <section class="panel panel-pad summary"><h2>ภาพรวมการทดลอง</h2>
        <div class="metrics"><div><strong class="mono">${active.length}</strong><small>ยังไม่ปิด</small></div><div><strong class="mono">${waiting.length}</strong><small>รอผลแล็บ</small></div><div><strong class="mono">${closed.length}</strong><small>ปิดแล้ว</small></div></div>
        <hr>${todayAgenda()}
      </section>
    </div>
    <section class="panel"><div class="panel-head"><div><h2>การทดลองล่าสุด</h2><p class="muted">กลับไปจดค่าหรือเปิดผลที่บันทึกไว้</p></div><a class="button" href="#runs">ดูรายการทั้งหมด</a></div>${table(experiments.slice(0, 5))}</section>
    <section class="panel panel-pad preview-links"><div><h2>เครื่องของทีม</h2><p class="hint">${labWorkspace.machines.length} เครื่องในทะเบียน</p></div><a class="button" href="#machines">ดูทะเบียนเครื่อง</a></section>`;
}

function listPage(history) {
  const title = history ? 'ประวัติการทดลอง' : 'การทดลอง';
  return pageHead(title, history ? 'เปิดรันที่ปิดแล้วเพื่อดูผลและออกรายงาน' : 'ค้นหาและติดตามรันที่บันทึกไว้', history ? '' : newButton()) +
    `<section class="panel"><div class="filters run-filters">
      <label>ค้นหาการทดลอง<input type="search" id="search" placeholder="ชื่อการทดลองหรือรหัสรัน"></label>
      <label>แบบฟอร์ม<select id="type-filter"><option value="">ทุกแบบฟอร์ม</option>${Object.entries(templates).map(([key, t]) => `<option value="${key}">${t.name}</option>`).join('')}</select></label>
      ${history ? '' : `<label>สถานะ<select id="status-filter"><option value="">ทุกสถานะ</option>${Object.entries(statuses).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></label>`}
      <button type="button" class="button subtle" data-action="clear-run-filters" disabled>ล้างตัวกรอง</button>
    </div><div id="list-results">${!history && !experiments.length && !readFailed
      ? '<div class="empty empty-with-mascot"><img src="icons/mascot-idle.svg" alt=""><h2>ยังไม่มีรัน</h2><p>สร้างรันแรกเพื่อบันทึกเงื่อนไขและผลการทดลอง</p></div>'
      : runResults(experiments.filter((run) => !history || run.status === 'closed'))}</div></section>`;
}

function runResults(records) {
  return `<p class="machine-count hint" role="status">แสดง ${records.length} การทดลอง</p>${table(records)}`;
}

function filterList() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const type = document.querySelector('#type-filter').value;
  const stage = document.querySelector('#status-filter')?.value || (route().name === 'history' ? 'closed' : '');
  const results = experiments.filter((run) => (!query || `${run.title} ${run.id}`.toLowerCase().includes(query)) &&
    (!type || run.template === type) && (!stage || run.status === stage));
  document.querySelector('[data-action="clear-run-filters"]').disabled = !(query || type || (route().name !== 'history' && stage));
  document.querySelector('#list-results').innerHTML = runResults(results);
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
  if (run.demo || stage === 'before') return 'Assumed';
  return type === 'number' && (stage === 'after' || run.template === 'general') ? 'Measured' : 'Observed';
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

function phaseContent(run, template) {
  if (currentPhase === 1) {
    const content = run.status === 'running' ? `<form class="entry-form" data-form="reading"><div class="field-grid">${fields(template.during, pendingValues(run, 'reading', {}), false, 'reading-')}</div><div class="actions"><button class="button primary">${icon('add')} เพิ่มบันทึก</button>${draftNote(run, 'reading')}</div></form>` : '';
    return content + `<div class="entry-list"><h3>บันทึกระหว่างทดลอง <small class="muted">(${run.logs.length})</small></h3>
      ${run.logs.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">เวลาบันทึก</th><th scope="col">ข้อมูล</th></tr></thead><tbody>${[...run.logs].reverse().map((log) => `<tr><td>${timeLabel(log.time)}</td><td>${template.during.filter(([key]) => log.data[key] != null).map(([key, label, type]) => `<div><span class="muted">${label}</span> ${e(log.data[key])} ${sourceTag(fieldSource(run, 'during', type, log.data[key]))}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">ยังไม่มีบันทึกระหว่างทดลอง</p>'}</div>`;
  }
  const before = currentPhase === 0;
  const stage = before ? 'before' : 'after';
  const locked = run.status !== (before ? 'draft' : 'results');
  const step = transitions[run.status];
  if (locked) return recordedFields(template[stage], run[stage], stage, run);
  return `<form class="form-body" data-form="${stage}">
    ${before ? `<label>ชื่อการทดลอง *<input id="run-title" name="runTitle" maxlength="100" required value="${e(pendingValues(run, stage, {}).runTitle ?? run.title)}"></label>` : ''}
    <div class="field-grid">${fields(template[stage], pendingValues(run, stage, run[stage]), locked)}</div>
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
  const nextPhase = { draft: 0, running: 1, results: 2 }[run.status];
  return `<a href="#${origin}" class="back">${icon('back')} ${runOrigins[origin]}</a>` +
    pageHead(e(run.title), `${e(run.id)} · ${template.name} · ${dayLabel(run.createdAt)}${run.demo ? ' · ข้อมูลตัวอย่าง' : ''}`,
      run.status === 'closed' ? `<button class="button" data-action="copy-run">${icon('copy')} ทำสำเนาเป็นร่าง</button>` : '') +
    `<section id="run-conflict" class="conflict notice" ${conflictRunId === run.id ? '' : 'hidden'}><p role="alert">รันนี้เปลี่ยนจากอีกแท็บ ข้อความที่กรอกในแท็บนี้ยังอยู่</p><button class="button" data-action="reload-run">โหลดล่าสุดและทิ้งข้อความที่ยังไม่บันทึก</button></section><div class="detail-grid"><section class="panel">
      <nav class="steps" aria-label="ช่วงการทดลอง">${phases.map((label, i) => `<button type="button" class="step" data-action="phase" data-phase="${i}" aria-pressed="${i === currentPhase}"><span class="step-number">${i + 1}</span> <span>${label}</span></button>`).join('')}</nav>
      <div class="panel-pad"><div class="form-body"><div><h2>${phases[currentPhase]}</h2><p class="muted">${phaseHint(run, currentPhase)}</p></div>${phaseContent(run, template)}</div></div>
    </section><aside class="detail-aside" aria-label="สถานะและรายงาน">
      <section class="panel panel-pad aside-body"><h2>สถานะรัน</h2><div>${status(run)}</div>
      ${nextTask[run.status] ? `<p class="hint">${nextTask[run.status]}</p>` : ''}
      ${nextPhase != null && nextPhase !== currentPhase ? `<button class="button" data-action="phase" data-phase="${nextPhase}">ไปช่วง${phases[nextPhase]} ${icon('next')}</button>` : ''}
      ${run.template === 'spray' ? etaMarkup(run) + drops(run) : ''}
      ${['ready', 'running'].includes(run.status) ? `<button class="button primary" data-action="advance">${next[1]}</button>` : ''}
      ${run.status === 'closed' ? '<p class="hint">ข้อมูลที่ปิดรันแล้วแก้ไขไม่ได้</p>' : ''}
      </section>
      ${run.template === 'spray' ? '<section class="panel panel-pad aside-body prediction"><h2>พยากรณ์ Tout</h2><strong>รอไฟล์โมเดล</strong><p class="hint">ค่าพยากรณ์จะแสดงแยกจากอุณหภูมิที่อ่านจากเครื่อง</p></section>' : ''}
      <section class="panel panel-pad aside-body"><h2>ส่งออกรายงาน</h2><p class="hint">${run.status === 'closed' ? 'ใช้ข้อมูลที่บันทึกในรันนี้' : 'เปิดใช้เมื่อปิดรันแล้ว'}</p><div class="actions">${['PDF', 'Word', 'Excel'].map((format) => `<button class="button" data-action="report" data-format="${format}" ${run.status === 'closed' ? '' : 'disabled'}>${format}</button>`).join('')}</div></section>
    </aside></div>`;
}

function render(focusMain = false) {
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
  };
  main.innerHTML = selected ? detail(selected) : name === 'run' ? pageHead('ไม่พบรัน', 'เปิดรันจากรายการการทดลองอีกครั้ง', '<a class="button" href="#runs">กลับไปรายการ</a>') :
    admin ? adminPage(name) : executive ? executivePage(name === 'executive-reports') : views[name]();
  if (focusMain) main.focus({ preventScroll: true });
  updateLabClock();
}

function toggleMascotMotion(button) {
  mascotPaused = !mascotPaused;
  document.documentElement.classList.toggle('mascot-paused', mascotPaused);
  button.setAttribute('aria-pressed', String(mascotPaused));
}

function message(text, celebrate = false) {
  const notice = document.querySelector('#notification');
  notice.textContent = text;
  notice.classList.toggle('notification-celebration', celebrate);
  if (celebrate) {
    const mascot = new Image(40, 44);
    mascot.src = 'icons/mascot-done.svg';
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
    const sequence = latest.reduce((max, record) => Math.max(max, Number(record.id.slice(2)) || 0), 0) + 1;
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
    if (await replace(run, { ...run, logs: [...run.logs, { time: new Date().toISOString(), data }] })) {
      pendingForms.delete(formKey(run, stage));
      render();
      main.querySelector('.entry-form input')?.focus();
      message('เพิ่มบันทึกแล้ว');
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
    message(stage === 'before' ? 'บันทึกร่างแล้ว' : 'บันทึกผลแล้ว');
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
  if (action === 'pause-mascot') toggleMascotMotion(button);
  if (action === 'clear-run-filters') {
    for (const input of main.querySelectorAll('.run-filters input, .run-filters select')) input.value = '';
    filterList();
    main.querySelector('#search').focus();
  }
  if (action === 'add-machine') showMachine();
  if (action === 'cancel-machine') machineDialog.close();
  if (action === 'read-alerts') void markAlerts(alerts().map(({ key }) => key));
  if (action === 'clear-machine-filter') clearMachineFilters();
  if (action === 'executive-period') {
    executivePeriod = Number(button.dataset.days);
    render();
    main.querySelector('.period [aria-pressed="true"]').focus();
  }
  if (action === 'summary-export') exportSummary();
  if (action === 'phase') {
    currentPhase = Number(phase);
    render();
    main.querySelector('.step[aria-pressed="true"]').focus();
  }
  const run = currentRun();
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
  const run = currentRun();
  if (run && ['before', 'after', 'reading'].includes(form?.dataset.form)) rememberForm(run, form);
  if (event.target.id === 'preview-users') {
    const query = event.target.value.trim().toLowerCase();
    const rows = [...main.querySelectorAll('tbody tr')];
    rows.forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
    document.querySelector('#preview-users-empty').hidden = rows.some((row) => !row.hidden);
  }
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
