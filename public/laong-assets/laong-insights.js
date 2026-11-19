/* Laong — หน้า "ข้อมูลย้อนหลัง": กราฟรันจริง + ค้นหาสภาวะใกล้เคียง
 * ข้อมูลอยู่ฝั่งเซิร์ฟเวอร์ (/api/history) ต้องมีรหัสเข้าใช้ — ไฟล์นี้ไม่มีข้อมูลรันฝังอยู่ */
'use strict';
(() => {
  const LABELS = {
    poor_atomization: 'พ่นฝอยไม่ดี', nozzle_clog: 'หัวฉีดตัน', spray_degraded: 'การพ่นเสื่อม', unstable_tout: 'Tout ไม่นิ่ง',
    severe_wall_deposit: 'ติดผนังมาก', wall_deposit: 'ติดผนังชัดเจน', stopped_early: 'หยุดก่อนกำหนด', burn_signal: 'สัญญาณไหม้', feed_interruption: 'ป้อนสะดุด',
  };
  const COLORS = ['#0f766e', '#b45309', '#6d28d9', '#be123c', '#1d4ed8', '#4d7c0f', '#c2410c', '#0e7490', '#a21caf', '#475569'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d).replace(/\.0+$/, '') : 'ไม่มีค่า');
  const tags = (list, run) => (list && list.length ? list.map(x => `<span class="source">${esc(LABELS[x] || x)}</span>`).join(' ') : run && run.source && run.source.kind === 'documented' ? '<span class="hint">ไม่ได้บันทึกข้อสังเกตผลผงไว้ในฐานข้อมูล</span>' : '<span class="hint">ไม่มีเหตุการณ์ที่บันทึกไว้ (ไม่ได้แปลว่าปกติ · ช่องสังเกตการพ่น/การตัน/การไหม้/การติดผนังไม่ได้กรอก)</span>');
  const api = async (url, opt) => {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opt });
    let body = null; try { body = await res.json(); } catch { /* ไม่ใช่ JSON */ }
    return { status: res.status, body };
  };

  /* กราฟเส้นง่าย ๆ แบบ SVG (ไม่พึ่งไลบรารี) */
  function axisTicks(lo, hi, n) { const out = []; for (let i = 0; i <= n; i++) out.push(lo + (hi - lo) * i / n); return out; }
  function scatter(runs) {
    const pts = runs.filter(r => r.runType !== 'water_calibration' && typeof r.conditions.tin_C === 'number' && typeof r.result.tout_C === 'number');   // รันน้ำสอบเทียบไม่ปนกับกราฟของโปรตีน
    if (!pts.length) return '<p class="hint">ยังไม่มีข้อมูลพอวาดกราฟ</p>';
    const W = 560, H = 300, m = { l: 48, r: 16, t: 14, b: 38 };
    const xs = pts.map(p => p.conditions.tin_C), ys = pts.map(p => p.result.tout_C);
    const x0 = Math.floor(Math.min(...xs) / 10) * 10 - 5, x1 = Math.ceil(Math.max(...xs) / 10) * 10 + 5;
    const y0 = Math.floor(Math.min(...ys) / 10) * 10 - 5, y1 = Math.ceil(Math.max(...ys) / 10) * 10 + 5;
    const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
    const grid = axisTicks(y0, y1, 4).map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${fmt(v, 0)}</text>`).join('')
      + axisTicks(x0, x1, 4).map(v => `<text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${fmt(v, 0)}</text>`).join('');
    const dots = pts.map((p, i) => { const ok = p.result.steadyStatus === 'stable', c = COLORS[i % COLORS.length];
      return `<g><circle cx="${X(p.conditions.tin_C)}" cy="${Y(p.result.tout_C)}" r="6" fill="${ok ? c : '#fff'}" stroke="${ok ? '#fff' : c}" stroke-width="${ok ? 1.5 : 2.2}"><title>${esc(p.code || p.id)} · Tin ${fmt(p.conditions.tin_C)} → Tout ${ok ? fmt(p.result.tout_C) + ' (นิ่ง)' : 'ราว ' + fmt(p.result.tout_C) + ' (ยังไม่นิ่ง)'}</title></circle></g>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟ Tout เทียบ Tin ของรันที่ผ่านมา" style="width:100%;height:auto;color:var(--ink,#1f2937)">${grid}${dots}
      <text x="${(W + m.l) / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="currentColor">Tin ที่ตั้ง (°C)</text>
      <text transform="translate(12 ${(H - m.b) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="currentColor">Tout (°C)</text></svg>
      <p class="hint">จุดทึบ = Tout ที่ระบบตรวจแล้วว่านิ่ง · วงกลวง = Tout ยังไม่นิ่ง เป็นค่าอ้างอิงคร่าว ๆ ไม่ใช่ค่านิ่ง (อย่าอ่านเป็นแนวโน้มของสภาวะ)</p>`;
  }

  function lines(selected) {
    const ok = selected.filter(r => r.series && r.series.length);
    if (!ok.length) return '<p class="hint">เลือกรันจากรายการเพื่อดูกราฟตามเวลา</p>';
    const W = 640, H = 320, m = { l: 48, r: 16, t: 14, b: 38 };
    const all = ok.flatMap(r => r.series);
    const x1 = Math.max(...all.map(p => p.t)), vals = all.flatMap(p => [p.tin, p.tout]).filter(v => typeof v === 'number');
    const y0 = Math.floor(Math.min(...vals) / 10) * 10 - 5, y1 = Math.ceil(Math.max(...vals) / 10) * 10 + 5;
    const X = v => m.l + v / x1 * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
    const path = (r, key) => { const pts = r.series.filter(p => typeof p[key] === 'number'); return pts.length ? 'M' + pts.map(p => `${X(p.t).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join('L') : ''; };
    const grid = axisTicks(y0, y1, 5).map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${fmt(v, 0)}</text>`).join('')
      + axisTicks(0, x1, 5).map(v => `<text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${fmt(v, 0)}</text>`).join('');
    const body = ok.map(r => { const c = COLORS[r.__i % COLORS.length]; return `<path d="${path(r, 'tin')}" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="4 3" opacity=".55"/><path d="${path(r, 'tout')}" fill="none" stroke="${c}" stroke-width="2.2"/>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟ Tin และ Tout ตามเวลาของรันที่เลือก" style="width:100%;height:auto;color:var(--ink,#1f2937)">${grid}${body}
      <text x="${(W + m.l) / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="currentColor">เวลารัน (นาที)</text>
      <text transform="translate(12 ${(H - m.b) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="currentColor">อุณหภูมิ (°C)</text></svg>
      <p class="hint">เส้นทึบ = Tout · เส้นประ = Tin · แต่ละสี = หนึ่งรัน</p>`;
  }

  /* รายการรันใกล้เคียง (ใช้ทั้งหน้าข้อมูลย้อนหลังและใต้ฟอร์มแผนก่อนทดลอง)
   * Tout: ถ้าตรวจแล้วว่านิ่ง (steady) แสดงเป็น "ค่านิ่งที่ตรวจแล้ว"; ถ้ายังไม่นิ่งแสดงเป็นค่าอ้างอิงคร่าว ๆ พร้อมช่วงที่วัด — ไม่เอา transient มาแทน steady
   * เวลา: แสดงนาทีเฉพาะรันที่ตัวนับเวลาตรวจครบตามเกณฑ์แอปเดิม (timeBasis.status = clear) รันอื่นแสดงเหตุผลเท่านั้น ไม่แสดงตัวเลขนาที
   * เวลาจากรันที่ผ่านมา ไม่ใช่การทำนายเวลาที่เหลือของรันปัจจุบัน */
  function timeLine(r) {
    const tb = r.timeBasis;
    if (tb && tb.status === 'clear') {
      const pause = tb.interruptions > 0 ? `พัก ${tb.interruptions} ครั้ง รวม ${fmt(tb.interruptionTotal_min)} นาที` : 'ไม่มีการพักที่บันทึก';
      return `<b>เวลาป้อนสุทธิ ${fmt(tb.activeFeeding_min)} นาที</b> <span class="source">ตัวนับเวลาตรวจแล้ว</span><br><span class="hint">นับเฉพาะช่วงที่ปั๊มเดิน ไม่รวม warm-up ช่วงพัก และช่วงสังเกตหลังป้อน · ${esc(pause)}</span>`;
    }
    const why = tb && tb.reasons && tb.reasons.length ? tb.reasons[0] : 'ไม่มีข้อมูลเวลาที่ตรวจแล้ว';
    return `เวลาป้อน: <b>ยังไม่ชัดเจน</b> <span class="source">ไม่แสดงตัวเลข</span><br><span class="hint">${esc(why)}</span>`;
  }

  function similarMarkup(results, limit = 5, summary = null) {
    if (!results.length) return '<p class="hint">ยังไม่มีรันที่ใกล้เคียงในฐานข้อมูล</p>';
    const list = `<ol class="similar-list">${results.slice(0, limit).map(x => {
      const r = x.run, stable = r.result.steadyStatus === 'stable', documented = r.source && r.source.kind === 'documented';
      const range = documented && r.result.toutMin_C != null && r.result.toutMax_C != null && r.result.toutMin_C !== r.result.toutMax_C ? ` (ช่วง ${fmt(r.result.toutMin_C)} ถึง ${fmt(r.result.toutMax_C)})` : '';
      const tout = stable && documented
        ? `<b>Tout นิ่ง ${fmt(r.result.steadyMean_C)} °C</b>${range} <span class="source">ตามบันทึกทีม ไม่มีข้อมูลรายนาที</span>`
        : stable
        ? `<b>Tout นิ่ง ${fmt(r.result.steadyMean_C)} °C</b> <span class="source">ตรวจแล้วว่านิ่ง</span>`
        : `Tout ราว ${fmt(r.result.tout_C)} °C <span class="source">ยังไม่นิ่ง · ค่าอ้างอิงคร่าว ๆ (ช่วงที่วัด ${fmt(r.result.toutMin_C, 0)} ถึง ${fmt(r.result.toutMax_C, 0)})</span>`;
      const d = x.diff.tin_C;
      return `<li><b>${esc(r.code || r.id)}</b> · ${esc(r.date)}
        <br>Tin ${fmt(r.conditions.tin_C)}${typeof d === 'number' && d !== 0 ? ` (${d > 0 ? '+' : ''}${fmt(d)})` : ''} · ป้อน ${fmt(r.conditions.feed_mLmin)} mL/min · °Brix ${fmt(r.conditions.brix)} → ${tout}
        <br>${timeLine(r)}
        ${r.usedForModelFit ? '<br><span class="source">รันสอบเทียบ · ใช้ปรับค่าโมเดลแล้ว ไม่ใช่ข้อมูลตรวจสอบอิสระ</span>' : ''}${r.feedNote ? `<br><span class="hint">${esc(r.feedNote)}</span>` : ''}
        <br>${tags(r.result.failureLabels, r)}</li>`;
    }).join('')}</ol>`;
    const sum = summary ? `<p class="hint">ตรวจเวลาชัดเจนแล้ว ${summary.clear} จาก ${summary.total} รันในฐานข้อมูล</p>` : '';
    const note = '<p class="hint time-note">เวลาจากรันที่ผ่านมา ไม่ใช่การทำนายเวลาที่เหลือของรันนี้ · "เวลาป้อนสุทธิ" = เวลาสะสมที่ตัวนับเวลาอยู่ในสถานะกำลังป้อน · แต่ละรันใช้เงื่อนไขและปริมาณสารต่างกัน</p>';
    return list + sum + note;
  }

  /* Tout ในตาราง: นิ่ง = ตัวเลขเดี่ยว; ไม่นิ่ง = "ราว" + ป้ายกำกับ (ค่าอ้างอิงคร่าว ๆ ไม่ใช่ค่านิ่ง) */
  function toutCell(r) {
    const stable = r.result.steadyStatus === 'stable', v = fmt(r.result.tout_C);
    if (stable) return v + (r.source && r.source.kind === 'documented' ? '<br><span class="hint">ตามบันทึกทีม</span>' : '');
    return `ราว ${v}<br><span class="hint">ยังไม่นิ่ง</span>`;
  }

  function mount(root) {
    root.setAttribute('aria-busy', 'true');
    const state = { runs: [], selected: new Set(), loaded: new Map() };

    const gate = (msg) => {
      root.innerHTML = `<section class="panel panel-pad form-body" style="max-width:480px"><h2>ข้อมูลย้อนหลังของทีม</h2>
        <p class="hint">${esc(msg)}</p>
        <form data-insights-gate novalidate><label>รหัสเข้าใช้<input type="password" name="code" autocomplete="off" required minlength="6"></label>
        <div class="actions"><button class="button primary" type="submit">เข้าดูข้อมูล</button></div>
        <p class="hint" data-gate-msg role="status" aria-live="polite"></p></form></section>`;
      root.querySelector('form').addEventListener('submit', async ev => {
        ev.preventDefault();
        const code = ev.currentTarget.elements.code.value;
        const out = root.querySelector('[data-gate-msg]');
        out.textContent = 'กำลังตรวจรหัส…';
        const r = await api('/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
        if (r.body?.ok) load(); else out.textContent = r.body?.error || 'เข้าไม่ได้';
      });
      root.removeAttribute('aria-busy');
    };

    const draw = () => {
      const picked = state.runs.map((r, i) => ({ ...state.loaded.get(r.id), ...r, __i: i })).filter(r => state.selected.has(r.id) && r.series);
      root.innerHTML = `
      <section class="panel panel-pad form-body"><h2>รันจริงที่ผ่านมา (${state.runs.length} รัน)</h2>
        <p class="hint">ข้อมูลจากการทดลองจริงของทีม · อ่านอย่างเดียว · เห็นได้เฉพาะผู้ที่มีรหัสเข้าใช้</p>
        <div class="table-wrap"><table><thead><tr><th scope="col">เลือก</th><th scope="col">รหัส / วันที่</th><th scope="col">Tin</th><th scope="col">ป้อน</th><th scope="col">°Brix</th><th scope="col">Tout</th><th scope="col">ข้อสังเกต</th></tr></thead><tbody>
        ${state.runs.map((r, i) => `<tr><td><input type="checkbox" data-pick="${esc(r.id)}" aria-label="เลือก ${esc(r.code || r.id)}" ${state.selected.has(r.id) ? 'checked' : ''} style="width:22px;height:22px"></td>
          <td><span style="color:${COLORS[i % COLORS.length]}">●</span> <b>${esc(r.code || r.id)}</b><br><span class="hint">${esc(r.date)} · ${esc(r.material.label || '')}${r.usedForModelFit ? ' · รันสอบเทียบ' : ''}</span></td>
          <td class="mono">${fmt(r.conditions.tin_C)}</td><td class="mono">${fmt(r.conditions.feed_mLmin)}</td><td class="mono">${fmt(r.conditions.brix)}</td><td class="mono">${toutCell(r)}</td>
          <td>${tags(r.result.failureLabels, r)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel panel-pad form-body"><h2>Tout เทียบกับ Tin</h2>${scatter(state.runs)}</section>
      <section class="panel panel-pad form-body"><h2>กราฟตามเวลา</h2>${lines(picked)}</section>
      <section class="panel panel-pad form-body"><h2>ค้นหาสภาวะใกล้เคียง</h2>
        <p class="hint">กรอกสภาวะที่คิดจะรัน ระบบจะแสดงรันที่เคยทำใกล้เคียงที่สุดและผลที่ได้ · ใช้ประกอบการตัดสินใจ ไม่ใช่การรับรองผล</p>
        <form data-similar novalidate><div class="field-grid">
          <label>Tin (°C)<input type="number" name="tin" min="60" max="250" step="any" inputmode="decimal"></label>
          <label>อัตราป้อน (mL/min)<input type="number" name="feed" min="0" max="60" step="any" inputmode="decimal"></label>
          <label>°Brix<input type="number" name="brix" min="0" max="40" step="any" inputmode="decimal"></label>
        </div><div class="actions"><button class="button primary" type="submit">ค้นหา</button></div></form>
        <div data-similar-result role="status" aria-live="polite"></div></section>`;
      root.removeAttribute('aria-busy');
    };

    const load = async () => {
      const r = await api('/api/history');
      if (r.status === 401) return gate(r.body?.error || 'ต้องใส่รหัสเข้าใช้ก่อน');
      if (r.status !== 200 || !r.body?.runs) { root.textContent = 'โหลดข้อมูลย้อนหลังไม่ได้ ลองใหม่อีกครั้ง'; root.removeAttribute('aria-busy'); return; }
      state.runs = r.body.runs;
      state.selected = new Set(state.runs.slice(-3).map(x => x.id));
      await Promise.all([...state.selected].map(async id => { const x = await api('/api/history?id=' + encodeURIComponent(id)); if (x.body?.run) state.loaded.set(id, x.body.run); }));
      draw();
    };

    root.onclick = async ev => {
      const box = ev.target.closest('[data-pick]');
      if (!box) return;
      const id = box.dataset.pick;
      if (box.checked) { state.selected.add(id); if (!state.loaded.has(id)) { const x = await api('/api/history?id=' + encodeURIComponent(id)); if (x.body?.run) state.loaded.set(id, x.body.run); } } else state.selected.delete(id);
      draw();
    };
    root.onsubmit = async ev => {
      const form = ev.target.closest('form[data-similar]');
      if (!form) return;
      ev.preventDefault();
      const q = new URLSearchParams();
      for (const k of ['tin', 'feed', 'brix']) if (form.elements[k].value.trim() !== '') q.set(k, form.elements[k].value.trim());
      const out = root.querySelector('[data-similar-result]');
      if (![...q.keys()].length) { out.innerHTML = '<p class="hint" role="alert">กรอกอย่างน้อยหนึ่งค่า</p>'; return; }
      const r = await api('/api/history/similar?' + q);
      if (r.status !== 200) { out.innerHTML = `<p class="hint" role="alert">${esc(r.body?.error || 'ค้นหาไม่ได้')}</p>`; return; }
      out.innerHTML = similarMarkup(r.body.results, 5, r.body.timeSummary);
    };
    load();
  }

  globalThis.LaongInsights = Object.freeze({ mount, similarMarkup });
})();
