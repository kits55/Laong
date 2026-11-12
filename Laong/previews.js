'use strict';

// Isolated design fixtures. These pages never read local experiment records.
const previewUsers = [
  ['สมชาย ใจดี', 'ทีมวิจัย A', 'ผู้คุมเครื่อง', 'ใช้งาน'],
  ['สมศรี รักงาน', 'ทีมวิจัย A', 'หัวหน้าทีม', 'ใช้งาน'],
  ['วิชัย ศรีสุข', 'ทุกทีม', 'ผู้บริหาร', 'ใช้งาน'],
  ['อรอุมา แก้วใส', 'ยังไม่เข้าทีม', 'รอยืนยัน', 'รออนุมัติ'],
];
const previewAudit = [
  ['09:42', 'หัวหน้าทีม A', 'ปิดรัน', 'R-017'],
  ['09:10', 'ผู้ดูแลระบบ', 'เปลี่ยนบทบาท', 'บัญชีตัวอย่าง'],
  ['08:55', 'ผู้คุมเครื่อง', 'สร้างรัน', 'R-018'],
  ['08:31', 'ผู้ดูแลระบบ', 'ลงทะเบียนเครื่อง', 'SD-05'],
];
const previewSummary = [
  { id: 'R-017', days: 2, yield: 47, moisture: 3.9 },
  { id: 'R-016', days: 5, yield: 44, moisture: 4.3 },
  { id: 'R-015', days: 9, yield: 48, moisture: 3.8 },
  { id: 'R-014', days: 16, yield: 46, moisture: 4.0 },
  { id: 'R-013', days: 25, yield: 43, moisture: 4.1 },
  { id: 'R-012', days: 41, yield: 45, moisture: 4.4 },
];
let executivePeriod = 30;

const operatorPages = [
  ['today', 'today', 'วันนี้'], ['calendar', 'today', 'ปฏิทินแล็บ'], ['runs', 'run', 'การทดลอง'], ['machines', 'machine', 'เครื่อง'],
  ['history', 'history', 'ประวัติ'], ['templates', 'lab', 'แบบฟอร์ม'],
  ['notifications', 'bell', 'แจ้งเตือน'], ['settings', 'settings', 'ตั้งค่า'],
];
const adminPages = [
  ['admin', 'today', 'ภาพรวมระบบ'], ['admin-users', 'user', 'ผู้ใช้และทีม'], ['admin-machines', 'machine', 'เครื่อง'],
  ['admin-audit', 'history', 'บันทึกการใช้งาน'], ['admin-formula', 'lock', 'สูตรและงานวิจัย'],
];
const executivePages = [['executive', 'today', 'สรุปภาพรวม'], ['executive-reports', 'export', 'รายงาน']];
const pageKeys = [...operatorPages, ...adminPages, ...executivePages].map(([key]) => key);

function previewTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((label) => `<th scope="col">${label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function previewStats(values) {
  return `<div class="preview-stats">${values.map(([label, value, source]) =>
    `<article class="panel panel-pad"><h2>${label}</h2><strong class="mono">${value}</strong><span class="source">${source || 'Assumed'}</span></article>`).join('')}</div>`;
}

function adminPage(name) {
  const note = 'พรีวิว Admin · ข้อมูลสังเคราะห์';
  if (name === 'admin-users') {
    return pageHead('ผู้ใช้และทีม', note) + `<section class="panel"><div class="filters"><label>ค้นหาผู้ใช้<input id="preview-users" type="search" placeholder="ชื่อ ทีม หรือบทบาท"></label></div>
      ${previewTable(['ชื่อ', 'ทีม', 'บทบาท', 'สถานะ'], previewUsers)}<p class="empty" id="preview-users-empty" hidden>ไม่พบผู้ใช้ในข้อมูลตัวอย่าง</p></section>`;
  }
  if (name === 'admin-machines') {
    return pageHead('เครื่องและ Machine ID', note) + `<div class="dashboard"><section class="panel"><div class="panel-head"><h2>เครื่องในทะเบียนตัวอย่าง</h2></div>
      ${previewTable(['Machine ID', 'ห้อง', 'ทีม', 'สถานะ'], [['SD-01', 'ห้องแล็บ 1', 'ทีมวิจัย A', 'กำลังรัน'], ['SD-02', 'ห้องแล็บ 1', 'ทีมวิจัย B', 'พร้อม'], ['SD-03', 'ห้องแล็บ 2', 'ทีมวิจัย A', 'รอซ่อม']])}</section>
      <section class="panel panel-pad aside-body"><h2>สติกเกอร์เครื่อง</h2>${machineSticker('SD-06')}</section></div>`;
  }
  if (name === 'admin-audit') {
    return pageHead('บันทึกการใช้งาน', note) + `<section class="panel"><div class="panel-head"><p>แสดงผู้กระทำและรายการที่เกี่ยวข้อง</p></div>
      ${previewTable(['เวลา', 'ใคร', 'ทำอะไร', 'กับอะไร'], previewAudit)}</section>`;
  }
  if (name === 'admin-formula') {
    return pageHead('สูตรและงานวิจัย', note) + `<section class="panel"><div class="panel-head"><div><h2>สูตรคำนวณที่ล็อกไว้</h2><p class="muted">อ่านเวอร์ชันและสถานะการยืนยัน</p></div>${icon('lock')}</div>
      ${previewTable(['เวอร์ชัน', 'การตรวจสอบ', 'SHA-256'], [[`<span class="mono">${modelVersion}</span>`, 'รอไฟล์โมเดล', 'รอยืนยัน']])}</section>`;
  }
  return pageHead('ภาพรวมระบบ', note) +
    previewStats([['ผู้ใช้ทั้งหมด', previewUsers.length], ['รออนุมัติเข้าทีม', '1'], ['เครื่องที่พร้อมใช้', '2']]) +
    `<section class="panel"><div class="panel-head"><h2>กิจกรรมล่าสุด</h2><a class="button" href="#admin-audit">เปิดบันทึก</a></div>
    ${previewTable(['เวลา', 'ใคร', 'ทำอะไร', 'กับอะไร'], previewAudit)}</section>`;
}

function executiveRows() {
  return previewSummary.filter(({ days }) => days <= executivePeriod);
}

function yieldChart(rows) {
  const width = 560;
  const values = [...rows].reverse();
  const points = values.map(({ yield: output }, index) => [40 + index * 480 / (values.length - 1), 32 + (50 - output) * 13]);
  return `<section class="panel panel-pad yield-chart"><h2>ผลผลิตของรันที่ปิดแล้ว</h2><p class="hint">ข้อมูลตัวอย่าง · ผลผลิต (%)</p>
    <svg viewBox="0 0 ${width} 190" role="img" aria-label="แนวโน้มผลผลิตของรันตัวอย่าง ค่าของแต่ละรันอยู่ในตารางถัดไป">
    ${[40, 45, 50].map((value) => {
      const y = 32 + (50 - value) * 13;
      return `<line x1="40" y1="${y}" x2="520" y2="${y}"/><text x="6" y="${y + 4}">${value}</text>`;
    }).join('')}
    <polyline points="${points.map((point) => point.join(',')).join(' ')}"/>
    ${points.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="4"/><text text-anchor="middle" x="${x}" y="182">${values[index].id}</text>`).join('')}</svg></section>`;
}

function executivePage(reports) {
  const rows = executiveRows();
  const mean = (key) => (rows.reduce((sum, row) => sum + row[key], 0) / rows.length).toFixed(1);
  const period = `<div class="actions period" aria-label="ช่วงเวลา">${[7, 30, 90].map((days) =>
    `<button class="button ${days === executivePeriod ? 'selected' : ''}" aria-pressed="${days === executivePeriod}" data-action="executive-period" data-days="${days}">${days} วัน</button>`).join('')}</div>`;
  return pageHead(reports ? 'รายงานสรุป' : 'สรุปภาพรวม', 'พรีวิวผู้บริหาร · สรุปจากข้อมูลสังเคราะห์', period) +
    (reports ? '' : previewStats([['รันที่ปิดแล้ว', rows.length], ['กำลังรันตอนนี้', '2 / 4'], ['ผลผลิตเฉลี่ย', mean('yield') + '%'], ['ความชื้นเฉลี่ย', mean('moisture') + '%']]) + yieldChart(rows)) +
    `<section class="panel"><div class="panel-head"><div><h2>รันที่ปิดแล้ว</h2><p class="muted">ข้อมูลสรุปย้อนหลัง ${executivePeriod} วัน</p></div><button class="button" data-action="summary-export">${icon('export')} ส่งออกสรุป CSV</button></div>
    ${previewTable(['รัน', 'ปิดเมื่อ', 'ผลผลิต', 'ความชื้น', 'ที่มา'], rows.map(({ id, days, yield: output, moisture }) => [
      `<span class="mono">${id}</span>`, `${days} วันก่อน`, `${output.toFixed(1)}%`, `${moisture.toFixed(1)}%`, 'Assumed',
    ]))}</section>`;
}

function exportSummary() {
  const csv = '\uFEFFรัน,ปิดเมื่อ (วันก่อน),ผลผลิต (%),ความชื้น (%),ที่มา\r\n' +
    executiveRows().map(({ id, days, yield: output, moisture }) => `${id},${days},${output},${moisture},Assumed`).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `Laong-summary-demo-${executivePeriod}d.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
