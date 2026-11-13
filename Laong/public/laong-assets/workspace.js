'use strict';

const workspaceKey = 'laong.workspace.v1';
const modelVersion = 'ua-energy-balance-1.0.0';
const initialMachines = [
  { id: 'SD-01', name: 'เครื่องห้องแล็บ 1', maintenance: false },
  { id: 'SD-02', name: 'เครื่องห้องแล็บ 2', maintenance: false },
  { id: 'SD-03', name: 'เครื่องทดสอบ', maintenance: true },
  { id: 'SD-04', name: 'เครื่องสำรอง', maintenance: false },
];

function readWorkspace() {
  const raw = localStorage.getItem(workspaceKey);
  return raw ? JSON.parse(raw) : {
    machines: initialMachines, nextMachine: 5,
    preferences: { name: '', defaultMachine: '', feedAlerts: true, resultAlerts: true, historyMinimum: 3 },
    readAlerts: [],
  };
}

let labWorkspace;
let workspaceReadFailed = false;
try {
  labWorkspace = readWorkspace();
} catch {
  workspaceReadFailed = true;
  labWorkspace = { machines: [], nextMachine: null, preferences: { historyMinimum: 3 }, readAlerts: [] };
}

async function updateWorkspace(update) {
  try {
    if (!navigator.locks) throw new Error('Web Locks unavailable');
    return await navigator.locks.request(workspaceKey, () => {
      const current = readWorkspace();
      const next = update(current);
      if (!next) {
        labWorkspace = current;
        return false;
      }
      localStorage.setItem(workspaceKey, JSON.stringify(next));
      labWorkspace = next;
      return true;
    });
  } catch {
    message('บันทึกข้อมูลไม่ได้ ลองเปิดด้วย Chrome หรือ Edge แล้วลองอีกครั้ง');
    return false;
  }
}

window.addEventListener('storage', (event) => {
  if (event.key !== workspaceKey) return;
  try {
    labWorkspace = readWorkspace();
    workspaceReadFailed = false;
    if (route().name === 'machines' && !document.querySelector('#machine-dialog').open) refreshMachineResults();
    if (['calendar', 'today', 'notifications'].includes(route().name) && !visitDialog.open && !dialog.open) render();
  } catch {
    message('อ่านข้อมูลที่เปลี่ยนจากอีกแท็บไม่ได้');
  }
});

function machineId(number) {
  return Number.isSafeInteger(number) ? `SD-${String(number).padStart(2, '0')}` : 'รอออกรหัส';
}

function machineOptions(selected = '') {
  return '<option value="">เลือกเครื่อง</option>' + labWorkspace.machines.map((machine) =>
    `<option value="${e(machine.id)}" ${selected === machine.id ? 'selected' : ''} ${machine.maintenance ? 'disabled' : ''}>${e(machine.id)} · ${e(machine.name)}${machine.maintenance ? ' (รอซ่อม)' : ''}</option>`).join('');
}

function dropletStrip(filled, count) {
  return `<div class="droplets" aria-hidden="true">${Array.from({ length: count }, (_, i) =>
    `<svg class="droplet ${i < filled ? '' : 'pending'}" viewBox="0 0 16 20"><path fill="currentColor" d="M8 1C6 5 2 8.4 2 13a6 6 0 0 0 12 0c0-4.6-4-8-6-12Z"/></svg>`).join('')}</div>`;
}

function machineSticker(id, pending = false) {
  const filled = Math.min(Number(id.replace('SD-', '')) || 0, 8);
  return `<div class="machine-sticker"><div><small>Machine ID</small><strong class="mono">${e(id)}</strong>${pending ? '<small>ระบบยืนยันรหัสเมื่อบันทึก</small>' : ''}</div>
    ${dropletStrip(filled, 8)}</div>`;
}

const machineStates = { available: 'ว่าง', ready: 'พร้อมรัน', running: 'กำลังรัน', maintenance: 'รอซ่อม' };
const filterKey = 'laong.machine-filter.v1';
let machineFilters = { query: '', status: '' };
try {
  const saved = JSON.parse(sessionStorage.getItem(filterKey));
  if (typeof saved?.query === 'string') machineFilters = saved;
} catch { /* Filters can still work in memory. */ }

