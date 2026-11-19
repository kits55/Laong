// ส่งออกไฟล์ (CSV, JSON, Word) กติกาสำคัญ: ค่าว่าง (null) ต้องออกมาเป็นช่องว่าง ห้ามเป็น 0
import { zipSync, strToU8 } from 'fflate';
import type { Num } from '../core/types';
import type { RunRecord } from '../data/types';
import { predictionError, STATUS_LABEL } from './runs';
import { fmtDateTime } from './util';
import { MODEL_VERSION } from '../core/adapter';
import { KIND_INFO } from '../core/types';

export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const n = (v: Num) => (v === null ? null : Math.round(v * 1000) / 1000);

/** สรุปรันเดียวแบบแนวตั้ง: ตัวแปร, ค่า, หน่วย, ที่มา ช่องที่ไม่มีค่าเว้นว่าง */
export function runSummaryCsv(r: RunRecord): string {
  const err = predictionError(r);
  const rows: (string | number | null)[][] = [
    ['รัน', r.id, '', ''],
    ['ข้อมูลตัวอย่าง', r.sample ? 'ใช่' : 'ไม่ใช่', '', ''],
    ['วันที่', r.dateISO, '', ''],
    ['วัสดุ', r.materialName, '', ''],
    ['สถานะ', STATUS_LABEL[r.status], '', ''],
    ['ตัวแปร', 'ค่า', 'หน่วย', 'ที่มา'],
    ['Tin ที่ตั้ง', n(r.inputs.tin), '°C', KIND_INFO.assumed.word],
    ['อัตราป้อน', n(r.inputs.feedMlMin), 'mL/min', KIND_INFO[r.inputs.feedKind].word],
    ['TS', r.inputs.solidsFrac === null ? null : n(r.inputs.solidsFrac * 100), '%', KIND_INFO[r.inputs.solidsKind].word],
    ['อัตราลมของโปรไฟล์', n(r.inputs.airFlow), 'm3/h', KIND_INFO.assumed.word],
    ['Tout ที่ทำนาย (โมเดล eta)', n(r.predicted.eta), '°C', KIND_INFO.predicted.word],
    ['Tout ที่ทำนาย (โมเดล UA)', n(r.predicted.ua), '°C', KIND_INFO.predicted.word],
    ['สถานะการตรวจโมเดล', 'UNVALIDATED', '', ''],
    ['Tout ที่อ่านได้ (เฉลี่ยช่วงนิ่ง)', n(r.measuredTout), '°C', KIND_INFO.observed.word],
    ['predictionError', n(err), '°C', KIND_INFO.calculated.word],
    ['ความชื้น', n(r.lab.moisture), '%', KIND_INFO.measured.word],
    ['โปรตีน', n(r.lab.protein), '%', KIND_INFO.measured.word],
    ['aw', n(r.lab.aw), '', KIND_INFO.measured.word],
    ['การละลาย', n(r.lab.solubility), '%', KIND_INFO.measured.word],
    ['สี L*', n(r.lab.L), '', KIND_INFO.measured.word],
    ['สี a*', n(r.lab.a), '', KIND_INFO.measured.word],
    ['สี b*', n(r.lab.b), '', KIND_INFO.measured.word],
    ['มวลสารป้อนทั้งหมด', n(r.massBalance.feedMassG), 'g', KIND_INFO.measured.word],
    ['มวลผงที่เก็บได้', n(r.massBalance.powderG), 'g', KIND_INFO.measured.word],
    ['โมเดล', MODEL_VERSION, '', ''],
  ];
  return toCsv(rows);
}

export function pointsCsv(r: RunRecord): string {
  const rows: (string | number | null)[][] = [['นาที', 'Tin (°C)', 'Tout (°C)', 'Pump (%)', 'วิธีจด', 'ที่มา Tin และ Tout']];
  [...r.points].sort((a, b) => a.tMin - b.tMin).forEach((p) =>
    rows.push([p.tMin, p.tin, p.tout, p.pump, p.how === 'live' ? 'จดสด' : p.how === 'retro' ? 'กรอกย้อนหลัง' : 'ช่วงนิ่ง 3 ค่า', KIND_INFO.observed.word]));
  return toCsv(rows);
}

export function allRunsCsv(runs: RunRecord[]): string {
  const rows: (string | number | null)[][] = [[
    'รัน', 'ข้อมูลตัวอย่าง', 'วันที่', 'วัสดุ', 'สถานะ', 'Tin (°C)', 'อัตราป้อน (mL/min)', 'TS (%)',
    'Tout ทำนาย eta (°C)', 'Tout อ่านได้ (°C)', 'predictionError (°C)', 'ความชื้น (%)', 'โปรตีน (%)', 'aw', 'การละลาย (%)',
  ]];
  runs.forEach((r) => rows.push([
    r.id, r.sample ? 'ใช่' : 'ไม่ใช่', r.dateISO, r.materialName, STATUS_LABEL[r.status], n(r.inputs.tin), n(r.inputs.feedMlMin),
    r.inputs.solidsFrac === null ? null : n(r.inputs.solidsFrac * 100), n(r.predicted.eta), n(r.measuredTout), n(predictionError(r)),
    n(r.lab.moisture), n(r.lab.protein), n(r.lab.aw), n(r.lab.solubility),
  ]));
  return toCsv(rows);
}

