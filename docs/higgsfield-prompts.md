# รูปหน้า welcome ธีมนวัตกรรมโลกอนาคต (Higgsfield)

ทุกรูปใช้ประโยคเครื่องและประโยคสไตล์ท้าย prompt เดียวกันคำต่อคำ ทั้งชุดจะได้ดูเป็นงานเดียวกัน
แนบรูปเครื่องจริงแบบหน้าตรงที่ไม่มีคน (กดบวกใน Create Image) ทุกครั้ง ไม่แนบรูปคนจริง

| ไฟล์ใน `public/images/gen/` | ใช้ตรงไหน | สัดส่วน | จำเป็นไหม |
|---|---|---|---|
| `hero-bg` | พื้นหลังหัวหน้า จอกว้าง | 16:9 ความละเอียด 2K | ต้องมี |
| `hero-bg-mobile` | พื้นหลังหัวหน้า มือถือ | 4:5 | ไม่มีก็ได้ จะครอปจากรูปจอกว้าง |
| `hero-bg.mp4` | ภาพเคลื่อนไหวเล่นครั้งเดียวทับพื้นหลัง (จอกว้าง) | 16:9 | ไม่มีก็ได้ |
| `problem-notes` | ส่วน "ข้อมูลการทดลองกระจาย" | 16:9 | ไม่มีก็ได้ ใช้ภาพวาดเดิม |
| `result-powder` | ส่วนท้าย "ลองใช้" | 16:9 | ไม่มีก็ได้ |

ลำดับทำ
1. `hero-bg` ก่อน รัน prompt เดียวกันใน 6 โมเดลแล้วเลือกด้วยตา: GPT Image Sunburst, Nano Banana Pro, Nano Banana 2.1, FLUX.2 Pro, Seedream 5.5, Higgsfield Soul
2. รูปอื่นใช้โมเดลที่ชนะเท่านั้น รุ่นละ 4 รูป แสงและผิววัสดุจะได้ตรงกัน
3. ดูขนาดเต็ม: ตัวหนังสือหรือตัวเลขมั่วบนแผงลอย โลโก้ยี่ห้อ ชิ้นแก้วต่อผิดที่ ถ้ามีให้ Edit แก้เฉพาะจุด
4. วางไฟล์ตามชื่อในตาราง (.webp .png หรือ .jpg) แล้วรัน `npm run build` หน้าเว็บจะใช้รูปเอง

## 1. hero-bg (พื้นหลังหัวหน้า จอกว้าง)

ข้อความหัวหน้าจะอยู่ครึ่งซ้าย การ์ดตัวอย่างอยู่ครึ่งขวาตรงกลาง ครึ่งซ้ายของภาพจึงต้องมืดและเรียบ

```
The benchtop spray dryer from the attached photo, reimagined a few years in the future but keeping its shape and layout: a white cabinet with a tall clear glass drying chamber ending in a cone, a small glass collection bottle under it, a glass cyclone with a clear collection cup on its right, and a slim touchscreen panel on the right side. The machine's logo is left off. It stands on a long white lab bench, and a fine mist of tiny droplets swirls down inside the glass chamber, lit softly from within in teal. A dark near-future lab at night: a tall window wall far behind with blurred city lights, slim ceiling light strips fading into darkness, and two thin floating glass panels beside the machine showing a rising line chart and a simple round gauge. The teal glow inside the chamber is the main light, with a cool strip light far behind and a small warm desk lamp at the far right edge. The machine and its panels fill the right half of the frame; the left half is a calm, dark, almost empty wall and bench in deep teal shadow. A wide shot from just above bench height on a 35mm lens, the chamber in sharp focus and the background softly blurred, like a quiet night in a lab where something new is being made. A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows (#06262B), one soft teal light (#3FB6A8) and a small warm orange accent (#F2B36B). Clean, believable materials, a gentle haze in the air, shallow depth of field, no neon and no glowing outlines. No words, numbers, logos or brand marks anywhere in the picture.
```

Create Image, 16:9, 2K, แนบรูปเครื่องหน้าตรง รันใน 6 โมเดล

