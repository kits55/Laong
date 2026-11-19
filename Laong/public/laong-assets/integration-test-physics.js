/* Pure calculation layer. No DOM or browser storage access belongs here. */

  // ค่าคงที่ทางความร้อน
  const CP_AIR = 1.01;    // kJ/kg·K  อากาศ
  const CP_W   = 4.18;    // kJ/kg·K  น้ำเหลว
  const CP_SOL = 1.5;     // kJ/kg·K  ของแข็งอาหารแห้ง (ค่าทั่วไป)
  const RHO_AIR= 1.2; // kg/m³, reference assumption
                          // รายละเอียดเครื่องภายในไม่รวมใน Synthetic TEST
                          //          เป็นค่าคำนวณ ไม่ใช่มวลลมที่วัดโดยตรง
                          //          ถ้าไม่แก้ ค่าที่ทำนายจะเพี้ยนไป 20%
  const T_FLOOR= 25;      // °C       ต่ำกว่านี้โมเดลไม่ valid (ใกล้ ambient/wet-bulb)
  const lambda = T => 2501 - 2.36 * T;   // ความร้อนแฝงการกลายเป็นไอ kJ/kg

  const PHYSICS = {
    MODEL_VERSION: 'ua-energy-balance-1.0.0',
    /* สมดุลพลังงานสภาวะคงตัว (co-current)
       η·ṁ_air·c_p,air·(T_in − T_out) = ṁ_w·[λ(T_out)] + (ṁ_w·c_p,w + ṁ_s·c_p,s)·(T_out − T_feed)

       จัดรูปเป็น closed form:
         T_out = [A·T_in + B·T_feed − ṁ_w·λ] / (A + B)
         โดย A = η·ṁ_air·c_p,air   ,   B = ṁ_w·c_p,w + ṁ_s·c_p,s
       λ ขึ้นกับ T_out จึงวนซ้ำจนลู่เข้า (ปกติ 3–4 รอบ)                                  */
    outletTemp(Tin, F, S, airFlow, eta, Tfeed = 25) {
      const mAir  = airFlow * RHO_AIR;      // kg/h
      const mFeed = F * 60 / 1000;          // mL/min → kg/h (สมมติ ρ_feed ≈ 1 kg/L)
      const W  = mFeed * (1 - S);           // น้ำที่ต้องระเหย kg/h
      const Sd = mFeed * S;                 // ของแข็ง kg/h
      const A = eta * mAir * CP_AIR;
      const B = W * CP_W + Sd * CP_SOL;

      let T = 80, prev = 0, iter = 0;
      while (Math.abs(T - prev) > 1e-6 && iter < 50) {
        prev = T;
        T = (A * Tin + B * Tfeed - W * lambda(T)) / (A + B);
        iter++;
      }
      const raw = T;

      // ขอบเขตความสมเหตุสมผล
      let Tout = raw, extrapolated = false, reason = '';
      if (!isFinite(Tout))      { Tout = T_FLOOR; extrapolated = true; reason = 'คำนวณไม่ได้ (input ไม่สมเหตุสมผล)'; }
      else if (Tout < T_FLOOR)  { Tout = T_FLOOR; extrapolated = true; reason = 'ภาระน้ำสูงเกินกำลังลมร้อน — เครื่องระเหยไม่ทัน'; }
      else if (Tout > Tin - 5)  { Tout = Tin - 5; extrapolated = true; reason = 'ภาระน้ำน้อยมากจนลมแทบไม่เย็นลง'; }
      return { raw, Tout, extrapolated, reason, W, Sd, A, B, mAir, mFeed };
    },

    /* ═══ โมเดล UA — แยกการสูญเสียความร้อนเป็น lumped parameter ของโปรไฟล์ ═══
       η เป็นสัดส่วนประสิทธิภาพ ณ จุดเดินเครื่อง จึงเปลี่ยนตาม thermal load ได้ตามธรรมชาติ
       แบบ UA เขียนสมดุลให้ครบทุกก้อน แล้วให้การสูญเสียเป็นพจน์อิสระ

         ṁ_air·c_p·(T_in − T_out) = ṁ_w·λ(T_out) + ṁ_w·c_pw·(T_out − T_feed)
                                     + UA·( (T_in+T_out)/2 − T_room )

       UA มีหน่วย kJ/(h·K) และรวมผลของพื้นที่ผิว/ฉนวน/การถ่ายเทความร้อน
       สมมติให้คงที่โดยประมาณเฉพาะเครื่อง Air-in และช่วงสภาวะที่คาลิเบรต           */
    solveUA(Tin, Tout, F, S, airFlow, Troom = 25, Tfeed = 25) {
      if (!(Tin > Tout)) return { ua: null, ok: false, msg: 'Outlet ต้องต่ำกว่า Inlet' };
      const Tavg = (Tin + Tout) / 2;
      if (Tavg <= Troom) return { ua: null, ok: false, msg: 'อุณหภูมิเฉลี่ยในตู้ต้องสูงกว่าอุณหภูมิห้อง' };
      const A = airFlow * RHO_AIR * CP_AIR;
      const mFeed = F * 60 / 1000, W = mFeed * (1 - S), Sd = mFeed * S;
      const B = W * CP_W + Sd * CP_SOL;
      const qLoss = A * (Tin - Tout) - W * lambda(Tout) - B * (Tout - Tfeed);
      const ua = qLoss / (Tavg - Troom);
      if (!isFinite(ua)) return { ua: null, ok: false, msg: 'คำนวณไม่ได้' };
      if (ua < 0) return { ua, ok: false,
        msg: `UA = ${ua.toFixed(1)} ซึ่งติดลบ — แปลว่าลมปล่อยความร้อนน้อยกว่าที่ใช้ระเหย เป็นไปไม่ได้ ตรวจ air flow หรือ feed rate` };
      return { ua, ok: true, msg: `UA = ${ua.toFixed(1)} kJ/(h·K) = ${(ua/3.6).toFixed(2)} W/K` };
    },

    /* forward model ของ UA — หา T_out (closed form ไม่ต้องวนซ้ำ)
       จัดรูปจากสมการข้างบนโดยแทน λ(T) = 2501 − 2.36T แล้วรวมพจน์ T */
    outletTempUA(Tin, F, S, airFlow, ua, Troom = 25, Tfeed = 25) {
      const A = airFlow * RHO_AIR * CP_AIR;
      const mFeed = F * 60 / 1000, W = mFeed * (1 - S), Sd = mFeed * S;
      const B = W * CP_W + Sd * CP_SOL;
      const num = A * Tin + B * Tfeed + ua * Troom - ua * Tin / 2 - 2501 * W;
      const den = A + B + ua / 2 - 2.36 * W;
      const raw = num / den;
      let Tout = raw, extrapolated = false, reason = '';
      if (!isFinite(Tout))      { Tout = T_FLOOR; extrapolated = true; reason = 'คำนวณไม่ได้'; }
      else if (Tout < T_FLOOR)  { Tout = T_FLOOR; extrapolated = true; reason = 'ภาระน้ำ + การสูญเสียเกินกำลังลมร้อน'; }
      else if (Tout > Tin - 5)  { Tout = Tin - 5; extrapolated = true; reason = 'ภาระน้ำน้อยมาก'; }
      return { raw, Tout, extrapolated, reason, W, Sd, A, B };
    },

    /* ย้อนหา η จากรอบที่รู้ค่า outlet จริง — หัวใจของการคาลิเบรต
       จาก T_out ที่วัดได้ → A = [B·(T_out−T_feed) + ṁ_w·λ(T_out)] / (T_in − T_out)
       η = A / (ṁ_air·c_p,air)                                                        */
    solveEta(Tin, Tout, F, S, airFlow, Tfeed = 25) {
      if (!(Tin > Tout)) return { eta: null, ok: false, msg: 'Outlet ต้องต่ำกว่า Inlet' };
      const mAir  = airFlow * RHO_AIR;
      const mFeed = F * 60 / 1000;
      const W = mFeed * (1 - S), Sd = mFeed * S;
      const B = W * CP_W + Sd * CP_SOL;
      const A = (B * (Tout - Tfeed) + W * lambda(Tout)) / (Tin - Tout);
      const eta = A / (mAir * CP_AIR);
      if (!isFinite(eta) || eta <= 0) return { eta: null, ok: false, msg: 'คำนวณไม่ได้ ตรวจค่าที่กรอกอีกครั้ง' };
      if (eta > 1) return { eta, ok: false,
        msg: `η = ${eta.toFixed(2)} ซึ่ง >1 เป็นไปไม่ได้ทางฟิสิกส์ — แปลว่า air flow ที่กรอกน้อยเกินจริง หรือ feed rate มากเกินจริง` };
      return { eta, ok: true, msg: `คาลิเบรตแล้ว η = ${eta.toFixed(3)} สำหรับเครื่องนี้` };
    },

    // ผสม Tg ของของแข็งแห้งแบบเชิงเส้นตามสัดส่วนมวล
    blendTgDry(mdFrac, tgSolidDry) {
      return mdFrac * TG_MD_DRY + (1 - mdFrac) * tgSolidDry;
    },

    /* ─── องค์ประกอบ → T_g ของของแข็ง (สำหรับวัสดุที่ประกาศ sugars) ───
       ขั้นตอน:
         1. normalize สัดส่วนน้ำตาลให้รวมเป็น 100
         2. กระจายลงบนของแข็งทั้งหมด โดยหักส่วนของกรดซิตริกและใย/เพกทินออกก่อน
         3. ผสม T_g เชิงเส้นตามมวล (วิธีเดียวกับที่กิ่งถั่วใช้กับ MD+โปรตีน)

       ⚠️ ข้อจำกัด: Gordon–Taylor เป็นสมการไบนารี จึงรวมของแข็งทุกตัวเป็น
          pseudo-component เดียวก่อน แล้วค่อยเข้า GT กับน้ำ — ไม่ได้ยัด 5 องค์ประกอบเข้า GT ตรงๆ
          การผสมเชิงเส้นในขั้นที่ 3 เป็นการประมาณ ค่าจริงอาจเบี่ยงเบน (Schugmann & Foerst 2022) */
    tgSolidsFromComposition(mat, band) {
      const s = mat.sugars;
      const sugarTotal = s.sucrose + s.glucose + s.fructose;
      const sugarShare = 100 - mat.citricPctSolids - mat.fiberPctSolids;
      const w = {
        sucrose:     s.sucrose  / sugarTotal * sugarShare,
        glucose:     s.glucose  / sugarTotal * sugarShare,
        fructose:    s.fructose / sugarTotal * sugarShare,
        citric:      mat.citricPctSolids,
        fiberPectin: mat.fiberPctSolids,
      };
      let num = 0, den = 0;
      for (const k in w) { num += w[k] * TG_COMP[k][band]; den += w[k]; }
      return { tg: num / den, weights: w };
    },

    /* คืนแถบ T_g ของผงสุดท้าย (lo / mid / hi) หลังผสม MD และลดทอนด้วยความชื้น
       — สำหรับวัสดุที่มี sugars จะคำนวณจากองค์ประกอบ
       — สำหรับวัสดุที่มี tgDry ตรงๆ (กิ่งถั่ว) จะได้ค่าเดียวทั้งสามช่อง (ไม่เปลี่ยนพฤติกรรมเดิม) */
    /* interpolate เชิงเส้นจากเส้นโค้งที่วัดจริง (Fongin 2017)
       ⚠️ เปเปอร์ระบุว่ามี "abrupt Tg-change" ระหว่าง MD 0.6–0.7 จึง interpolate
          ระหว่างจุดที่วัดจริงเท่านั้น ไม่ใช้สมการผสมเชิงเส้นตลอดช่วง */
    fromCurve(curve, mdFrac) {
      const reject = code => ({status:'unavailable', code, reason:code});
      if (curve == null || (Array.isArray(curve) && curve.length === 0)) return reject('REFERENCE_DATA_NOT_AVAILABLE');
      if (!Number.isFinite(mdFrac)) return reject('INVALID_INPUT');
      if (!Array.isArray(curve) || curve.length < 2 || curve.some((point,i) => !point ||
          !['md','tgas','k','wc','awc'].every(key => Number.isFinite(point[key])) || point.k <= 0 ||
          point.md < 0 || point.md > 1 || (i > 0 && point.md <= curve[i-1].md))) return reject('INVALID_CURVE');
      if (mdFrac < 0 || mdFrac > 1 || mdFrac < curve[0].md || mdFrac > curve[curve.length-1].md) return reject('OUT_OF_RANGE');
      const f = mdFrac;
      for (let i = 0; i < curve.length - 1; i++) {
        const a = curve[i], b = curve[i + 1];
        if (f >= a.md && f <= b.md) {
          const t = (b.md - a.md) === 0 ? 0 : (f - a.md) / (b.md - a.md);
          const mix = (x, y) => x + (y - x) * t;
          return { status:'valid', code:'VALID_RESULT', tgas: mix(a.tgas, b.tgas), k: mix(a.k, b.k),
                   wc: mix(a.wc, b.wc), awc: mix(a.awc, b.awc), exact: t === 0 || t === 1 };
        }
      }
      return {status:'unavailable', code:'OUT_OF_RANGE', reason:'OUT_OF_RANGE'};
    },

    tgBand(mat, mdFrac, moisture, k) {
      if ((mat?.requiresMeasuredCurve === true || mat?.id === 'mango_measured') && (!Array.isArray(mat.measuredCurve) || mat.measuredCurve.length < 2)) {
        const code=mat?.measuredCurve == null || (Array.isArray(mat.measuredCurve) && mat.measuredCurve.length===0)?'REFERENCE_DATA_NOT_AVAILABLE':'INVALID_CURVE';
        return {status:'unavailable', code, reason:code, lo:null, mid:null, hi:null};
      }
      /* ── วัสดุที่มีเส้นโค้งวัดจริง: ใช้ตรงๆ ไม่ต้องคำนวณจากองค์ประกอบ ──
         แถบความไม่แน่นอน ±9 °C ตามที่เปเปอร์รายงาน (Tg-difference 7–11 °C ที่ Tg = 25 °C) */
      if (mat.measuredCurve) {
        if (!Number.isFinite(moisture) || moisture < 0 || moisture >= 1) return {status:'unavailable',code:'INVALID_INPUT',reason:'INVALID_INPUT',lo:null,mid:null,hi:null};
        const c = PHYSICS.fromCurve(mat.measuredCurve, mdFrac);
        if (c.status === 'unavailable') return {status:'unavailable', code:c.code, reason:c.reason, lo:null, mid:null, hi:null};
        const tgMid = PHYSICS.gordonTaylor(c.tgas, moisture, c.k);
        const mk = (d) => ({ tgDryBlend: c.tgas, tg: tgMid + d, tgSolid: c.tgas });
        const {status, code, ...curveValues} = c;
        return { lo: mk(-9), mid: mk(0), hi: mk(+9),
                 weights: null, hasBand: true, curve: curveValues, fromMeasured: true };
      }
      const out = {};
      let weights = null;
      ['lo', 'mid', 'hi'].forEach(band => {
        let tgSolid, tgMd;
        if (mat.sugars) {
          const r = PHYSICS.tgSolidsFromComposition(mat, band);
          tgSolid = r.tg; weights = r.weights;
          tgMd = TG_COMP.maltodextrin[band];
        } else {
          tgSolid = mat.tgDry;          // กิ่งถั่ว — ค่าคงที่ ไม่มีแถบ
          tgMd = TG_MD_DRY;
        }
        const blend = mdFrac * tgMd + (1 - mdFrac) * tgSolid;
        out[band] = { tgDryBlend: blend, tg: PHYSICS.gordonTaylor(blend, moisture, k), tgSolid };
      });
      return { ...out, weights, hasBand: !!mat.sugars };
    },

    // Gordon–Taylor: ของแข็ง + น้ำ
    // ⚠️ ข้อจำกัดสำคัญ (Schugmann & Foerst 2022, Foods 11:1679):
    //    GT เบี่ยงเบนแบบ sigmoidal และคลาดเคลื่อนมากขึ้นเมื่อ ΔTg ของคู่ผสมสูง
    //    ระบบผลไม้+มอลโตเดกซ์ทริน (ΔTg ~150°C) คือกรณีที่แม่นน้อยที่สุด
    gordonTaylor(tgDryBlend, moisture, k) {
      const wS = 1 - moisture, wW = moisture;
      return (wS * tgDryBlend + k * wW * TG_WATER) / (wS + k * wW);
    },
  };
