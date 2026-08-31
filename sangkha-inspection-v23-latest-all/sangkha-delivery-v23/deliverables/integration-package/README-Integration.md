# Sangkha Inspection: Integration Package

แพ็กเกจนี้รวม source สำหรับเชื่อม Inspector, Supervisor และ Admin ด้วย Worker เดียวกัน โดยใช้ Google Sheets เป็นแหล่งข้อมูลหลักและ Apps Script Bridge สำหรับบันทึกรูปลง Google Drive

## สิ่งที่เชื่อมใน source

| ส่วน | สถานะใน source |
|---|---|
| Login | อ่าน Users จาก Worker และส่งผู้ใช้ไปตาม Role: Inspector, Supervisor หรือ Admin |
| Session | token แบบ signed session, ตรวจอายุและ role ที่ backend ทุก request |
| Inspector | อ่านรายการตาม Assigned_Type, Assigned_Grade, Assigned_Locations; M.3 เห็น SME ทุกชั้นเฉพาะ CLASSROOM; ZONE ไม่ใช้กฎ SME |
| Inspector submit | ตรวจคะแนน 8 ข้อ, บังคับรูปหลักฐาน, ตรวจสิทธิ์, ตรวจส่งซ้ำตามวัน/position และ append ลง Inspection_Logs |
| Photo | Worker ส่งไป Apps Script Bridge แบบ server-to-server เพื่อบันทึก Drive และเก็บ URL ในชีต |
| Supervisor | endpoint `/supervisor/dashboard` นับรายการเฉพาะสถานที่และชั้นที่ Supervisor มีสิทธิ์ |
| Admin | endpoint `/admin/dashboard` เห็นสรุปทั้งโรงเรียนเฉพาะ Role ADMIN |
| Logout | endpoint `/auth/logout` และล้าง session ฝั่ง browser |
| Static Admin | มี `admin.html` และหน้ารองครบ พร้อม guard ป้องกันผู้ไม่ใช่ Admin |

## จุดสำคัญก่อนใช้งานจริง

`worker-primary-backup-direct-upload.js` เป็น source ที่ต้องนำไป deploy ใน Worker production. หลัง deploy ให้เปิด `GET /__version` และตรวจว่าค่า build เป็น `2026-08-27-integrated-roles-v1` หากยังเห็นค่า `2026-08-26-primary-backup-v2-settings` แปลว่ายังเป็น Worker รุ่นเก่าและ route Supervisor/Admin จะตอบ 404

ใน source ชุดนี้ยังไม่ได้ปิด `TEST_MODE` ให้เอง เพราะการเปลี่ยนค่า environment เป็นการตั้งค่าความปลอดภัยของ production. หลังทดสอบจริงเสร็จต้องตั้ง `TEST_MODE=false` และล้าง `TEST_INSPECTOR_ID` ใน Worker settings

## ผลตรวจในพื้นที่พัฒนา

`pnpm check`, `pnpm build` และ `node --check` ของ Worker ผ่านแล้ว. ตรวจ permission แบบไม่ใช้ token กับ Worker production รุ่นปัจจุบันพบว่า `/inspector/locations` และ `/inspections` ตอบ 401 ตามที่ควร แต่ `/supervisor/dashboard` และ `/admin/dashboard` ยังตอบ 404 เนื่องจาก production ยังไม่ได้รับ source integration รุ่นนี้

ดังนั้นแพ็กเกจนี้พร้อมสำหรับ deploy และการทดสอบ end-to-end แต่ยังไม่ควรรายงานว่า production เชื่อมครบจนกว่าจะตรวจ build marker ใหม่และทดสอบด้วยบัญชีจริงของแต่ละ Role
