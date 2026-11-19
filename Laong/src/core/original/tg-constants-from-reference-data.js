  const TG_WATER   = -135;   // Tg ของน้ำ (ค่ามาตรฐานที่ใช้กันทั่วไป — Roos)
  const TG_MD_DRY  = 160;    // Tg มอลโตเดกซ์ทริน DE10 แห้ง ⚠️ ยังต้องหาต้นฉบับ
  const TG_COMP = {
    sucrose:      { lo: 62,  mid: 65,   hi: 72,  label: 'ซูโครส' },
    glucose:      { lo: 31,  mid: 38.9, hi: 39,  label: 'กลูโคส' },
    fructose:     { lo: 5,   mid: 10,   hi: 16,  label: 'ฟรุกโตส' },
    citric:       { lo: 5,   mid: 11,   hi: 16,  label: 'กรดซิตริก' },
    fiberPectin:  { lo: 100, mid: 130,  hi: 160, label: 'ใย/เพกทิน/แป้ง' },
    // 🟢 มีข้อมูลวัดจริงรองรับแล้ว (30 ก.ค. 2569)
    // Sritham & Gunasekaran 2017, J Food Eng 211:85–94 — ระบบซูโครส+MD ที่ความชื้น 0.27–0.35% wb
    // ย้อนหาจาก Tg ของส่วนผสม 3 สูตร ได้ Tg_MD = 142–171 °C (เฉลี่ย 156.6) → ค่า 160 อยู่ในช่วง ✅
    maltodextrin: { lo: 141, mid: 160,  hi: 171, label: 'มอลโตเดกซ์ทริน' },
    beanProtein:  { lo: 169, mid: 169,  hi: 169, label: 'โปรตีนถั่ว' },
  };
