# ชุดโค้ด Sangkha Inspection สำหรับนำไปวาง

## สถานะงาน

หน้า Supervisor ถูกปรับจากโครงสร้างเดิมให้แสดงได้ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์แล้ว โดยยังคงธีม สี ฟอนต์ โลโก้ การ์ดสถิติ และเมนูเดิมไว้ หน้าใหม่นี้เป็น **UI-only mock** ตามที่กำหนด ยังไม่เรียก Google Sheets, Worker หรือ Google Apps Script และจะแสดงข้อมูลตัวอย่างอย่างชัดเจน

ส่วน Worker ถูกแก้ใน source ที่ส่งมอบแล้ว โดยเปลี่ยนคำสั่งส่งไปยัง Upload Bridge จากค่า typo `method: "ฟPOST"` เป็น `method: "POST"` และใช้ `redirect: "follow"` โดยไม่ replay POST ซ้ำไปยัง URL redirect

จากการตรวจ production ล่าสุด ระบบ Worker ที่ออนไลน์ยังตอบ Cloudflare `error code: 1101` เมื่อทดสอบอัปโหลด และ `Z1-01` ยังไม่เป็น Completed ดังนั้นยังไม่ควรถือว่าการอัปโหลดรูปและการเขียน `Inspection_Logs` ผ่าน end-to-end จนกว่า source Worker ที่แก้จะถูก deploy ใน production จริง

## ไฟล์สำคัญ

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `supervisor-mock-responsive.html` | หน้า Supervisor แบบ mock ที่แก้ responsive แล้ว ใช้แทน `supervisor.html` |
| `worker-primary-backup-direct-upload.js` | Worker source ที่แก้ method POST และ redirect แล้ว |
| `apps-script-direct-upload.gs` | Apps Script Bridge สำหรับบันทึกรูปลง Google Drive |
| `app-config.js` | Worker URL ของระบบ |
| `api-client.js` | compatibility bridge ของหน้าเดิม |

## สิ่งที่แก้ในหน้า Supervisor

หน้าเดิมมี `md:hidden` ทำให้เนื้อหาหลักหายบนจอ desktop และแสดงข้อความ “Please view on a mobile device.” แทน จึงนำ mobile-only restriction ออก เปลี่ยนเนื้อหาเป็น container ที่มีความกว้างเหมาะสม เพิ่ม responsive statistics เป็น 2 คอลัมน์บนมือถือและ 4 คอลัมน์ตั้งแต่จอเล็กขึ้นไป และเปลี่ยนเมนูหลักเป็น 1 คอลัมน์บนมือถือ, 2 คอลัมน์บนจอขนาดกลาง และ 3 คอลัมน์บน desktop

โค้ด `google.script.run.getSupervisorDashboard(...)` ถูกถอดออกจากหน้า mock เพื่อไม่ให้เกิด error ในช่วงที่ยังไม่ได้เชื่อมข้อมูล ปุ่มเมนู ปุ่มสถิติ และปุ่มออกจากระบบจะแสดงข้อความว่าเป็นโหมดตัวอย่างแทน

## วิธีนำไปวาง

ให้ใช้ไฟล์ `supervisor-mock-responsive.html` แทนไฟล์ `supervisor.html` เดิมในชุด frontend และให้คงไฟล์ `app-config.js`, `api-client.js` และไฟล์ assets ที่หน้าเดิมใช้อยู่ไว้ด้วย

สำหรับ Worker ให้ใช้ไฟล์ `worker-primary-backup-direct-upload.js` แทน source เดิมทั้งไฟล์ ตรวจสอบค่าตัวแปรและ secrets เดิมให้ครบก่อน deploy โดยเฉพาะ `UPLOAD_BRIDGE_URL`, `UPLOAD_BRIDGE_SECRET`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `SPREADSHEET_ID`, `SESSION_SECRET` และ `TEST_MODE`

หลัง deploy ควรตรวจตามลำดับ: เรียก `/__version`, อ่านสถานะ `Z1-01`, ส่งรูปพร้อมคะแนนครบเพียงครั้งเดียว, ตรวจแถวใหม่ใน `Inspection_Logs`, และตรวจไฟล์รูปใน Google Drive จากนั้นจึงปิด `TEST_MODE` และล้าง `TEST_INSPECTOR_ID`

> หมายเหตุ: ผมไม่ได้สร้าง checkpoint ตามที่คุณกำหนดไว้ก่อนหน้านี้ และไม่ได้ลบหรือแก้ข้อมูลจริงใน Google Sheets หรือ Google Drive
