# กติกา core ที่ห้ามเปลี่ยน

ชุดนี้ออกแบบเฉพาะชั้นแสดงผล. ข้อต่อไปนี้มาจากแอปต้นฉบับและต้องคงไว้ทุกครั้งที่นำชุดนี้ไปใช้.

## ความหมายของข้อมูล

- ค่าที่ไม่มีเป็นค่าว่าง ไม่ใช่ 0.
- TS ไม่เท่ากับ °Brix โดยอัตโนมัติ. ใช้ Brix ได้เมื่อผู้ใช้เลือกเองเป็น Proxy และติดป้าย.
- Pump % ไม่ใช่อัตราป้อนจริง.
- Measured, Observed, Calculated, Predicted, Proxy, Assumed, Validated ห้ามปนกัน.
- ผล Target Tout เป็น "คำนวณ UNVALIDATED" เสมอ.
- prediction error ว่างจนกว่าจะมีค่าวัดจริง.

## ไฟล์และข้อมูลที่ห้ามแตะผ่านงานหน้าตา

| กลุ่ม | ไฟล์ |
|---|---|
| Physics และข้อมูลอ้างอิง | `js/physics-model.js`, `js/reference-data.js`, runtime-config |
| Calibration | `js/calibration.js` |
| Storage และ schema | `js/storage.js`, `js/data-layer.js` |
| Evidence และ provenance | `js/run-review.js`, `js/research-integrity.js` |
| งานผสม UI กับโดเมน (ห้ามถือว่าเป็น UI ล้วน) | `js/app-core.js`, `js/doe.js`, `js/powder-optimizer.js`, `js/run-capture.js`, `js/run-protocol.js`, `js/sequential-experiment.js` |

แก้ได้เฉพาะ CSS ของแอป (`assets/*.css`, `workspace-private/style.css`, `companion.css`) และ `operator-layout.js` ภายใต้เงื่อนไขด้านล่าง.

## เงื่อนไขเมื่อเปลี่ยนหน้าตา

1. คง id ของ input ลำดับการโหลดสคริปต์ และ listener เดิมทั้งหมด.
2. ไม่สร้าง Timer, Run Store หรือ Prediction Engine ใหม่ ให้เรียกของเดิม.
3. เก็บ hash ของไฟล์ core ก่อนและหลังแก้ ถ้า hash ของกลุ่มข้างบนเปลี่ยนให้หยุดและถามเจ้าของ.
4. ส่งภาพก่อนและหลังที่ 390, 768, 1280 และ 1440 px.
5. ถ้างานต้องเปลี่ยนสัญญาข้อมูล ให้หยุดและเสนอแยกเป็นข้อเสนอ.
6. ห้ามใช้ข้อมูลจริง ค่าคาลิเบรตจริง analytics หรือ CDN โดยไม่ได้รับอนุมัติ.