## 2. hero-bg-mobile (พื้นหลังหัวหน้า มือถือ)

แนบรูปเครื่องเป็นรูปที่ 1 และ `hero-bg` ที่เลือกเป็นรูปที่ 2

```
The same lab and the same machine as image 2, recomposed for a tall phone screen. The benchtop spray dryer from the attached photo, reimagined a few years in the future but keeping its shape and layout: a white cabinet with a tall clear glass drying chamber ending in a cone, a small glass collection bottle under it, a glass cyclone with a clear collection cup on its right, and a slim touchscreen panel on the right side. The machine's logo is left off. The machine stands in the lower half of the frame, a little right of center, with a fine teal-lit mist swirling down inside its glass chamber and one thin floating glass panel beside it showing a rising line chart. The top half of the frame is a calm, dark, almost empty ceiling and wall in deep teal shadow with a few slim light strips fading into darkness. Same light as image 2: the teal glow inside the chamber as the main light and a small warm lamp at the right edge. Shot from just above bench height, the chamber in sharp focus. A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows (#06262B), one soft teal light (#3FB6A8) and a small warm orange accent (#F2B36B). Clean, believable materials, a gentle haze in the air, shallow depth of field, no neon and no glowing outlines. No words, numbers, logos or brand marks anywhere in the picture.
```

Create Image, 4:5 (ถ้าไม่มีใช้ 3:4), โมเดลที่ชนะจากข้อ 1

## 3. hero-bg.mp4 (ภาพเคลื่อนไหว ไม่บังคับ)

ใช้ `hero-bg` ที่เลือกเป็น start frame เว็บจะเล่นครั้งเดียวแบบไม่มีเสียง แล้วค้างเฟรมสุดท้าย

แผน: ช็อตเดียว 8 วินาที โอกาสสำเร็จราว 85 จุดเสี่ยงคือแผงลอยอาจมีตัวหนังสือโผล่ (ถ้าโผล่ ให้รันซ้ำอีกรอบก่อนแก้คำ)

```
[GOAL]
Create an 8-second single shot. The picture from the start frame comes quietly alive: mist swirls down inside the glass drying chamber of the spray dryer, fine droplets drift and settle, and the line on the floating chart panel draws itself from left to right. Calm and precise, a lab where something new is being made.

[SCENE]
Night in the near-future lab exactly as in the start frame. The machine and its floating panels on the right half, the calm dark wall and bench on the left half. The teal glow inside the glass chamber is the main light, a cool strip light far behind, a small warm lamp at the right edge. Nobody is in the scene.

[STAGE 1 | 0-8 SECONDS | THE MIST]
Camera: The same framing as the start frame, pushing in very slowly by a few centimeters toward the chamber, one unbroken shot with no cut.
Action: Inside the glass chamber a fine mist spirals slowly downward and thins toward the cone, a few tiny droplets drift out across the dark left half of the frame and fade, and the line on the floating chart panel draws from left to right and stops at its highest point. The machine itself stays still.

[VISUAL STYLE]
A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows, one soft teal light and a small warm orange accent. A gentle haze in the air, shallow depth of field, no neon and no glowing outlines. Everything at real speed.

[AUDIO]
No music. No sound.

[MAINTAIN CONSISTENCY]
One unbroken shot from the first frame to the last, no cut. The machine's shape, glass parts and position stay exactly as the start frame. The left half stays dark and calm. No words, numbers or logos appear anywhere.
```

Create Video, Seedance 2.5 Draft, 8 วินาที, 16:9, start frame = `hero-bg` ถ้าชอบค่อยกดทำ full quality จากดราฟต์นั้น ดาวน์โหลดเป็น mp4 ตั้งชื่อ `hero-bg.mp4`

## 4. problem-notes (ข้อมูลการทดลองกระจาย)