function machineResults() {
  const query = machineFilters.query.trim().toLowerCase();
  const rows = labWorkspace.machines.map((machine) => {
    const runs = experiments.filter((run) => run.template === 'spray' && run.before.machine === machine.id);
    const active = runs.find((run) => run.status === 'running');
    const ready = runs.find((run) => run.status === 'ready');
    const state = active ? 'running' : machine.maintenance ? 'maintenance' : ready ? 'ready' : 'available';
    return { machine, state, run: active || (state === 'ready' ? ready : undefined) };
  }).filter(({ machine, state }) => `${machine.id} ${machine.name}`.toLowerCase().includes(query) &&
    (!machineFilters.status || state === machineFilters.status));
  return `<p class="machine-count hint" role="status">แสดง ${rows.length} จาก ${labWorkspace.machines.length} เครื่อง</p>
    ${rows.length ? `<ul class="machine-list">${rows.map(({ machine, state, run }) =>
      `<li class="machine-row"><div class="machine-name"><span class="mono">${e(machine.id)}</span><strong>${e(machine.name)}</strong></div>
      <div><span class="status ${state === 'maintenance' ? 'results' : state}">${machineStates[state]}</span></div>
      <div class="machine-context">${run ? `<p class="hint"><span class="mono">${e(run.id)}</span> · ${e(run.title)}</p>${state === 'running' ? etaMarkup(run, true) : ''}` : `<p class="hint">${state === 'maintenance' ? 'หยุดใช้ชั่วคราว' : 'ยังไม่มีรันรอเริ่ม'}</p>`}</div>
      <div class="machine-action actions">${run ? `<a class="button" href="${runLink(run)}">เปิดรัน</a>` : state === 'maintenance' ? '' : `<button class="button" data-action="create" data-template="spray" data-machine="${e(machine.id)}">สร้างรัน</button>`}
      <span class="row-tools"><button class="button icon-tool" data-action="edit-machine" data-machine="${e(machine.id)}" aria-label="แก้ไขเครื่อง ${e(machine.id)}" title="แก้ไขเครื่อง"></button>
      <button class="button icon-tool" data-action="delete-machine" data-machine="${e(machine.id)}" aria-label="ลบเครื่อง ${e(machine.id)}" title="ลบเครื่อง"></button></span></div></li>`).join('')}</ul>`
      : '<div class="empty"><p>ไม่พบเครื่องที่ตรงกับตัวกรอง</p><button class="button" data-action="clear-machine-filter">ล้างตัวกรอง</button></div>'}`;
}

