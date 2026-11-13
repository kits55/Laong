# Laong จาก Stitch

เปิด PowerShell ในโฟลเดอร์นี้แล้วรัน `npm install` และ `npm run dev` เปิด http://localhost:3000
ตรวจ Production ด้วย `npm run build` และ `npm start`

Next.js App Router และ React รับผิดชอบ App Shell, URL และเมนูหมวด ใช้ Tailwind, shadcn/ui Collapsible และ Framer Motion ส่วนฟอร์ม รัน ปฏิทิน รายงาน และพรีวิวเดิมอยู่ใน `public/laong-assets` เพื่อเก็บพฤติกรรมเดิมระหว่างย้ายหน้าจอ

Stitch ให้ภาพอ้างอิงสามหน้า ได้แก่ Run Inventory, Machine Monitor / Admin และ Executive Overview Mobile รุ่นนี้นำสี ตัวอักษร โครงแถบข้าง และลำดับความสำคัญของข้อมูลมาใช้ร่วมกับหน้าที่มีอยู่ใน Laong

ข้อมูลเก็บใน localStorage ตาม origin ของเว็บ ข้อมูลจาก file URL หรือโดเมนเดิมต้องมีกระบวนการย้ายข้อมูลแยก หน้ากล้องและผู้บริหารเป็นข้อมูลจำลอง