```
A corner of a clean white near-future lab bench beside the spray dryer, with no people: old paper note sheets covered in scribbled lines, sticky notes stuck on the machine's white cabinet, an open paper notebook, a phone showing a blurry photo of the machine's screen and a coffee mug, scattered and overlapping, out of place next to the sleek machine. The benchtop spray dryer from the attached photo, reimagined a few years in the future but keeping its shape and layout: a white cabinet with a tall clear glass drying chamber ending in a cone, a small glass collection bottle under it, a glass cyclone with a clear collection cup on its right, and a slim touchscreen panel on the right side. The machine's logo is left off. The machine stands at the right edge of the frame, partly cut off, and the papers fill the left two thirds; a floating glass panel beside it is dark and empty. Cool, slightly flat light from ceiling strips, with the faint teal glow of the chamber on the papers. Seen from a little above the bench at a three quarter angle. A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows (#06262B), one soft teal light (#3FB6A8) and a small warm orange accent (#F2B36B). Clean, believable materials, a gentle haze in the air, shallow depth of field, no neon and no glowing outlines. No words, numbers, logos or brand marks anywhere in the picture.
```

Create Image, 16:9, โมเดลที่ชนะ

## 5. result-powder (ส่วนท้าย ลองใช้)

```
A hand in a pale blue nitrile glove holds up a small clear glass vial of fine pale yellow mango powder, just taken from the cyclone's collection cup, in front of the spray dryer. The benchtop spray dryer from the attached photo, reimagined a few years in the future but keeping its shape and layout: a white cabinet with a tall clear glass drying chamber ending in a cone, a small glass collection bottle under it, a glass cyclone with a clear collection cup on its right, and a slim touchscreen panel on the right side. The machine's logo is left off. The machine stands softly out of focus behind the vial, and a thin floating glass panel beside it shows a tidy rising line chart and a simple table drawn as plain shapes. Warm late afternoon light from a window on the left catches the powder, with the cool teal glow of the empty chamber behind. A close shot at eye height, the vial in sharp focus, like the quiet moment a run turns out right. A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows (#06262B), one soft teal light (#3FB6A8) and a small warm orange accent (#F2B36B). Clean, believable materials, a gentle haze in the air, shallow depth of field, no neon and no glowing outlines. No words, numbers, logos or brand marks anywhere in the picture.
```

Create Image, 16:9, โมเดลที่ชนะ

## สิ่งที่เว็บทำกับรูป

- หัวหน้ามี 4 ชั้น: ภาพพื้นหลัง, ละอองชั้นไกล, ละอองชั้นใกล้ (วาดด้วยโค้ด), ข้อความและการ์ด
- เปิดหน้า: ภาพค่อย ๆ ถอยออกและเลื่อนเข้าที่เองครั้งเดียว (14 วินาที) ละอองลอยขึ้นมาแล้วหยุด
- เลื่อนหน้า: ภาพเลื่อนช้า ละอองใกล้เลื่อนเร็วสวนทาง จึงเห็นมิติ
- ขยับเมาส์ (จอคอม): ชั้นใกล้ขยับมากกว่าชั้นไกล หยุดเมื่อเมาส์หยุด
- ผู้ใช้ที่ตั้งลดการเคลื่อนไหว: ภาพนิ่งทั้งหมด ไม่เล่นวิดีโอ

## 6. login-bg (แผงซ้ายหน้าเข้าสู่ระบบ) + login-bg.mp4

แผงซ้ายของหน้า login เป็นแนวตั้ง (ราว 655×900 บนจอคอม, บนมือถือเป็นแถบ 375×200 ครอปกลางภาพ) ข้อความวางที่หนึ่งในสามล่าง ภาพจึงต้องให้ส่วนล่างมืดและเรียบ
แนบรูปเครื่องหน้าตรงเป็นรูปที่ 1 และ `hero-bg` เป็นรูปที่ 2 (ให้ห้องกับแสงตรงกัน)