function machinesPage() {
  return pageHead('เครื่อง', 'ทะเบียนเครื่องของทีมวิจัย A', `<button class="button primary" data-action="add-machine">${icon('add')} เพิ่มเครื่อง</button>`) +
    `<section class="panel"><div class="filters machine-filters"><label>ค้นหาเครื่อง<input type="search" id="machine-search" maxlength="100" value="${e(machineFilters.query)}" placeholder="ชื่อเครื่องหรือ Machine ID"></label>
    <label>สถานะ<select id="machine-status"><option value="">ทุกสถานะ</option>${Object.entries(machineStates).map(([key, label]) =>
      `<option value="${key}" ${key === machineFilters.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <button class="button subtle" data-action="clear-machine-filter" id="clear-machine-filter" ${machineFilters.query || machineFilters.status ? '' : 'disabled'}>ล้างตัวกรอง</button></div>
    <div id="machine-results">${machineResults()}</div></section>`;
}

function refreshMachineResults() {
  const results = document.querySelector('#machine-results');
  if (results) results.innerHTML = machineResults();
}

function updateMachineFilters() {
  const search = document.querySelector('#machine-search');
  const status = document.querySelector('#machine-status');
  machineFilters = { query: search.value, status: status.value };
  document.querySelector('#clear-machine-filter').disabled = !search.value && !status.value;
  try { sessionStorage.setItem(filterKey, JSON.stringify(machineFilters)); } catch { /* In-memory filters remain available. */ }
  refreshMachineResults();
}

function clearMachineFilters() {
  const search = document.querySelector('#machine-search');
  search.value = '';
  document.querySelector('#machine-status').value = '';
  updateMachineFilters();
  search.focus();
}

function eta(run) {
  if (run.template !== 'spray' || run.status !== 'running') return null;
  const logs = [...run.logs].reverse();
  const volume = logs.find(({ data }) => Number.isFinite(data.volume))?.data.volume;
  const feed = logs.find(({ data }) => Number.isFinite(data.feed))?.data.feed;
  const target = run.before.volume;
  const remaining = Number.isFinite(volume) && target > 0 ? Math.max(0, target - volume) : null;
  const l1 = remaining === 0 ? 0 : remaining !== null && feed > 0 ? Math.ceil(remaining / feed) : null;
  const durations = experiments.filter((record) => record.template === 'spray' && record.status === 'closed' &&
    run.before.machine && record.before.machine === run.before.machine && Boolean(record.demo) === Boolean(run.demo))
    .map((record) => (Date.parse(record.feedEndedAt) - Date.parse(record.startedAt)) / 60000)
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0);
  const l2 = durations.length >= labWorkspace.preferences.historyMinimum
    ? [Math.floor(Math.min(...durations)), Math.ceil(Math.max(...durations))] : null;
  return { l1, l2 };
}

function etaMarkup(run, compact = false) {
  const result = eta(run);
  if (!result) return '';
  const value = result.l1 === null ? 'ยังไม่มีค่า' : result.l1 === 0 ? 'ป้อนครบตามที่บันทึก' : `อีก ${result.l1} นาที`;
  const l2 = result.l2 ? `<p class="hint">L2 · เวลาป้อนทั้งหมดของรันย้อนหลัง ${result.l2.join('–')} นาที <span class="source">Assumed</span></p>` : '';
  return `<div class="eta"><strong>${result.l1 === null ? 'ยังประมาณไม่ได้' : value}</strong> <span class="source">${run.demo ? 'ข้อมูลจำลอง' : result.l1 === null ? 'ข้อมูลไม่ครบ' : 'ค่าคำนวณ'}</span>${compact ? '' : '<p class="hint">จากปริมาตรคงเหลือและอัตราป้อนที่บันทึก</p>' + l2}</div>`;
}

const alertSources = { all: 'ทั้งหมด', system: 'ระบบ', run: 'การทดลอง', calendar: 'ปฏิทินแล็บ' };
let alertSource = 'all';

function alerts() {
  const runEvents = experiments.flatMap((run) => {
    const events = [];
    if (labWorkspace.preferences.feedAlerts && run.template === 'spray' && run.before.volume > 0) {
      const reached = run.logs.find((entry) => entry.data.volume >= run.before.volume);
      if (reached) events.push({ key: `${run.id}:feed`, text: 'ป้อนครบตามที่บันทึก', detail: 'ตรวจค่ารอบสุดท้ายก่อนจบการทดลอง', time: reached.time, run });
    }
    if (labWorkspace.preferences.resultAlerts && run.status === 'results') {
      events.push({ key: `${run.id}:results`, text: 'รอกรอกผลแล็บ', detail: 'เปิดรันเพื่อบันทึกข้อมูลหลังทดลอง', time: run.feedEndedAt || run.stageChangedAt || run.createdAt, run });
    }
    return events.map(event => ({ ...event, source: 'run', href: runLink(run), text: `${run.id} · ${event.text}` }));
  });
  const today = labDate();
  const tomorrow = calendarDay(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const upcomingDates = [today, dateKey(tomorrow)];
  const calendarEvents = visitList().filter(visit => upcomingDates.includes(visit.date)).flatMap(visit => {
    const start = new Date(`${visit.date}T${visit.start}+07:00`);
    if (!Number.isFinite(start.getTime())) return [];
    return [{
      key: `visit:${visit.id}:${visit.date}:${visit.start}`, source: 'calendar',
      href: `#calendar?date=${encodeURIComponent(visit.date)}`, text: visit.title,
      detail: 'แผนเข้าแล็บ', time: start.toISOString(),
    }];
  });
  const systemEvents = readFailed || workspaceReadFailed ? [{
    key: 'system:storage-read', source: 'system', text: 'อ่านข้อมูลในเบราว์เซอร์ไม่ได้',
    detail: 'ลองโหลดหน้าใหม่เพื่อตรวจสอบอีกครั้ง',
  }] : [];
  return [...systemEvents, ...[...runEvents, ...calendarEvents].sort((a, b) => b.time.localeCompare(a.time))];
}

