/* Laong — กราฟค่าที่จดของรันนี้ + เหตุการณ์ที่แตะบันทึก
 * ไม่มีช่องกรอกเพิ่ม: ใช้ค่าที่ผู้ใช้จดอยู่แล้ว (Tin/Tout) และเส้นคำทำนายที่บันทึกไว้ ส่วนเหตุการณ์เป็นปุ่มแตะไม่บังคับ
 * ไฟล์นี้ไม่แตะ DOM/ที่เก็บข้อมูล (วาดเป็นสตริง SVG) จึงทดสอบนอกเบราว์เซอร์ได้ */
'use strict';
(() => {
  /* ชนิดเหตุการณ์: คีย์ตรงกับป้ายในหน้าข้อมูลย้อนหลัง (laong-insights.js) เพื่อเทียบกันได้ */
  const EVENT_TYPES = Object.freeze([
    { type: 'feed_interruption', label: 'ป้อนสะดุด' },
    { type: 'nozzle_clog', label: 'หัวฉีดตัน' },
    { type: 'spray_degraded', label: 'พ่นเป็นสาย' },
    { type: 'wall_deposit', label: 'ติดผนัง' },
    { type: 'burn_signal', label: 'สัญญาณไหม้' },
  ]);
  const EVENT_LABEL = Object.freeze(Object.fromEntries(EVENT_TYPES.map(x => [x.type, x.label])));
  const MAX_EVENTS = 200;

  const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ms = iso => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };

  /* จุดข้อมูลจากค่าที่จด: นาทีนับจากรายการแรก (ของค่าที่จดหรือเหตุการณ์ แล้วแต่อันไหนก่อน) */
  function points(run) {
    const logs = (Array.isArray(run?.logs) ? run.logs : []).map(l => ({ at: ms(l?.time), tin: num(l?.data?.tin), tout: num(l?.data?.tout) })).filter(p => p.at !== null);
    const events = (Array.isArray(run?.events) ? run.events : []).map(e => ({ at: ms(e?.time), type: e?.type })).filter(e => e.at !== null && EVENT_LABEL[e.type]);
    const starts = [...logs.map(p => p.at), ...events.map(e => e.at)];
    if (!starts.length) return { t0: null, tin: [], tout: [], events: [] };
    const t0 = Math.min(...starts), minute = at => Math.round((at - t0) / 600) / 100;   // นาที ทศนิยม 2 ตำแหน่ง
    return {
      t0,
      tin: logs.filter(p => p.tin !== null).map(p => ({ t: minute(p.at), v: p.tin })).sort((a, b) => a.t - b.t),
      tout: logs.filter(p => p.tout !== null).map(p => ({ t: minute(p.at), v: p.tout })).sort((a, b) => a.t - b.t),
      events: events.map(e => ({ t: minute(e.at), type: e.type, label: EVENT_LABEL[e.type] })).sort((a, b) => a.t - b.t),
    };
  }

  const latestPrediction = run => (Array.isArray(run?.predictions) && run.predictions.length ? run.predictions[run.predictions.length - 1] : null);

  /* กราฟจะแสดงเมื่อมีจุดอย่างน้อย 2 จุดในเส้นใดเส้นหนึ่ง (กราฟจุดเดียวไม่บอกอะไร) */
  function hasChart(run) { const p = points(run); return p.tin.length >= 2 || p.tout.length >= 2; }

  function svg(run) {
    const p = points(run);
    if (!(p.tin.length >= 2 || p.tout.length >= 2)) return '';
    const pred = latestPrediction(run), predV = pred && Number.isFinite(pred.result?.tout_C) ? pred.result.tout_C : null;
    const W = 520, H = 300, m = { l: 60, r: 14, t: 14, b: 44 };   // ฟอนต์ใหญ่พอให้อ่านบนมือถือหลังย่อภาพ
    const allV = [...p.tin.map(x => x.v), ...p.tout.map(x => x.v), ...(predV !== null ? [predV] : [])];
    const y0 = Math.floor(Math.min(...allV) / 10) * 10 - 5, y1 = Math.ceil(Math.max(...allV) / 10) * 10 + 5;
    const tMax = Math.max(1, ...p.tin.map(x => x.t), ...p.tout.map(x => x.t), ...p.events.map(x => x.t));
    const X = t => m.l + t / tMax * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
    const ticks = (lo, hi, n) => Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n);
    const fmt = v => (Math.round(v * 10) / 10).toString();
    const grid = ticks(y0, y1, 4).map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="currentColor" opacity=".12"/><text x="${m.l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="15" fill="currentColor" opacity=".7">${fmt(v)}</text>`).join('')
      + ticks(0, tMax, 3).map(v => `<text x="${X(v).toFixed(1)}" y="${H - m.b + 16}" text-anchor="middle" font-size="15" fill="currentColor" opacity=".7">${fmt(v)}</text>`).join('');
    const line = (arr, color, dash) => arr.length ? `<path d="M${arr.map(x => `${X(x.t).toFixed(1)} ${Y(x.v).toFixed(1)}`).join('L')}" fill="none" stroke="${color}" stroke-width="2.2"${dash ? ` stroke-dasharray="${dash}"` : ''}/>` + arr.map(x => `<circle cx="${X(x.t).toFixed(1)}" cy="${Y(x.v).toFixed(1)}" r="3.5" fill="${color}"><title>${fmt(x.v)} °C · นาทีที่ ${fmt(x.t)}</title></circle>`).join('') : '';
    const predLine = predV !== null ? `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(predV).toFixed(1)}" y2="${Y(predV).toFixed(1)}" stroke="#b45309" stroke-width="1.6" stroke-dasharray="6 4"/><text x="${W - m.r}" y="${(Y(predV) - 5).toFixed(1)}" text-anchor="end" font-size="15" fill="#b45309">คำทำนาย ${fmt(predV)} °C</text>` : '';
    const evs = p.events.map((e, i) => `<g><line x1="${X(e.t).toFixed(1)}" x2="${X(e.t).toFixed(1)}" y1="${m.t}" y2="${H - m.b}" stroke="#be123c" stroke-width="1.2" stroke-dasharray="2 3"/><text x="${(X(e.t) + 3).toFixed(1)}" y="${m.t + 14 + (i % 3) * 16}" font-size="15" fill="#be123c">${esc(e.label)}</text></g>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟอุณหภูมิที่จดในรันนี้ตามเวลา" style="width:100%;height:auto;color:var(--ink,#1f2937)">${grid}${predLine}${evs}${line(p.tin, '#475569', '5 4')}${line(p.tout, '#0f766e')}
      <text x="${((W + m.l) / 2).toFixed(0)}" y="${H - 4}" text-anchor="middle" font-size="15" fill="currentColor">นาทีนับจากรายการแรก</text>
      <text transform="translate(14 ${((H - m.b) / 2).toFixed(0)}) rotate(-90)" text-anchor="middle" font-size="15" fill="currentColor">อุณหภูมิ (°C)</text></svg>`;
  }

  /* คำอธิบายใต้กราฟ: บอกว่าเส้นคือค่าที่ผู้ใช้จดเอง (ไม่ใช่ค่าจากเซ็นเซอร์ที่ระบบอ่าน) และเส้นประส้มคือคำทำนาย */
  function caption(run) {
    const pred = latestPrediction(run);
    return `เส้นทึบเขียว = Tout ที่จด · เส้นประเทา = Tin ที่จด${pred ? ' · เส้นประส้ม = คำทำนายก่อนทดลอง (ไม่ใช่ค่าวัด)' : ''}${points(run).events.length ? ' · เส้นแดง = เหตุการณ์ที่แตะบันทึก' : ''} · ค่าทั้งหมดมาจากที่ผู้ใช้จดเอง`;
  }

  /* สร้างเหตุการณ์ใหม่ (ฟังก์ชันบริสุทธิ์ ใช้ทั้งหน้าจอและเทสต์) */
  function makeEvent(type, now = new Date(), idSeed = Math.random()) {
    if (!EVENT_LABEL[type]) return null;
    return Object.freeze({ id: `ev_${now.getTime()}_${Math.floor(idSeed * 1e6).toString(36)}`, type, time: now.toISOString() });
  }
  function addEvent(events, event) {
    const list = Array.isArray(events) ? events : [];
    if (!event || list.length >= MAX_EVENTS) return list;
    return [...list, event];
  }
  const removeEvent = (events, id) => (Array.isArray(events) ? events.filter(e => e.id !== id) : []);

  globalThis.LaongRunChart = Object.freeze({ EVENT_TYPES, EVENT_LABEL, MAX_EVENTS, points, hasChart, svg, caption, makeEvent, addEvent, removeEvent });
})();