export function download(filename: string, data: Blob | string, type = 'text/plain;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Word (.docx) ขั้นต่ำ: ไม่ใช้ไลบรารี Word เพื่อให้ไฟล์เล็กและตรวจง่าย ---------- */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (t: string, o: { b?: boolean; sz?: number } = {}) =>
  `<w:r><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/>${o.b ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${o.sz ?? 22}"/><w:szCs w:val="${o.sz ?? 22}"/><w:lang w:val="th-TH" w:bidi="th-TH"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const para = (t: string, o: { b?: boolean; sz?: number } = {}) => `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${run(t, o)}</w:p>`;
const cell = (t: string, w: number, head = false) =>
  `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E9E8E1"/>' : ''}</w:tcPr>${para(t, { b: head, sz: 20 })}</w:tc>`;
function table(rows: string[][], widths: number[]) {
  const b = (s: string) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b).join('')}</w:tblBorders></w:tblPr>` +
    rows.map((r, i) => `<w:tr>${r.map((c, j) => cell(c, widths[j] ?? 2000, i === 0)).join('')}</w:tr>`).join('') + '</w:tbl>' + para('');
}

const show = (v: Num, d = 1) => (v === null ? 'ยังไม่มีค่า' : v.toFixed(d));

export function runDocx(r: RunRecord): Uint8Array {
  const err = predictionError(r);
  const body = [
    para(`รายงานรัน ${r.id}`, { b: true, sz: 36 }),
    r.sample ? para('ข้อมูลตัวอย่าง: ตัวเลขทั้งหมดเป็นค่าสมมติ ใช้ดูรูปแบบรายงานเท่านั้น', { b: true }) : '',
    para(`วันที่ ${fmtDateTime(r.dateISO)}   วัสดุ ${r.materialName}   สถานะ ${STATUS_LABEL[r.status]}`),
    para('1. แผนการทดลอง', { b: true, sz: 26 }),
    table([
      ['รายการ', 'ค่า', 'หน่วย', 'ที่มา'],
      ['Tin ที่ตั้ง', show(r.inputs.tin), '°C', 'Assumed'],
      ['อัตราป้อน', show(r.inputs.feedMlMin), 'mL/min', KIND_INFO[r.inputs.feedKind].word],
      ['TS', r.inputs.solidsFrac === null ? 'ยังไม่มีค่า' : (r.inputs.solidsFrac * 100).toFixed(1), '%', KIND_INFO[r.inputs.solidsKind].word],
    ], [3400, 2000, 1400, 2200]),
    para('2. ผลทำนายและค่าที่อ่านได้', { b: true, sz: 26 }),
    table([
      ['รายการ', 'ค่า', 'หน่วย', 'ที่มา'],
      ['Tout ทำนาย (eta)', show(r.predicted.eta), '°C', 'Predicted'],
      ['Tout ทำนาย (UA)', show(r.predicted.ua), '°C', 'Predicted'],
      ['Tout ที่อ่านได้ (เฉลี่ยช่วงนิ่ง)', show(r.measuredTout), '°C', 'Observed'],
      ['predictionError', err === null ? 'ยังไม่มีค่า' : err.toFixed(1), '°C', 'Calculated'],
    ], [3400, 2000, 1400, 2200]),
    para('ผลทำนายอยู่ในสถานะ UNVALIDATED ห้ามใช้ตัดสินใจหน้างานโดยไม่ตรวจกับค่าที่อ่านได้'),
    para('3. ผลแล็บ', { b: true, sz: 26 }),
    table([
      ['รายการ', 'ค่า', 'หน่วย', 'ที่มา'],
      ['ความชื้น', show(r.lab.moisture), '%', 'Measured'],
      ['โปรตีน', show(r.lab.protein), '%', 'Measured'],
      ['aw', show(r.lab.aw, 2), '', 'Measured'],
      ['การละลาย', show(r.lab.solubility), '%', 'Measured'],
      ['สี L*, a*, b*', `${show(r.lab.L)}, ${show(r.lab.a)}, ${show(r.lab.b)}`, '', 'Measured'],
    ], [3400, 2000, 1400, 2200]),
    para('4. การตรวจสอบโมเดล', { b: true, sz: 26 }),
    para(`โมเดล ${MODEL_VERSION} สถานะ UNVALIDATED ผลทำนายใช้ค่าโปรไฟล์เครื่องตัวอย่าง ไม่ใช่ค่าคาลิเบรตจริง`),
  ].join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(doc),
  };
  return zipSync(files);
}

export function exportRunDocx(r: RunRecord) {
  const bytes = runDocx(r);
  download(`รายงาน-${r.id}.docx`, new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
}