function visibleAlerts(items) {
  return items.filter(item => alertSource === 'all' || item.source === alertSource);
}

function notificationsPage() {
  const items = alerts();
  const unread = items.filter(({ key }) => !labWorkspace.readAlerts.includes(key)).length;
  const visible = visibleAlerts(items);
  const hasUnread = visible.some(({ key }) => !labWorkspace.readAlerts.includes(key));
  return pageHead('แจ้งเตือน', `ยังไม่ได้อ่าน ${unread} รายการ`) +
    `<section class="panel alert-panel"><div class="alert-toolbar">
      <div class="alert-filters" role="group" aria-label="กรองตามแหล่งแจ้งเตือน">${Object.entries(alertSources).map(([key, label]) =>
        `<button type="button" class="button subtle" data-action="filter-alerts" data-source="${key}" aria-pressed="${alertSource === key}">${label}</button>`).join('')}</div>
      ${hasUnread ? `<button type="button" class="button subtle" data-action="read-alerts">${alertSource === 'all' ? 'อ่านทั้งหมด' : 'อ่านที่แสดงทั้งหมด'}</button>` : ''}
    </div><p class="alert-count hint" role="status">แสดง ${visible.length} รายการ</p>
    ${visible.length ? `<ul class="alert-list">${visible.map(({ key, text, detail, time, href, source }) => {
      const content = `<div><strong>${e(text)}</strong><p class="hint">${alertSources[source]} · ${e(detail)}</p></div><small>${time ? timeLabel(time) : ''}${labWorkspace.readAlerts.includes(key) ? '' : `${time ? ' · ' : ''}ยังไม่อ่าน`}</small>`;
      return `<li>${href ? `<a class="alert-row" href="${e(href)}" data-alert-key="${e(key)}">${content}</a>` : `<div class="alert-row">${content}</div>`}</li>`;
    }).join('')}</ul>` : '<p class="empty">ยังไม่มีแจ้งเตือนในหมวดนี้</p>'}</section>`;
}

function settingsPage() {
  const prefs = labWorkspace.preferences;
  return pageHead('ตั้งค่า', 'โปรไฟล์และค่าเริ่มต้นของพื้นที่ทดลองบนเครื่อง') +
    `<form class="settings-grid" data-form="settings"><section class="panel panel-pad form-body">
      <h2>โปรไฟล์และการใช้งาน</h2>
      <label>ชื่อที่แสดง<input name="displayName" maxlength="80" value="${e(prefs.name)}"></label>
      <label>เครื่องเริ่มต้น<select name="defaultMachine">${machineOptions(prefs.defaultMachine)}</select></label>
      <div class="actions"><button class="button primary">บันทึกการตั้งค่า</button></div>
    </section><section class="panel panel-pad form-body"><h2>การแจ้งเตือน</h2>
      <label class="check"><input type="checkbox" name="feedAlerts" ${prefs.feedAlerts ? 'checked' : ''}> ป้อนครบตามที่บันทึก</label>
      <label class="check"><input type="checkbox" name="resultAlerts" ${prefs.resultAlerts ? 'checked' : ''}> รอกรอกผลแล็บ</label>
      <p class="hint">การแจ้งเตือนอยู่ในแอปบนเบราว์เซอร์นี้</p>
    </section></form>
    <section class="panel panel-pad preview-links"><div><h2>พรีวิวตามบทบาท</h2><p class="hint">ใช้ข้อมูลสังเคราะห์สำหรับดูหน้าจอ</p></div><div class="actions"><a class="button" href="#admin">Admin</a><a class="button" href="#executive">ผู้บริหาร</a></div></section>`;
}

const machineDialog = document.querySelector('#machine-dialog');
const machineForm = document.querySelector('#machine-form');
const machineName = machineForm.elements.name;
const machineError = document.querySelector('#machine-error');

let editingMachine = null;

