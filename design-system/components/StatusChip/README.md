ป้ายบอกที่มาของข้อมูล: `<span class="ld-chip" data-kind="measured"><span class="ld-chip__icon" aria-hidden="true">●</span>Measured</span>`.

`data-kind` มี 9 ค่า: `measured`, `observed`, `calculated`, `predicted`, `proxy`, `assumed`, `validated`, `unvalidated`, `missing`. ความหมายของแต่ละค่าตรงกับกฎข้อมูลของแอปต้นฉบับและห้ามเปลี่ยน.

ผู้ใช้ต้องจัดหา: ค่าที่ถูกต้องว่าตัวเลขนั้นมาจากไหน. ป้ายไม่ตัดสินให้ ถ้าไม่รู้ที่มาให้ใช้ `assumed` หรือ `missing` ห้ามเดา.

- ทุกตัวเลขที่แสดงต้องมีป้ายที่มา. Measured, Observed, Calculated, Predicted, Proxy, Assumed, Validated ห้ามปนอยู่ในค่าเดียวกัน.
- ป้ายไม่ใช้สีอย่างเดียว: มีไอคอน คำ และรูปเส้นขอบต่างกัน (ทึบ, ประ, จุด, หนา).
- ผล Target Tout ต้องมีป้าย `unvalidated` ติดเสมอ และห้ามเปลี่ยนเป็น `validated` จนกว่าจะมีค่าวัดจริงมายืนยันตามกติกาเดิมของระบบ.
- ข้อความป้ายเป็นอังกฤษตามศัพท์มาตรฐาน ถ้าต้องการคำไทยให้ใส่ต่อท้ายหลังจุดกลาง เช่น `Proxy · Brix`.
