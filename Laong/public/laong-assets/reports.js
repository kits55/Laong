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
    return [
      ['รายละเอียดรัน', metadata], ['ก่อนทดลอง', before],
      ['ระหว่างทดลอง', run.logs.length ? readings : [['ยังไม่มีบันทึกระหว่างทดลอง']]],
      ['หลังทดลอง', after],
    ];
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