function showMachine(id) {
  editingMachine = labWorkspace.machines.find(machine => machine.id === id) ?? null;
  if (id && !editingMachine) return;
  machineForm.reset();
  machineName.value = editingMachine?.name ?? '';
  document.querySelector('#machine-title').textContent = editingMachine ? 'แก้ไขเครื่อง' : 'เพิ่มเครื่องใหม่';
  machineForm.querySelector('.primary').textContent = editingMachine ? 'บันทึกการแก้ไข' : 'เพิ่มเครื่อง';
  machineForm.querySelector('[data-action="delete-machine"]').hidden = !editingMachine;
  machineName.removeAttribute('aria-invalid');
  machineError.hidden = true;
  document.querySelector('#machine-count').textContent = `${[...machineName.value].length}/40`;
  document.querySelector('#machine-preview').innerHTML = machineSticker(editingMachine?.id ?? machineId(labWorkspace.nextMachine), !editingMachine);
  machineDialog.showModal();
}

machineName.addEventListener('input', () => {
  document.querySelector('#machine-count').textContent = `${[...machineName.value].length}/40`;
  machineError.hidden = true;
  machineName.removeAttribute('aria-invalid');
});

machineForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = machineName.value.trim();
  if ([...name].length < 2 || [...name].length > 40) {
    machineError.textContent = 'ใส่ชื่อเครื่อง 2 ถึง 40 ตัวอักษร';
    machineError.hidden = false;
    machineName.setAttribute('aria-invalid', 'true');
    machineName.focus();
    return;
  }
  const submit = event.submitter || machineForm.querySelector('button.primary');
  if (submit.disabled) return;
  submit.disabled = true;
  let added;
  const original = editingMachine;
  const saved = await updateWorkspace((state) => {
    if (original) {
      if (!machineMatches(state, original)) return null;
      return { ...state, machines: state.machines.map(machine => machine.id === original.id ? { ...machine, name } : machine) };
    }
    if (!Number.isSafeInteger(state.nextMachine)) throw new Error('Invalid machine counter');
    added = machineId(state.nextMachine);
    return { ...state, nextMachine: state.nextMachine + 1,
      machines: [...state.machines, { id: added, name, maintenance: false }] };
  });
  submit.disabled = false;
  if (!saved) return;
  machineDialog.close();
  render(true);
  message(original ? 'บันทึกชื่อเครื่องแล้ว' : `เพิ่มเครื่อง ${added} แล้ว`);
});

function machineMatches(state, original) {
  if (JSON.stringify(state.machines.find(machine => machine.id === original.id)) === JSON.stringify(original)) return true;
  message('ข้อมูลเครื่องเปลี่ยนจากอีกแท็บ กรุณาปิดแล้วเปิดใหม่');
  return false;
}

async function deleteMachine(id) {
  const original = id ? labWorkspace.machines.find(machine => machine.id === id) : editingMachine;
  if (!original || !await confirmDeletion(`ลบเครื่อง ${original.id} · ${original.name}?`,
    'เครื่องนี้จะหายจากทะเบียนและตัวเลือกตอนสร้างรัน หากมีรันอ้างอิง ระบบจะเก็บเครื่องไว้')) return;
  const saved = await updateWorkspace((state) => {
    if (!machineMatches(state, original)) return null;
    if (readRuns().some(run => run.before.machine === original.id) || readFailed) {
      message('ลบเครื่องไม่ได้ เครื่องนี้มีข้อมูลรันอ้างอิงหรือเปิดข้อมูลรันไม่ได้');
      return null;
    }
    const preferences = state.preferences.defaultMachine === original.id
      ? { ...state.preferences, defaultMachine: '' } : state.preferences;
    return { ...state, preferences, machines: state.machines.filter(machine => machine.id !== original.id) };
  });
  if (saved) {
    if (machineDialog.open) machineDialog.close();
    if (route().name === 'machines') refreshMachineResults();
    main.focus({ preventScroll: true });
    message(`นำเครื่อง ${original.id} ออกจากทะเบียนแล้ว`);
  }
}

async function markAlerts(keys, updateView = true) {
  const saved = await updateWorkspace((state) => ({ ...state, readAlerts: [...new Set([...state.readAlerts, ...keys])] }));
  if (saved && updateView) render(true);
}
