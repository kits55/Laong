'use strict';

// Admin preview records stay in a separate browser database.
(function () {
  'use strict';

  const organizations = {
    uni: { name: 'มหาวิทยาลัยละออง', type: 'มหาวิทยาลัย', labs: ['แล็บพัฒนาผลิตภัณฑ์', 'แล็บวิเคราะห์'] },
    school: { name: 'โรงเรียนสาธิตละออง', type: 'โรงเรียน', labs: ['ห้องปฏิบัติการวิทยาศาสตร์'] },
    company: { name: 'บริษัท ละอองฟู้ดส์', type: 'บริษัท', labs: ['โรงงานทดลอง', 'ห้องควบคุมคุณภาพ'] },
  };
  const machines = [
    ['uni', 0, 'SD-01', 'Spray Dryer', 'กำลังรัน'],
    ['uni', 1, 'MB-02', 'เครื่องวัดความชื้น', 'พร้อม'],
    ['school', 0, 'MX-01', 'เครื่องผสมตัวอย่าง', 'พร้อม'],
    ['company', 0, 'SD-01', 'Spray Dryer', 'พร้อม'],
    ['company', 1, 'MB-01', 'เครื่องวัดความชื้น', 'รอซ่อม'],
  ];
  const adminName = 'กานต์ วัฒนะ';
  const initialState = {
    users: [
      { id: 'U-001', name: 'สมชาย ใจดี', email: 'somchai@example.test', org: 'uni', role: 'นักวิจัย', status: 'active' },
      { id: 'U-002', name: 'สมศรี รักงาน', email: 'somsri@example.test', org: 'uni', role: 'ผู้ดูแลแล็บ', status: 'active' },
      { id: 'U-003', name: 'วิชัย ศรีสุข', email: 'wichai@example.test', org: 'company', role: 'ผู้บริหาร', status: 'active' },
      { id: 'U-004', name: 'อรอุมา แก้วใส', email: 'orauma@example.test', org: 'school', role: 'ครูผู้ดูแล', status: 'suspended' },
      { id: 'U-005', name: 'ณัฐชา พูนผล', email: 'natcha@example.test', org: '', role: 'ผู้ใช้ทั่วไป', status: 'active' },
    ],
    audit: [
      { at: '2026-11-13T02:42:00Z', actor: adminName, action: 'จำลองรีเซ็ตรหัสผ่าน', target: 'สมชาย ใจดี · U-001', org: 'uni', owner: adminName, outcome: 'บันทึกคำขอจำลอง' },
      { at: '2026-11-13T02:10:00Z', actor: 'พิมพ์ชนก ทองดี', action: 'ลงทะเบียนเครื่อง', target: 'MB-01', org: 'company', owner: 'พิมพ์ชนก ทองดี', outcome: 'เพิ่มในทะเบียนแล้ว' },
      { at: '2026-11-13T01:55:00Z', actor: 'พิมพ์ชนก ทองดี', action: 'ระงับบัญชีเดโม', target: 'อรอุมา แก้วใส · U-004', org: 'school', owner: adminName, outcome: 'ระงับแล้ว', reason: 'รอตรวจสอบบัญชีตัวอย่าง' },
    ],
    docs: [],
  };
  const statuses = { active: 'ใช้งาน', suspended: 'ระงับ' };
  const accountActions = {
    reset: { label: 'จำลองรีเซ็ตรหัสผ่าน', effect: 'เพิ่มรายการจำลองในประวัติ โดยรอบนี้ยังไม่มีการส่งอีเมลหรือเปลี่ยนรหัสผ่าน', outcome: 'บันทึกคำขอจำลอง' },
    suspend: { label: 'ระงับบัญชีเดโม', effect: 'เปลี่ยนสถานะในรายชื่อเดโมเป็นระงับ เปิดใช้งานคืนได้จากหน้าเดิม', outcome: 'ระงับแล้ว' },
    restore: { label: 'เปิดใช้งานบัญชีเดโม', effect: 'เปลี่ยนสถานะในรายชื่อเดโมกลับเป็นใช้งาน', outcome: 'เปิดใช้งานแล้ว' },
    delete: { label: 'ลบบัญชีเดโม', effect: 'นำบัญชีนี้ออกจากรายชื่อเดโมอย่างถาวร ประวัติการจัดการของบัญชียังดูย้อนหลังได้', outcome: 'นำออกจากรายชื่อแล้ว' },
  };
  const maxFileBytes = 8 * 1024 * 1024;

  let adminDatabase;
  function openAdminDatabase() {
    adminDatabase ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('laong-admin-preview', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('preview');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      adminDatabase = undefined;
      throw error;
    });
    return adminDatabase;
  }

  async function adminState(update) {
    const db = await openAdminDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('preview', update ? 'readwrite' : 'readonly');
      const store = tx.objectStore('preview');
      const request = store.get('state');
      let state;
      let failure;
      request.onsuccess = () => {
        state = request.result || structuredClone(initialState);
        if (!update) return;
        try {
          update(state);
          store.put(state, 'state');
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(state);
      tx.onabort = () => reject(failure || tx.error);
    });
  }

  const orgName = (id) => organizations[id]?.name || 'ผู้ใช้ทั่วไป';
  const orgOptions = Object.entries(organizations).map(([id, { name }]) => [id, name]);
  const orgFilter = [...orgOptions, ['individual', 'ผู้ใช้ทั่วไป']];
  const pick = (name, label, placeholder, options) => `<label>${label}<select name="${name}"><option value="">${placeholder}</option>${options.map(([value, text]) => `<option value="${e(value)}">${e(text)}</option>`).join('')}</select></label>`;
  const search = (label, placeholder) => `<label>${label}<input type="search" name="q" placeholder="${placeholder}"></label>`;
  const badge = (label, active = false) => `<span class="status ${active ? 'ready' : ''}">${e(label)}</span>`;
  const link = (href, label) => `<a class="button" href="#${href}">${label}${icon('next')}</a>`;
  const secondary = (primary, sub) => `<strong>${e(primary)}</strong><small class="admin-secondary">${e(sub)}</small>`;
  const includes = (query, ...values) => values.join(' ').toLowerCase().includes(query);
  const matchesOrg = (filter, value) => !filter || filter === (value || 'individual');
  const sortAudit = (state) => [...state.audit].sort((a, b) => b.at.localeCompare(a.at));

  function auditTable(events) {
    if (!events.length) return '<p class="admin-empty">ไม่พบกิจกรรมที่ตรงกับตัวกรอง</p>';
    return previewTable(['วันและเวลา (ไทย)', 'ผู้ทำรายการ', 'การจัดการและเป้าหมาย', 'ผล', 'ผู้รับผิดชอบ'], events.map((item) => [
      `<time datetime="${e(item.at)}">${e(timeLabel(item.at))}</time>`,
      secondary(item.actor, orgName(item.org)),
      secondary(item.action, item.target) + (item.reason ? `<small class="admin-secondary">เหตุผล: ${e(item.reason)}</small>` : ''),
      badge(item.outcome, true), e(item.owner),
    ]));
  }

  function accountButtons(user) {
    const actions = [['reset', 'lock'], [user.status === 'active' ? 'suspend' : 'restore', user.status === 'active' ? 'user' : 'done'], ['delete', 'trash']];
    return `<div class="admin-row-actions">${actions.map(([key, glyph]) => {
      const label = `${accountActions[key].label} ${user.name}`;
      return `<button class="button icon-tool ${key === 'delete' ? 'admin-danger' : ''}" type="button" data-admin-action="${key}" data-id="${e(user.id)}" aria-label="${e(label)}" title="${e(label)}">${icon(glyph)}</button>`;
    }).join('')}</div>`;
  }

  function workspaceTable(headers, rows, empty) {
    return `<p class="admin-result-count">${rows.length} รายการ</p>${rows.length ? previewTable(headers, rows) : `<p class="admin-empty">${empty}</p>`}`;
  }

  function previewDashboard(state) {
    const overview = [
      ['admin-users', 'user', 'บัญชีผู้ใช้', state.users.length],
      ['admin-machines', 'machine', 'เครื่องในทะเบียน', machines.length],
      ['admin-formula', 'lab', 'ไฟล์สูตรและเอกสาร', state.docs.length],
    ];
    return `<div class="admin-dashboard">
      <section class="panel admin-ledger">
        <div class="panel-head"><div><h2>กิจกรรมล่าสุด</h2><p class="muted">ติดตามว่าใครทำอะไรและใครรับผิดชอบ</p></div>${link('admin-audit', 'ดูประวัติทั้งหมด')}</div>
        <ol class="admin-timeline">${sortAudit(state).slice(0, 5).map((item) => `<li>
          <time datetime="${e(item.at)}">${e(timeLabel(item.at))}</time>
          <div>${secondary(item.action, item.target)}<p class="muted">${e(item.actor)} <span aria-hidden="true">·</span> ${e(orgName(item.org))}</p>
            ${item.owner !== item.actor ? `<p class="muted">ผู้รับผิดชอบ ${e(item.owner)}</p>` : ''}</div>
          ${badge(item.outcome, true)}
        </li>`).join('')}</ol>
      </section>
      <section class="panel admin-directory"><div class="panel-head"><h2>รายการที่ดูแล</h2></div>
        ${overview.map(([path, glyph, label, count]) => `<a href="#${path}">${icon(glyph)}<span>${label}</span><strong class="mono">${count}</strong>${icon('next')}</a>`).join('')}
      </section>
    </div>`;
  }

  function listPanel(title, fields) {
    return `<section class="panel admin-register"><div class="panel-head"><h2>${title}</h2></div>
      <form class="admin-filters" data-admin-filters>${fields}</form>
      <div data-admin-results></div><span class="sr-only" data-admin-count role="status"></span></section>`;
  }

  function mountAuditDate(root, refresh) {
    const input = root.querySelector('[name="date"]');
    const trigger = root.querySelector('#admin-date-trigger');
    const picker = root.querySelector('#admin-date-picker');
    const controls = picker.querySelector('[data-date-controls]');
    const grid = picker.querySelector('[data-date-grid]');
    const modes = [...picker.querySelectorAll('[data-date-mode]')];
    const periods = { day: 'เดือน', month: 'ปี', year: 'ช่วงปี' };
    let month;
    let mode;

    function draw() {
      const year = month.getUTCFullYear();
      const firstYear = firstYearOnPage(year);
      const lastYear = Math.min(firstYear + yearPageSize - 1, lastCalendarYear);
      const heading = mode === 'day' ? labMonthFormat.format(month)
        : mode === 'month' ? `พ.ศ. ${year + 543}` : `พ.ศ. ${firstYear + 543}–${lastYear + 543}`;
      picker.querySelector('[data-date-month]').textContent = heading;
      const [previous, next] = controls.querySelectorAll('button');
      previous.setAttribute('aria-label', `${periods[mode]}ก่อน`);
      next.setAttribute('aria-label', `${periods[mode]}ถัดไป`);
      previous.disabled = mode === 'year' ? firstYear <= firstCalendarYear
        : year <= firstCalendarYear && (mode === 'month' || month.getUTCMonth() === 0);
      next.disabled = mode === 'year' ? lastYear >= lastCalendarYear
        : year >= lastCalendarYear && (mode === 'month' || month.getUTCMonth() === 11);
      modes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.dateMode === mode)));
      const offset = (month.getUTCDay() + 6) % 7;
      const today = labDate();
      grid.className = mode === 'day' ? 'calendar-grid' : 'calendar-options admin-date-periods';
      grid.setAttribute('aria-label', { day: 'วันในเดือน', month: 'เดือนในปี', year: 'ปี พ.ศ.' }[mode]);
      if (mode !== 'day') {
        const options = mode === 'month'
          ? Array.from({ length: 12 }, (_, index) => {
            const date = new Date(Date.UTC(year, index, 1));
            return [dateKey(date).slice(0, 7), labMonthName.format(date)];
          })
          : Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
            const value = firstYear + index;
            return [String(value), value + 543];
          });
        grid.innerHTML = options.map(([key, label]) => `<button type="button" class="calendar-option${mode === 'year' ? ' mono' : ''}"
          data-date-value="${key}" aria-pressed="${key === input.value}"
          ${today.startsWith(key) ? 'aria-current="date"' : ''}>${label}</button>`).join('');
        return;
      }
      const weekdays = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
      grid.innerHTML = weekdays.map((day) => `<span class="calendar-weekday" aria-hidden="true">${day}</span>`).join('') +
        Array.from({ length: 42 }, (_, index) => {
          const day = new Date(month);
          day.setUTCDate(index - offset + 1);
          const key = dateKey(day);
          return `<button type="button" class="calendar-day mono${day.getUTCMonth() !== month.getUTCMonth() ? ' outside' : ''}"
            data-date-value="${key}" aria-label="${labLongDateFormat.format(day)}" aria-pressed="${key === input.value}"
            ${key === today ? 'aria-current="date"' : ''}>${day.getUTCDate()}</button>`;
        }).join('');
    }

    function select(value) {
      input.value = value;
      const label = value.length === 4 ? `พ.ศ. ${Number(value) + 543}`
        : value.length === 7 ? labMonthFormat.format(calendarDay(`${value}-01`))
        : value ? dayLabel(calendarDay(value)) : 'เลือกช่วงเวลา';
      trigger.querySelector('span').textContent = label;
      refresh();
      picker.close();
    }

    trigger.onclick = () => {
      const value = input.value || labDate();
      mode = value.length === 4 ? 'year' : value.length === 7 ? 'month' : 'day';
      month = calendarDay(value.length === 4 ? `${value}-01-01` : `${value.slice(0, 7)}-01`);
      draw();
      picker.showModal();
      (grid.querySelector('[aria-pressed="true"]') || grid.querySelector('[aria-current="date"]') ||
        controls.querySelector('button')).focus();
    };
    picker.onclick = (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const { dateStep, dateValue, dateAction, dateMode } = button.dataset;
      if (dateMode) {
        mode = dateMode;
        draw();
      }
      if (dateStep) {
        const step = Number(dateStep);
        if (mode === 'day') month.setUTCMonth(month.getUTCMonth() + step);
        else month.setUTCFullYear(Math.min(lastCalendarYear, Math.max(firstCalendarYear,
          month.getUTCFullYear() + step * (mode === 'year' ? yearPageSize : 1))));
        draw();
        if (button.disabled) controls.querySelector('button:not(:disabled)')?.focus();
      }
      if (dateValue) select(dateValue);
      if (dateAction === 'clear') select('');
      if (dateAction === 'today') select(labDate());
      if (dateAction === 'close') picker.close();
    };
    picker.onclose = () => trigger.focus();
  }

  const sections = {
    'admin': ['ภาพรวม Admin', 'ติดตามงานดูแลบัญชี เครื่อง และเอกสารแล็บ'],
    'admin-users': ['ผู้ใช้', 'ค้นหาบัญชีตัวอย่างและลองจัดการสถานะ'],
    'admin-machines': ['ทะเบียนเครื่ององค์กร', 'ค้นหาเครื่องตามองค์กรและห้องแล็บ'],
    'admin-audit': ['ประวัติการจัดการ', 'ตรวจสอบผู้ทำรายการ เป้าหมาย ผล และผู้รับผิดชอบ'],
    'admin-formula': ['คลังสูตรและเอกสาร', 'จัดเก็บเอกสารแล็บพร้อมชื่อและเวอร์ชัน'],
  };

  async function mountAdminPreview(root, page) {
    let state;
    try {
      state = await adminState();
    } catch {
      if (!root.isConnected) return;
      root.removeAttribute('aria-busy');
      root.innerHTML = pageHead('เปิดพรีวิว Admin ไม่ได้', 'ตรวจการตั้งค่าพื้นที่จัดเก็บของเบราว์เซอร์ แล้วโหลดหน้าใหม่', '<button class="button" type="button">ลองอีกครั้ง</button>');
      root.querySelector('button').onclick = () => mountAdminPreview(root, page);
      return;
    }
    if (!root.isConnected) return;

    const [title, description] = sections[page];
    const upload = '<button type="button" class="button primary" data-admin-action="upload">' + icon('add') + ' เพิ่มเอกสาร</button>';
    const content = {
      'admin': () => previewDashboard(state),
      'admin-users': () => listPanel('บัญชีผู้ใช้ทั้งหมด', search('ค้นหาผู้ใช้', 'ชื่อ อีเมล หรือรหัสผู้ใช้') +
        pick('org', 'องค์กร', 'ทุกองค์กรและผู้ใช้ทั่วไป', orgFilter) + pick('status', 'สถานะ', 'ทุกสถานะ', Object.entries(statuses))),
      'admin-machines': () => listPanel('รายการเครื่อง', search('ค้นหาเครื่อง', 'ชื่อเครื่อง หรือ Machine ID') +
        pick('org', 'องค์กร', 'ทุกองค์กร', orgOptions) + pick('lab', 'ห้องแล็บ', 'ทุกห้อง', [])),
      'admin-audit': () => listPanel('รายการย้อนหลัง', search('ค้นหากิจกรรม', 'ผู้ทำรายการ งาน หรือเป้าหมาย') +
        pick('org', 'องค์กร', 'ทุกองค์กรและผู้ใช้ทั่วไป', orgFilter) +
        `<div class="admin-date-field"><label for="admin-date-trigger">ช่วงเวลา (เวลาไทย)</label>
        <input type="hidden" name="date"><button type="button" id="admin-date-trigger" class="button" aria-haspopup="dialog"><span>เลือกช่วงเวลา</span>${icon('today')}</button></div>`) +
        `<dialog class="admin-dialog admin-date-picker" id="admin-date-picker" aria-labelledby="admin-date-title">
          <header><h2 id="admin-date-title">เลือกช่วงเวลา</h2><button type="button" class="button subtle" data-date-action="close">ปิด</button></header>
          <div class="admin-date-modes" role="group" aria-label="ช่วงที่ต้องการดู">
            <button type="button" data-date-mode="day">วัน</button>
            <button type="button" data-date-mode="month">เดือน</button>
            <button type="button" data-date-mode="year">ปี</button>
          </div>
          <div class="admin-date-month" data-date-controls>
            <button type="button" class="button icon-tool" data-date-step="-1" aria-label="เดือนก่อน">${icon('back')}</button>
            <strong data-date-month aria-live="polite"></strong>
            <button type="button" class="button icon-tool" data-date-step="1" aria-label="เดือนถัดไป">${icon('next')}</button>
          </div>
          <div data-date-grid role="group"></div>
          <footer><button type="button" class="button subtle" data-date-action="clear">ล้างช่วงเวลา</button>
          <button type="button" class="button" data-date-action="today">วันนี้</button></footer>
        </dialog>`,
      'admin-formula': () => listPanel('เอกสารที่จัดเก็บ', search('ค้นหาเอกสาร', 'ชื่อเอกสาร หรือชื่อไฟล์') +
        pick('org', 'องค์กร', 'ทุกองค์กร', orgOptions)) +
        `<section class="admin-model"><span>${icon('lock')}</span><div><h2>โมเดลคำนวณ Spray Dryer</h2><p class="muted"><span class="mono">${e(modelVersion)}</span> · รอตรวจสอบโมเดล ไฟล์ในคลังใช้สำหรับเปิดอ่านและดาวน์โหลด</p></div></section>`,
    };

    root.innerHTML = `<div class="admin-intro">${pageHead(title, description, page === 'admin-formula' ? upload : '')}
      <div class="admin-context"><span class="admin-preview-tag">พรีวิว Admin</span><span>ข้อมูลตัวอย่างและไฟล์อยู่ในเบราว์เซอร์นี้</span></div></div>
      <p class="admin-feedback" data-admin-feedback role="status"></p>
      ${content[page]()}
      <dialog class="admin-dialog" aria-labelledby="admin-dialog-title"><form data-admin-dialog-form></form></dialog>`;
    root.removeAttribute('aria-busy');

    const filters = root.querySelector('[data-admin-filters]');
    const results = root.querySelector('[data-admin-results]');
    const dialog = root.querySelector('dialog:has([data-admin-dialog-form])');
    const form = dialog.querySelector('form');
    let operation;
    let trigger;

    function showResults() {
      if (!filters) return;
      const { q, org, status, lab, date } = Object.fromEntries(new FormData(filters));
      const query = q.trim().toLowerCase();
      let markup;
      if (page === 'admin-users') {
        const users = state.users.filter((user) => matchesOrg(org, user.org) && (!status || user.status === status) &&
          includes(query, user.name, user.email, user.id));
        markup = workspaceTable(['ผู้ใช้', 'องค์กร', 'บทบาท', 'สถานะ', 'จัดการ'], users.map((user) => [
          secondary(user.name, user.email) + `<small class="admin-secondary mono">${e(user.id)}</small>`,
          e(orgName(user.org)), e(user.role), badge(statuses[user.status], user.status === 'active'), accountButtons(user),
        ]), 'ไม่พบผู้ใช้ที่ตรงกับตัวกรอง');
      } else if (page === 'admin-machines') {
        const rows = machines.filter(([id, room, code, name]) => matchesOrg(org, id) &&
          (!lab || `${id}:${room}` === lab) && includes(query, code, name));
        markup = workspaceTable(['Machine ID', 'เครื่อง', 'องค์กร', 'ห้องแล็บ', 'สถานะ'], rows.map(([id, room, code, name, availability]) => [
          `<strong class="mono">${e(code)}</strong>`, e(name), secondary(orgName(id), organizations[id].type),
          e(organizations[id].labs[room]), badge(availability, availability !== 'รอซ่อม'),
        ]), 'ไม่พบเครื่องที่ตรงกับตัวกรอง');
      } else if (page === 'admin-audit') {
        const entries = sortAudit(state).filter((item) => matchesOrg(org, item.org) && (!date || labDate(new Date(item.at)).startsWith(date)) &&
          includes(query, item.actor, item.action, item.target, item.owner, item.reason));
        markup = `<p class="admin-result-count">${entries.length} รายการ</p>${auditTable(entries)}`;
      } else {
        const docs = [...state.docs].reverse().filter((file) => matchesOrg(org, file.org) && includes(query, file.title, file.filename));
        markup = workspaceTable(['เอกสาร', 'องค์กร', 'เวอร์ชัน', 'เพิ่มเมื่อ', 'จัดการ'], docs.map((file) => {
          const newer = state.docs.some((item) => item.series === file.series && item.version > file.version);
          return [secondary(file.title, file.filename), e(orgName(file.org)), `<span class="mono">v${file.version}</span>`,
            e(timeLabel(file.at)), `<div class="admin-row-actions">
            <button class="button icon-tool" type="button" data-admin-action="download" data-id="${e(file.id)}" aria-label="ดาวน์โหลด ${e(file.title)} เวอร์ชัน ${file.version}" title="ดาวน์โหลด">${icon('export')}</button>
            ${newer ? '' : `<button class="button icon-tool" type="button" data-admin-action="version" data-id="${e(file.id)}" aria-label="เพิ่มเวอร์ชันให้ ${e(file.title)}" title="เพิ่มเวอร์ชัน">${icon('add')}</button>`}
            <button class="button icon-tool admin-danger" type="button" data-admin-action="delete-document" data-id="${e(file.id)}"
              aria-label="ลบ ${e(file.title)} เวอร์ชัน ${file.version}" title="ลบเวอร์ชันนี้">${icon('trash')}</button></div>`];
        }), 'ยังไม่มีเอกสารในรายการ ใช้ปุ่มเพิ่มเอกสารเพื่อแนบ PDF, Markdown หรือ Excel');
      }
      results.innerHTML = markup;
      const table = results.querySelector('.table-wrap');
      if (table) {
        table.tabIndex = 0;
        table.setAttribute('role', 'region');
        table.setAttribute('aria-label', `ตาราง${title}`);
      }
      root.querySelector('[data-admin-count]').textContent = results.querySelector('.admin-result-count').textContent;
    }

    if (page === 'admin-machines') {
      const { org, lab } = filters.elements;
      function syncLabs() {
        const id = org.value;
        lab.replaceChildren(new Option(id ? 'ทุกห้อง' : 'เลือกองค์กรก่อน', ''));
        lab.disabled = !id;
        organizations[id]?.labs.forEach((label, index) => lab.add(new Option(label, `${id}:${index}`)));
      }
      syncLabs();
      org.addEventListener('change', syncLabs);
    }
    filters?.addEventListener('input', (event) => {
      if (event.target.type === 'search') showResults();
    });
    filters?.addEventListener('change', showResults);
    filters?.addEventListener('submit', (event) => event.preventDefault());
    if (page === 'admin-audit') mountAuditDate(root, showResults);
    showResults();

    function displayDialog(button, key, item) {
      trigger = button;
      operation = { key, item };
      const action = accountActions[key];
      const uploadFile = key === 'upload' || key === 'version';
      const deleteFile = key === 'delete-document';
      const heading = deleteFile ? 'ลบเวอร์ชันเอกสาร' : action?.label || (item ? 'เพิ่มเวอร์ชันเอกสาร' : 'เพิ่มเอกสาร');
      const body = uploadFile ? `
        ${item ? `<p>${secondary(item.title, orgName(item.org))}</p>` : `
          <label>ชื่อเอกสาร<input name="title" required maxlength="120" placeholder="เช่น สูตรผงผลไม้ รุ่นทดลอง"></label>
          ${pick('org', 'องค์กร', 'เลือกองค์กร', orgOptions).replace('name="org"', 'name="org" required')}`}
        <label>ไฟล์เอกสาร<input type="file" name="file" required accept=".pdf,.md,.xlsx" aria-describedby="admin-file-hint"></label>
        <p class="hint" id="admin-file-hint">PDF, Markdown หรือ Excel (.xlsx) ขนาดไม่เกิน 8 MB</p>` : deleteFile ?
        `<p>${secondary(`${item.title} · v${item.version}`, item.filename)}</p>
        <p class="admin-effect">ไฟล์เวอร์ชันนี้จะถูกลบจากคลังและดาวน์โหลดไม่ได้อีก เวอร์ชันอื่นและประวัติการจัดการยังเปิดดูได้</p>` :
        `<p>${secondary(item.name, `${item.email} · ${orgName(item.org)}`)}</p>
        <p class="admin-effect">${e(action.effect)}</p>
        ${key === 'suspend' || key === 'delete' ? '<label>เหตุผล<textarea name="reason" required maxlength="300" rows="2"></textarea></label>' : ''}`;
      form.innerHTML = `<header><h2 id="admin-dialog-title">${heading}</h2><button type="button" class="button subtle" data-admin-close aria-label="ปิด">ปิด</button></header>
        <div class="admin-dialog-body">${body}<p class="admin-error" role="alert"></p></div>
        <footer><button type="button" class="button" data-admin-close>ยกเลิก</button>
        <button class="button ${key === 'delete' || deleteFile ? 'destructive' : 'primary'}" type="submit">${uploadFile ? 'บันทึกเอกสาร' : deleteFile ? 'ลบเวอร์ชันนี้' : 'ยืนยัน'}</button></footer>`;
      dialog.showModal();
      (form.querySelector('input, textarea') || form.querySelector('footer [data-admin-close]')).focus();
    }

    function download(file) {
      const url = URL.createObjectURL(new Blob([file.blob], { type: 'application/octet-stream' }));
      const anchor = Object.assign(document.createElement('a'), { href: url, download: file.filename });
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    root.onclick = (event) => {
      if (event.target.closest('[data-admin-close]')) {
        dialog.close();
        return;
      }
      const button = event.target.closest('[data-admin-action]');
      if (!button) return;
      const { adminAction: key, id } = button.dataset;
      const user = state.users.find((item) => item.id === id);
      const file = state.docs.find((item) => item.id === id);
      if (key === 'download' && file) download(file);
      if ((accountActions[key] && user) || key === 'upload' || ((key === 'version' || key === 'delete-document') && file)) displayDialog(button, key, user || file);
    };
    dialog.onclose = () => {
      const replacement = [...root.querySelectorAll('[data-admin-action]')].find((button) =>
        button.dataset.id === trigger?.dataset.id && button.dataset.adminAction === trigger?.dataset.adminAction);
      (replacement || filters?.elements.q || root.querySelector('[data-admin-action="upload"]'))?.focus();
    };

    form.onsubmit = async (event) => {
      event.preventDefault();
      const { key, item } = operation;
      const fields = new FormData(form);
      const submit = form.querySelector('[type="submit"]');
      const errorBox = form.querySelector('.admin-error');
      submit.disabled = true;
      errorBox.textContent = '';
      try {
        const action = accountActions[key];
        const at = new Date().toISOString();
        let feedback;
        if (action) {
          const reason = String(fields.get('reason') || '').trim();
          if ((key === 'suspend' || key === 'delete') && !reason) throw new Error('กรอกเหตุผลก่อนยืนยัน');
          state = await adminState((latest) => {
            const current = latest.users.find((user) => user.id === item.id);
            if (!current || current.status !== item.status) throw new Error('สถานะบัญชีเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่');
            if (key === 'delete') latest.users = latest.users.filter((user) => user.id !== item.id);
            if (key === 'suspend' || key === 'restore') current.status = key === 'suspend' ? 'suspended' : 'active';
            latest.audit.push({ at, actor: adminName, owner: adminName, action: action.label, outcome: action.outcome,
              target: `${current.name} · ${current.id}`, org: current.org, reason });
          });
          feedback = `${action.outcome} · ${item.name}`;
        } else if (key === 'delete-document') {
          state = await adminState((latest) => {
            const current = latest.docs.find((doc) => doc.id === item.id);
            if (!current) throw new Error('เวอร์ชันนี้ถูกลบแล้ว กรุณาโหลดหน้าใหม่');
            latest.docVersions ??= {};
            latest.docVersions[current.series] = Math.max(latest.docVersions[current.series] || 0, current.version);
            latest.docs = latest.docs.filter((doc) => doc.id !== current.id);
            latest.audit.push({ at, actor: adminName, owner: adminName, action: 'ลบเวอร์ชันเอกสาร', outcome: 'ลบแล้ว',
              target: `${current.title} · v${current.version}`, org: current.org });
          });
          feedback = `ลบ ${item.title} เวอร์ชัน ${item.version} แล้ว`;
        } else {
          const file = fields.get('file');
          const title = item?.title || String(fields.get('title')).trim();
          const org = item?.org || String(fields.get('org'));
          if (!title || !Object.hasOwn(organizations, org)) throw new Error('กรอกชื่อเอกสารและเลือกองค์กร');
          if (!(file instanceof File) || !file.size || !/\.(pdf|md|xlsx)$/i.test(file.name)) throw new Error('เลือกไฟล์ PDF, Markdown หรือ Excel (.xlsx) ที่มีข้อมูล');
          if (file.size > maxFileBytes) throw new Error('ไฟล์ใหญ่เกิน 8 MB กรุณาเลือกไฟล์ใหม่');
          const id = crypto.randomUUID();
          state = await adminState((latest) => {
            const matches = latest.docs.filter((doc) => doc.org === org && doc.title.toLowerCase() === title.toLowerCase());
            if (!item && matches.length) throw new Error('มีชื่อเอกสารนี้แล้ว ใช้ปุ่มเพิ่มเวอร์ชันจากรายการเดิม');
            if (item && !matches.some((doc) => doc.id === item.id)) throw new Error('เวอร์ชันต้นทางถูกลบแล้ว กรุณาโหลดหน้าใหม่');
            const version = item ? Math.max(latest.docVersions?.[item.series] || 0, ...matches.map((doc) => doc.version)) + 1 : 1;
            latest.docs.push({ id, series: item?.series || id, title, org, version, at, filename: file.name, blob: file });
            latest.audit.push({ at, actor: adminName, owner: adminName, action: 'บันทึกเอกสาร', outcome: 'จัดเก็บแล้ว',
              target: `${title} · v${version}`, org });
            feedback = `บันทึก ${title} เวอร์ชัน ${version} แล้ว`;
          });
        }
        showResults();
        root.querySelector('[data-admin-feedback]').textContent = feedback;
        dialog.close();
      } catch (error) {
        errorBox.textContent = error instanceof Error && error.name === 'Error' ? error.message :
          'บันทึกไม่ได้ ตรวจพื้นที่จัดเก็บของเบราว์เซอร์แล้วลองอีกครั้ง';
      } finally {
        submit.disabled = false;
      }
    };
  }

  window.mountAdminPreview = mountAdminPreview;
})();