```
The same lab and the same machine as image 2, seen from a new angle for a tall portrait frame. The benchtop spray dryer from the attached photo, reimagined a few years in the future but keeping its shape and layout: a white cabinet with a tall clear glass drying chamber ending in a cone, a small glass collection bottle under it, a glass cyclone with a clear collection cup on its right, and a slim touchscreen panel on the right side. The machine's logo is left off. A close three quarter view from slightly below bench height on the machine's left side, so the tall glass chamber rises through the upper two thirds of the frame and the cyclone with its collection cup sits in the middle right, a thin layer of fine pale powder at the bottom of the cup. A fine mist spirals down inside the chamber, lit softly from within in teal, and that glow is the main light, falling sideways onto the cabinet and the glass cyclone. Behind it, out of focus, a dark window wall with a few blurred city lights and one cool ceiling strip; a small warm lamp glows at the far right edge. The lower third of the frame is the dark matte bench and its shadow, calm and almost empty. Like the quiet minute before a run is logged. A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows (#06262B), one soft teal light (#3FB6A8) and a small warm orange accent (#F2B36B). Clean, believable materials, a gentle haze in the air, shallow depth of field, no neon and no glowing outlines. No words, numbers, logos or brand marks anywhere in the picture.
```

Create Image, 9:16, 2K (เครื่องมือวิดีโอรับแค่ 16:9 กับ 9:16 ภาพนิ่งจึงต้อง 9:16 ด้วย start frame จะได้ตรง), โมเดลที่ชนะจากข้อ 1 รัน 4 รูปแล้วเลือก ตั้งชื่อ `login-bg` (.jpg หรือ .webp)

วิดีโอ: start frame = `login-bg` ที่เลือก เว็บจะเล่นครั้งเดียวไม่มีเสียงแล้วค้างเฟรมสุดท้าย (ไม่วนตามกติกาโปรเจกต์) แผน: ช็อตเดียว 8 วินาที โอกาสสำเร็จราว 80 จุดเสี่ยงคือผงในถ้วยอาจดูเหมือนน้ำ หรือกล้องหมุนเยอะเกิน ถ้าเป็นให้รันซ้ำก่อนแก้คำ

```
[GOAL]
Create an 8-second single shot. The picture from the start frame comes alive the way a spray dryer actually works: mist spirals down the glass chamber, fine powder drifts through the cyclone, and a little more pale powder settles into the collection cup. Calm and precise, the quiet minute before a run is logged.

[SCENE]
Night in the near-future lab exactly as in the start frame, seen from the same low three quarter angle. The tall glass chamber in the upper part of the frame, the cyclone and its collection cup in the middle right, the dark calm bench across the lower third. The teal glow inside the chamber is the main light, a cool strip light far behind, a small warm lamp at the right edge. Nobody is in the scene.

[STAGE 1 | 0-8 SECONDS | THE RUN]
Camera: The same framing as the start frame, rising very slowly by a few centimeters and easing in toward the chamber, one unbroken shot with no cut.
Action: Inside the chamber the fine mist keeps spiralling downward and thins toward the cone, a soft stream of fine dry particles swirls round inside the glass cyclone, and the pale powder in the collection cup rises by a thin layer. A few tiny droplets drift across the dark background and fade. The machine itself stays still and the teal glow breathes once, slightly brighter then back.

[VISUAL STYLE]
A soft photoreal 3D render of a near-future university research lab, calm and precise: matte white and pale gray surfaces, brushed steel and clear glass, deep night teal shadows, one soft teal light and a small warm orange accent. A gentle haze in the air, shallow depth of field, no neon and no glowing outlines. Everything at real speed. The powder is dry and fine like flour, never liquid.

[AUDIO]
No music. No sound.

[MAINTAIN CONSISTENCY]
One unbroken shot from the first frame to the last, no cut. The machine's shape, glass parts and position stay exactly as the start frame. The lower third stays dark and calm. No words, numbers or logos appear anywhere.
```

Create Video, Seedance 2.5 Draft (หรือ Google Flow), 8 วินาที, 9:16, start frame = `login-bg` ถ้าชอบค่อยกดทำ full quality จากดราฟต์นั้น ดาวน์โหลดเป็น mp4 ตั้งชื่อ `login-bg.mp4` แล้วดึงเฟรมแรกของวิดีโอมาทับ `login-bg` อีกที ภาพนิ่งกับวิดีโอจะได้ต่อกันไม่กระตุก
