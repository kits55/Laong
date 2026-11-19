'use strict';

window.LaongReports = (() => {
  const utf8 = new TextEncoder();
  const wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relationNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageNs = 'http://schemas.openxmlformats.org/package/2006';
  const types = 'application/vnd.openxmlformats-officedocument';
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const missing = 'ยังไม่มีค่า';

  function xml(value) {
    return String(value ?? '').replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '').replace(/[&<>"']/g, (key) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[key]);
  }

  function crc32(data) {
    let crc = 0xffffffff;
    for (const value of data) {
      crc ^= value;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zip(files, mime) {
    const content = [];
    const index = [];
    let offset = 0;
    for (const [path, source] of Object.entries(files)) {
      const name = utf8.encode(path);
      const data = utf8.encode(xmlHeader + source);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      content.push(local.buffer, name, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, data.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, name.length, true);
      central.setUint32(42, offset, true);
      index.push(central.buffer, name);
      offset += local.byteLength + name.length + data.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, index.length / 2, true);
    end.setUint16(10, index.length / 2, true);
    end.setUint32(12, index.reduce((length, item) => length + item.byteLength, 0), true);
    end.setUint32(16, offset, true);
    return new Blob([...content, ...index, end.buffer], { type: mime });
  }

  function relationships(items) {
    return `<Relationships xmlns="${packageNs}/relationships">${items.map(([id, type, target]) =>
      `<Relationship Id="${id}" Type="${relationNs}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
  }

  function contentTypes(items) {
    return `<Types xmlns="${packageNs}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${items.map(([path, type]) =>
      `<Override PartName="/${path}" ContentType="${types}.${type}"/>`).join('')}</Types>`;
  }

  function reportData(run, template, status, timeLabel, fieldSource) {
    const keyValues = (fields, values, stage) => fields.map(([key, label, type]) =>
      [label, values[key] ?? missing, fieldSource(run, stage, type, values[key])]);
    const metadata = [
      ['รหัสรัน', run.id], ['ชื่อการทดลอง', run.title], ['Template', template.name],
      ['สถานะ', status], ['สร้างเมื่อ', timeLabel(run.createdAt)], ['ข้อมูล', run.demo ? 'ข้อมูลตัวอย่าง' : 'บันทึกการทดลอง'],
    ];
    const before = keyValues(template.before, run.before, 'before');
    const readings = [[...template.during.map(([, label]) => label), 'ที่มาของข้อมูล'], ...run.logs.map((log) =>
      [...template.during.map(([key]) => log.data[key] ?? missing), template.during.map(([key, , type]) =>
        fieldSource(run, 'during', type, log.data[key])).join(' / ')])];
    readings[0].unshift('เวลาบันทึก');
    run.logs.forEach((log, i) => readings[i + 1].unshift(timeLabel(log.time)));
    const after = keyValues(template.after, run.after, 'after');
    const sections = [
      ['รายละเอียดรัน', metadata], ['ก่อนทดลอง', before],
      ['ระหว่างทดลอง', run.logs.length ? readings : [['ยังไม่มีบันทึกระหว่างทดลอง']]],
      ['หลังทดลอง', after],
    ];
    const prediction = predictionRows(run, timeLabel);
    if (prediction) sections.splice(2, 0, ['คำทำนาย Tout', prediction]);
    const eventLabels = globalThis.LaongRunChart?.EVENT_LABEL || {};
    const events = (Array.isArray(run.events) ? run.events : []).filter(x => eventLabels[x?.type]);
    if (events.length) sections.splice(sections.findIndex(([title]) => title === 'หลังทดลอง'), 0, ['เหตุการณ์ที่ผู้ใช้แตะบันทึกระหว่างทดลอง', [['เวลา', 'เหตุการณ์'], ...events.map(x => [timeLabel(x.time), eventLabels[x.type]])]]);
    const clock = clockRows(run, timeLabel);
    if (clock) sections.splice(sections.findIndex(([title]) => title === 'ระหว่างทดลอง'), 0, ['นาฬิการัน', clock]);
    return sections;
  }

  /* สรุปนาฬิกาคำนวณด้วยแกนเดิม (run-capture.js) เท่านั้น ถ้าไม่มีแกนหรือไม่เคยเริ่ม → ไม่ใส่หัวข้อ */
  function clockRows(run, timeLabel) {
    const capture = typeof RUN_CAPTURE === 'undefined' ? null : RUN_CAPTURE;
    const resets = Array.isArray(run.clockResets) ? run.clockResets : [];
    if (!capture || (!run.feedClock && !resets.length)) return null;
    const s = capture.snapshot(capture.normalize(run.feedClock), Date.now());
    if (s.status === 'idle' && !resets.length) return null;
    const min = v => (Number.isFinite(v) ? v : missing);
    const labels = { idle: 'ยังไม่เริ่ม', warmup: 'Warm-up', feeding: 'กำลังป้อน', paused: 'พัก', post_feed: 'หลังป้อน', stopped: 'จบแล้ว' };
    const resetRows = resets.length ? [['ล้างนาฬิกาแล้ว (TEST)', `${resets.length} ครั้ง · นาฬิกาเดิมเก็บเป็นประวัติ`],
      ['ประวัติการล้าง', resets.map(r => `${timeLabel(r.resetAt)} · ${r.reason} · ก่อนล้าง: ${labels[r.summary?.status] || r.summary?.status || 'ไม่มีค่า'}, ป้อนสุทธิ ${r.summary?.activeFeeding_min ?? missing} นาที`).join('\n')]] : [];
    return [...resetRows,
      ['สถานะนาฬิกา', labels[s.status] || s.status],
      ['ที่มา', `${s.provenance} · นาฬิกาเดิม (run-capture.js) ${run.demo ? '· ข้อมูลจำลอง' : ''}`],
      ['เวลารันทั้งหมด (นาที)', min(s.runElapsed_min)],
      ['Warm-up (นาที)', min(s.warmupElapsed_min)],
      ['ป้อนสุทธิ (นาที)', min(s.activeFeeding_min)],
      ['พักรวม (นาที)', min(s.interruptionTotal_min)],
      ['หลังป้อน (นาที)', min(s.postFeedObservation_min)],
      ['ป้อนครบตามนาฬิกา', s.activeFeedingComplete ? 'ใช่' : 'ยังไม่ครบ / ไม่ทราบ'],
      ['ลำดับที่กด', s.transitions.map(x => `${timeLabel(x.at)} ${x.action}`).join('\n') || missing],
      ['ข้อจำกัด', 'ยังไม่มี Segment, ชนิด/ระดับเหตุการณ์พัก และการผูกเวลากับค่าที่จด แบบระบบเดิม'],
    ];
  }

  /* คำทำนายเป็น "คำทำนาย" เสมอ — รายงานต้องไม่ทำให้อ่านเป็นค่าวัด */
  function predictionRows(run, timeLabel) {
    const list = Array.isArray(run.predictions) ? run.predictions.filter(p => p?.label === 'predicted' && Number.isFinite(p?.result?.tout_C)) : [];
    if (!list.length) return null;
    const p = list[list.length - 1];
    const inp = p.inputs || {}, prof = p.profile || {}, prov = prof.provenance || {};
    const materialKnown = inp.materialSource === 'operator_selected_unverified' && globalThis.LAONG_PREDICTION?.isSupportedMaterial?.(inp.materialId) === true;
    const reading = [...(run.logs || [])].reverse().find(log => Number.isFinite(Number(log?.data?.tout)) && log.data.tout !== '' && log.data.tout != null);
    const measured = reading ? Number(reading.data.tout) : null;
    const rows = [
      ['Tout ทำนาย (°C)', p.result.tout_C],
      ['ประเภทค่า', 'คำทำนายจากโมเดล ไม่ใช่ค่าที่วัด'],
      ['ทำนายเมื่อ', timeLabel(p.createdAt)],
      ['โปรไฟล์เครื่อง', `${prof.label ?? missing} · ${prof.classification === 'PUBLIC_SYNTHETIC' ? 'ข้อมูลสาธิต (สมมติ)' : 'ค่าคาลิเบรตเครื่องจริง · ข้อมูลภายในทีม'}`],
      ['ลมอบแห้ง (m³/h)', `${prof.airflow_m3h ?? missing} · ${prov.airflow ?? missing}`],
      ['UA (kJ/(h·K))', `${prof.ua_kJhK ?? missing} · ${prov.ua ?? missing}`],
      ['ข้อจำกัดของโปรไฟล์', prov.summary ?? missing],
      ['Air-in (%)', inp.airInPct ?? missing],
      ['วัตถุดิบที่เลือกสำหรับคำทำนาย', inp.materialLabel ? `${inp.materialLabel} · ผู้ใช้เลือก ยังไม่ยืนยัน` : 'ไม่ระบุ / ข้อมูลเดิม'],
      ...(!materialKnown ? [['ข้อจำกัดวัตถุดิบ', 'คำทำนายเดิมไม่มีหลักฐานชนิดวัตถุดิบที่รองรับ · ยังตรวจความเหมาะสมไม่ได้ อย่าใช้เป็นผลยืนยัน']] : []),
      ['Tin (°C)', inp.tin_C ?? missing],
      ['อัตราป้อน (mL/min)', `${inp.feed_mLmin ?? missing} · ${inp.feedSource === 'measured' ? (run.demo ? 'ผู้ใช้ระบุว่าวัด · TEST' : 'ผู้ใช้ระบุว่าวัด') : 'proxy จากค่าตั้งปั๊ม'}`],
      ...(inp.feedEntry && inp.feedEntry.mode === 'pump_pct' ? [['ค่าปั๊มที่กรอก (%)', `${inp.feedEntry.entered}% → ${inp.feedEntry.converted_mLmin} mL/min · แปลงด้วย 100% = ${inp.feedEntry.pumpFullScale_mLmin} mL/min (การสอบเทียบน้ำ) · proxy ไม่ใช่อัตราป้อนจริงของสาร${inp.feedEntry.withinCalibratedRange === false ? ` · สูงกว่าจุดที่สอบเทียบปั๊ม (${inp.feedEntry.pumpCalibratedAtPct}%)` : ''}`]] : []),
      ['ของแข็ง (%)', `${inp.solidsPct ?? missing} · ${inp.solidsSource === 'brix_proxy' ? '°Brix proxy ไม่ใช่ Total Solids' : 'Total Solids ที่กรอก'}`],
      ['อุณหภูมิสารป้อน (°C)', `${inp.tfeed_C ?? missing}${inp.tfeedSource === 'model_default' ? ' · สมมติ (ค่าเริ่มต้นโมเดล)' : ''}`],
      ['สมการ', `${p.model?.fn ?? missing} · SHA-256 ${String(p.model?.sha256 ?? '').slice(0, 12)}…`],
      ['คำเตือน', (p.warnings || []).length ? p.warnings.join('\n') : 'ไม่มีค่า'],
    ];
    if (measured != null) {
      rows.push(['Tout ที่จดล่าสุด (°C)', measured]);
      rows.push(['ส่วนต่าง จด − ทำนาย (°C)', Math.round((measured - p.result.tout_C) * 10) / 10]);
      rows.push(['หมายเหตุส่วนต่าง', 'ค่าที่จดล่าสุดค่าเดียว ยังไม่ใช่ steady state ที่ยืนยัน ต้องดูหลายค่าติดกันก่อนสรุป']);
    }
    if (list.length > 1) {
      rows.push(['คำทำนายก่อนหน้า', list.slice(0, -1).map(x => `${timeLabel(x.createdAt)}: ${x.result.tout_C} °C (${x.profile?.label ?? 'ไม่มีค่า'})`).join('\n')]);
    }
    return rows;
  }

  function word(sections) {
    function paragraph(value, heading = false) {
      const formatting = heading ? '<w:b/><w:bCs/><w:sz w:val="30"/><w:szCs w:val="30"/>' : '';
      const lines = String(value).split(/\r?\n/);
      return `<w:p><w:r><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/>${formatting}</w:rPr>${lines.map((line) =>
        `<w:t xml:space="preserve">${xml(line)}</w:t>`).join('<w:br/>')}</w:r></w:p>`;
    }
    const contents = paragraph('รายงานการทดลอง Laong', true) + sections.map(([title, rows]) =>
      paragraph(title, true) + rows.map((row) => paragraph(row.join('  |  '))).join('')).join('');
    return zip({
      '[Content_Types].xml': contentTypes([['word/document.xml', 'wordprocessingml.document.main+xml']]),
      '_rels/.rels': relationships([['rId1', 'officeDocument', 'word/document.xml']]),
      'word/document.xml': `<w:document xmlns:w="${wordNs}"><w:body>${contents}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="907" w:right="907" w:bottom="907" w:left="907"/></w:sectPr></w:body></w:document>`,
    }, `${types}.wordprocessingml.document`);
  }

  function workbook(sections) {
    const paths = sections.map((_, i) => `xl/worksheets/sheet${i + 1}.xml`);
    const sheetFiles = Object.fromEntries(sections.map(([, rows], i) => {
      const grid = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => {
        const address = `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`;
        return typeof value === 'number' ? `<c r="${address}"><v>${value}</v></c>` :
          `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join('')}</row>`).join('');
      return [paths[i], `<worksheet xmlns="${sheetNs}"><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="8" width="28" customWidth="1"/></cols><sheetData>${grid}</sheetData></worksheet>`];
    }));
    return zip({
      '[Content_Types].xml': contentTypes([['xl/workbook.xml', 'spreadsheetml.sheet.main+xml'], ...paths.map((path) => [path, 'spreadsheetml.worksheet+xml'])]),
      '_rels/.rels': relationships([['rId1', 'officeDocument', 'xl/workbook.xml']]),
      'xl/_rels/workbook.xml.rels': relationships(paths.map((path, i) => [`rId${i + 1}`, 'worksheet', path.slice(3)])),
      'xl/workbook.xml': `<workbook xmlns="${sheetNs}" xmlns:r="${relationNs}"><sheets>${sections.map(([title], i) =>
        `<sheet name="${xml(title)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
      ...sheetFiles,
    }, `${types}.spreadsheetml.sheet`);
  }

  function download(blob, name) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function print(sections) {
    const report = document.querySelector('#print-report');
    report.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = 'รายงานการทดลอง Laong';
    report.append(heading);
    for (const [title, rows] of sections) {
      const label = document.createElement('h2');
      label.textContent = title;
      const table = document.createElement('table');
      rows.forEach((row, index) => {
        const tr = table.insertRow();
        row.forEach((value, column) => {
          const header = title === 'ระหว่างทดลอง' ? index === 0 && row.length > 1 : column === 0;
          const cell = document.createElement(header ? 'th' : 'td');
          if (header) cell.scope = title === 'ระหว่างทดลอง' ? 'col' : 'row';
          cell.textContent = value;
          tr.append(cell);
        });
      });
      report.append(label, table);
    }
    window.print();
  }

  function exportRun(format, run, template, status, timeLabel, fieldSource) {
    const sections = reportData(run, template, status, timeLabel, fieldSource);
    if (format === 'PDF') print(sections);
    if (format === 'Word') download(word(sections), `Laong-${run.id}.docx`);
    if (format === 'Excel') download(workbook(sections), `Laong-${run.id}.xlsx`);
  }

  return { exportRun };
})();
