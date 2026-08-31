# Sangkha Inspection Migration Package

## เป้าหมาย

แพ็กเกจนี้มีไว้สำหรับย้ายระบบเดิมจาก Google Apps Script ไปยังระบบใหม่ โดยคงโครงสร้างหน้าจอเดิมจาก `index.html`, `login.html`, `inspector.html` และ `supervisor.html` ไว้ การย้ายจะเปลี่ยนเฉพาะวิธีเรียก backend จาก `google.script.run` เป็น `fetch()` ไปยัง API ของระบบใหม่

## สิ่งที่ยังไม่ควรทำ

ยังไม่ควรนำโค้ดนี้ไปวางทับระบบจริง และยังไม่ควรเชื่อมกับ Google Sheets ที่มีข้อมูลจริงจนกว่าจะตรวจ schema และทดสอบสิทธิ์ด้วยข้อมูลสำเนาแล้ว

## โครงสร้างปลายทางที่แนะนำ

```text
sangkha-inspection-migration/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── inspector.html
│   ├── supervisor.html
│   ├── api-client.js
│   └── app-config.js
└── worker-api/
    ├── src/index.js
    ├── src/auth.js
    ├── src/permissions.js
    ├── src/sheets.js
    └── wrangler.toml
```

## ตำแหน่งวางไฟล์

| ไฟล์ | ตำแหน่งในระบบใหม่ | หน้าที่ |
|---|---|---|
| `index.html` | `frontend/index.html` | หน้าเริ่มต้น/หน้าสรุปเดิม |
| `login.html` | `frontend/login.html` | หน้าเข้าสู่ระบบเดิม |
| `inspector.html` | `frontend/inspector.html` | หน้าผู้ตรวจเดิม |
| `supervisor.html` | `frontend/supervisor.html` |หน้าผู้ดูแลชั้นเดิม |
| `api-client.js` | `frontend/api-client.js` | ตัวแทนของ `google.script.run` |
| `app-config.js` | `frontend/app-config.js` | เก็บเฉพาะ URL API สาธารณะ ห้ามเก็บ secret |
| `worker-api/*` | โปรเจกต์ Cloudflare Workers | ตรวจ login, session, role, floor, zone และอ่าน/เขียน Google Sheets |
| `code.gs` | ไม่ต้องวางใน Cloudflare Pages | ใช้อ้างอิง logic เดิม แล้วแปลงเป็น Workers ไม่ใช่คัดลอกไปวางตรง ๆ |

## การจับคู่ฟังก์ชันเดิมกับ API ใหม่

| Apps Script เดิม | API ใหม่ |
|---|---|
| `verifyLogin(studentId, pin)` | `POST /auth/login` |
| `getSession(sessionId)` | `GET /auth/session` |
| `logout(sessionId)` | `POST /auth/logout` |
| `getInspectorLocations(sessionId)` | `GET /inspector/locations` |
| `getInspectorData(sessionId)` | `GET /inspector/me` |
| `submitInspection(...)` | `POST /inspections` |
| `getSupervisorDashboard(user)` | `GET /supervisor/dashboard` |

## หลักการความปลอดภัย

หน้าเว็บส่ง session token ไปยัง API เท่านั้น หน้าเว็บห้ามอ่าน Google Sheets โดยตรง และห้ามฝัง Google API key หรือ service-account private key ใน HTML/JavaScript ฝั่งหน้าเว็บ API ต้องตรวจสิทธิ์จาก session และอ่านค่า `role`, `Assigned_Grade`, `Assigned_Type` และ `Assigned_Locations` จากข้อมูลที่ตรวจสอบแล้ว ไม่เชื่อค่าที่ผู้ใช้แก้จาก browser

## วิธีวาง Worker API

ไฟล์ `worker-api/worker.js` เป็นโค้ด Worker แบบไฟล์เดียวสำหรับวางในหน้า **Edit code** ของ Worker ที่สร้างไว้แล้ว ให้เปิดไฟล์เดิม `worker.js` ใน Cloudflare กดเลือกทั้งหมด ลบ แล้ววางเนื้อหาจากไฟล์นี้ จากนั้นกด **Deploy**

ก่อนทดสอบจริง ให้ไปที่ Worker → **Settings** → **Variables and Secrets** และเพิ่มค่าต่อไปนี้เป็น Secret หรือ Environment Variable ตามที่ระบุ:

| ชื่อ | ประเภท | ค่า |
|---|---|---|
| `SPREADSHEET_ID` | Variable | รหัสไฟล์ Google Sheets |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Secret | อีเมล service account ของ Google Cloud |
| `GOOGLE_PRIVATE_KEY` | Secret | private key ของ service account |
| `SESSION_SECRET` | Secret | สุ่มข้อความยาวอย่างน้อย 32 ตัวอักษร |
| `ALLOWED_ORIGIN` | Variable | URL ของเว็บ Pages หลังสร้างเสร็จ |
| `SESSION_SECONDS` | Variable | `21600` |

ต้องแชร์ Google Sheets ให้ `GOOGLE_SERVICE_ACCOUNT_EMAIL` มีสิทธิ์ **Editor** ก่อน API จึงจะอ่านและเขียนข้อมูลได้ ห้ามใส่ private key ใน HTML, JavaScript หน้าเว็บ, GitHub หรือช่องแชต

## สถานะงานปัจจุบัน

ไฟล์ต้นฉบับถูกเก็บไว้ที่ `migration/original-ui/` และหน้าเดิมถูกคัดลอกไว้ที่ `migration/frontend/` โค้ด Worker รุ่นแรกอยู่ที่ `migration/worker-api/worker.js` และทำ endpoint สำหรับ login, session, อ่านงาน Inspector, Dashboard Supervisor และบันทึกผลตรวจแล้ว โดยยังต้องทดสอบกับ Worker จริงและควรปรับการเก็บ PIN เป็น hash ก่อน production
