'use strict';

const labZone = 'Asia/Bangkok';
const labDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: labZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const labTimeFormat = new Intl.DateTimeFormat('th-TH', { timeZone: labZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const labMonthFormat = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const labLongDateFormat = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const visitDialog = document.querySelector('#visit-dialog');
const visitForm = document.querySelector('#visit-form');
const visitError = document.querySelector('#visit-error');
let editedVisit = null;
let calendarDate = labDate();

function labDate(now = new Date()) {
  const parts = Object.fromEntries(labDateFormat.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function updateLabClock() {
  const clock = document.querySelector('#lab-clock');
  const time = labTimeFormat.format(new Date());
  clock.textContent = time;
  clock.dateTime = time;
}
setInterval(updateLabClock, 15000);

function calendarDay(date) { return new Date(`${date}T00:00:00Z`); }
function dateKey(date) { return date.toISOString().slice(0, 10); }
function setCalendarRouteDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1901-01-01' || date > '9998-12-31') return;
  const parsed = calendarDay(date);
  if (Number.isFinite(parsed.getTime()) && dateKey(parsed) === date) calendarDate = date;
}
function visitList() {
  return [...(labWorkspace.visits ?? [])].sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

function visitRows(visits, showDate = false) {
  return `<ul class="visit-list">${visits.map((visit) => `<li>
    <div><time class="mono" datetime="${e(visit.date)}T${e(visit.start)}+07:00">${e(visit.start)}${visit.end ? `–${e(visit.end)}` : ''}</time>
    ${showDate ? `<p class="hint">${dayLabel(calendarDay(visit.date))}</p>` : ''}</div>
    <strong>${e(visit.title)}</strong>
    ${showDate ? '' : `<button class="button subtle" data-visit-action="edit" data-id="${e(visit.id)}" aria-label="แก้ไข ${e(visit.title)}">แก้ไข</button>`}</li>`).join('')}</ul>`;
}

function todayAgenda() {
  const today = labDate();
  const visits = visitList();
  const current = visits.filter((visit) => visit.date === today);
  const next = visits.find((visit) => visit.date > today);
  return `<div class="today-agenda"><div class="agenda-head"><h3>${current.length || !next ? 'แผนเข้าแล็บวันนี้' : 'แผนเข้าแล็บถัดไป'}</h3><a href="#calendar?date=${e(current.length ? today : next?.date ?? today)}">เปิดปฏิทิน</a></div>
    ${current.length ? visitRows(current.slice(0, 3), true) : next ? visitRows([next], true) : '<p class="hint">ยังไม่มีแผนเข้าแล็บ</p>'}</div>`;
}

function calendarPage() {
  const selected = calendarDay(calendarDate);
  const month = calendarDay(`${calendarDate.slice(0, 7)}-01`);
  const offset = (month.getUTCDay() + 6) % 7;
  const today = labDate();
  const visits = visitList();
  const counts = new Map();
  for (const { date } of visits) counts.set(date, (counts.get(date) || 0) + 1);
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(month);
    day.setUTCDate(index - offset + 1);
    const key = dateKey(day);
    const count = counts.get(key) || 0;
    return `<button class="calendar-day ${day.getUTCMonth() === month.getUTCMonth() ? '' : 'outside'}" data-visit-action="day" data-date="${key}"
      aria-label="${labLongDateFormat.format(day)}${count ? ` มีแผน ${count} รายการ` : ''}" ${key === today ? 'aria-current="date"' : ''}
      aria-pressed="${key === calendarDate}" tabindex="${key === calendarDate ? 0 : -1}"><span class="mono">${day.getUTCDate()}</span>${count ? '<span class="day-mark" aria-hidden="true"></span>' : ''}</button>`;
  }).join('');
  const entries = visits.filter((visit) => visit.date === calendarDate);
  return pageHead('ปฏิทินแล็บ', 'เลือกวันและเวลาที่จะเข้าแล็บ · เวลาไทย',
    `<button class="button primary" data-visit-action="new">${icon('add')} เพิ่มแผนเข้าแล็บ</button>`) +
    `<div class="calendar-layout"><section class="panel calendar-panel" aria-label="ปฏิทินรายเดือน">
    <div class="panel-head calendar-head"><h2>${labMonthFormat.format(month)}</h2><div class="actions">
      <button class="button subtle" data-visit-action="prev" aria-label="เดือนก่อน">${icon('back')}</button>
      <button class="button subtle" data-visit-action="today">วันนี้</button>
      <button class="button subtle" data-visit-action="next" aria-label="เดือนถัดไป">${icon('next')}</button>
    </div></div><div class="calendar-grid">${['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map((day) =>
      `<span class="calendar-weekday">${day}</span>`).join('')}${days}</div></section>
    <section class="panel agenda-panel"><div class="panel-head"><div><h2>รายการเข้าแล็บ</h2><p class="hint">${labLongDateFormat.format(selected)}</p></div></div>
    ${entries.length ? visitRows(entries) : '<p class="empty">ยังไม่มีแผนในวันที่เลือก</p>'}</section></div>`;
}

function selectCalendarDate(date, focusDay = false) {
  if (date < '1901-01-01' || date > '9998-12-31') return;
  calendarDate = date;
  if (route().name === 'calendar') history.replaceState(null, '', `#calendar?date=${date}`);
  render();
  if (focusDay) document.querySelector('.calendar-day[aria-pressed="true"]')?.focus();
}

function moveCalendarMonth(step) {
  const month = calendarDay(`${calendarDate.slice(0, 7)}-01`);
  month.setUTCMonth(month.getUTCMonth() + step);
  selectCalendarDate(dateKey(month));
  document.querySelector(`[data-visit-action="${step < 0 ? 'prev' : 'next'}"]`)?.focus();
}

function showVisit(visit) {
  editedVisit = visit ?? null;
  visitForm.reset();
  visitError.hidden = true;
  document.querySelector('#visit-title').textContent = visit ? 'แก้ไขแผนเข้าแล็บ' : 'วางแผนเข้าแล็บ';
  document.querySelector('#delete-visit').hidden = !visit;
  visitForm.elements.date.value = visit?.date ?? calendarDate;
  visitForm.elements.title.value = visit?.title ?? '';
  visitForm.elements.start.value = visit?.start ?? '';
  visitForm.elements.end.value = visit?.end ?? '';
  visitDialog.showModal();
}

async function changeVisit(visit, remove = false) {
  const original = editedVisit;
  let conflict = false;
  const saved = await updateWorkspace((state) => {
    const latest = state.visits ?? [];
    if (original && JSON.stringify(latest.find(({ id }) => id === original.id)) !== JSON.stringify(original)) {
      conflict = true;
      return null;
    }
    const visits = remove ? latest.filter(({ id }) => id !== original.id) : original
      ? latest.map((item) => item.id === original.id ? visit : item) : [...latest, visit];
    return { ...state, visits };
  });
  if (conflict) {
    visitError.textContent = 'รายการนี้เปลี่ยนจากอีกแท็บ ปิดแล้วเปิดแผนใหม่เพื่อดูข้อมูลล่าสุด';
    visitError.hidden = false;
  }
  if (saved) {
    visitDialog.close();
    selectCalendarDate(visit.date, true);
    message(remove ? 'ลบแผนเข้าแล็บแล้ว' : 'บันทึกแผนเข้าแล็บแล้ว', !remove);
  }
}

visitForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(visitForm);
  const title = String(fields.get('title')).trim();
  const date = String(fields.get('date'));
  const start = String(fields.get('start'));
  const end = String(fields.get('end'));
  if (!title || (end && end <= start)) {
    visitError.textContent = !title ? 'กรอกชื่องาน' : 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
    visitError.hidden = false;
    visitForm.elements[!title ? 'title' : 'end'].focus();
    return;
  }
  const submit = visitForm.querySelector('button.primary');
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    await changeVisit({ id: editedVisit?.id ?? crypto.randomUUID(), title, date, start, end });
  } finally {
    submit.disabled = false;
  }
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-visit-action]');
  if (!button) return;
  const { visitAction, date, id } = button.dataset;
  if (visitAction === 'day') selectCalendarDate(date, true);
  if (visitAction === 'prev') moveCalendarMonth(-1);
  if (visitAction === 'next') moveCalendarMonth(1);
  if (visitAction === 'today') selectCalendarDate(labDate(), true);
  if (visitAction === 'new') showVisit();
  if (visitAction === 'edit') {
    const visit = visitList().find((item) => item.id === id);
    if (visit) showVisit(visit);
  }
  if (visitAction === 'close') {
    visitDialog.close();
    if (route().name === 'calendar') selectCalendarDate(calendarDate, true);
  }
  if (visitAction === 'delete' && editedVisit && !visitForm.querySelector('button.primary').disabled &&
    window.confirm('ลบแผนเข้าแล็บนี้หรือไม่')) void changeVisit(editedVisit, true);
});

document.addEventListener('keydown', (event) => {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
  if (!step || !event.target.matches('.calendar-day')) return;
  event.preventDefault();
  const day = calendarDay(event.target.dataset.date);
  day.setUTCDate(day.getUTCDate() + step);
  selectCalendarDate(dateKey(day), true);
});
