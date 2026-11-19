'use strict';

// Isolated design fixtures. These pages never read local experiment records.
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
  ['today', 'today', 'วันนี้'], ['calendar', 'today', 'ปฏิทิน (ทดลอง)'], ['runs', 'run', 'การทดลอง'], ['machines', 'machine', 'เครื่อง'],
  ['history', 'history', 'ประวัติ'], ['insights', 'history', 'ข้อมูลย้อนหลัง'], ['templates', 'lab', 'แบบฟอร์ม'],
  ['monitor', 'machine', 'ติดตามเครื่อง'], ['notifications', 'bell', 'แจ้งเตือน'], ['settings', 'settings', 'ตั้งค่า'],
];
const adminPages = [
  ['admin', 'today', 'ภาพรวม Admin'], ['admin-users', 'user', 'ผู้ใช้'], ['admin-machines', 'machine', 'ทะเบียนเครื่ององค์กร'],
  ['admin-monitor', 'settings', 'การเชื่อมต่อเครื่อง'], ['admin-audit', 'history', 'ประวัติการจัดการ'], ['admin-formula', 'lock', 'คลังสูตรและเอกสาร'],
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
  return pageHead(reports ? 'รายงานผู้บริหาร' : 'ภาพรวมผู้บริหาร', 'ข้อมูลจำลอง · สรุปรันและผลวิเคราะห์ตามช่วงเวลา', period) +
    (reports ? '' : previewStats([['รันที่ปิดแล้ว', rows.length], ['กำลังรันตอนนี้', `${experiments.filter((run) => run.status === 'running').length} / ${labWorkspace.machines.length}`], ['ผลผลิตเฉลี่ย', mean('yield') + '%'], ['ความชื้นเฉลี่ย', mean('moisture') + '%']]) + yieldChart(rows)) +
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
