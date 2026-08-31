# ชุดหน้า Admin แบบ mock

ชุดนี้ยึดโครงสร้างจากหน้า **Main Menu** และ **Admin Dashboard** ที่ผู้ใช้แนบมา โดยคงแนวทางภาพรวมเดิม ได้แก่ header ตรึงด้านบน, โลโก้โรงเรียน, โทนแดง primary, พื้นผิวขาว/ฟ้าอ่อน, ฟอนต์ Kanit สำหรับหัวข้อ และ Sarabun สำหรับเนื้อหา

## ไฟล์ในชุด

| ไฟล์ | หน้าที่ |
|---|---|
| `admin-main.html` | หน้าเมนูหลัก Admin พร้อม 14 โมดูลและ Master Override |
| `admin-dashboard.html` | Dashboard ภาพรวม metrics, progress ห้องเรียน/เขตพื้นที่, ranking และ quick actions |
| `admin-inspection.html` | จัดการการตรวจ |
| `admin-ranking.html` | การจัดอันดับ |
| `admin-users.html` | จัดการผู้ใช้ |
| `admin-locations.html` | จัดการสถานที่ |
| `admin-approval.html` | ศูนย์อนุมัติ |
| `admin-maintenance.html` | ระบบแจ้งซ่อม |
| `admin-attendance.html` | ติดตามการเช็กชื่อ |
| `admin-proxy.html` | การตรวจแทน |
| `admin-alerts.html` | การแจ้งเตือน |
| `admin-audit-log.html` | ประวัติการใช้งาน |
| `admin-reports.html` | การออกรายงาน |
| `admin-calendar.html` | จัดการปฏิทิน |
| `admin-settings.html` | ตั้งค่าระบบ |

ทุกหน้าเป็น standalone HTML และเชื่อมเมนูถึงกันด้วยลิงก์ไฟล์ตรง ๆ จึงนำไปวางในโฟลเดอร์ frontend เดิมได้ทันที ปุ่มและรายการที่เป็นการกระทำจะแสดงข้อความ mock เพื่อไม่ให้เกิดการเขียนข้อมูลจริงในช่วงออกแบบ

## Responsive

หน้า Main Menu ใช้ 2 คอลัมน์บนมือถือ, 3 คอลัมน์บนแท็บเล็ต และ 5 คอลัมน์บน desktop. หน้า Dashboard และหน้าจัดการใช้ grid ที่ปรับจาก 2 คอลัมน์บนมือถือเป็น 4 คอลัมน์บน desktop พร้อม layout แบบคอลัมน์คู่เมื่อมีพื้นที่เพียงพอ จึงไม่มีการซ่อนเนื้อหาบน desktop หรือบังคับให้เปิดเฉพาะมือถือ

## การเชื่อมข้อมูลในอนาคต

ชุดนี้ยังไม่เรียก Google Sheets, Worker หรือ Google Apps Script. เมื่อต้องเชื่อมระบบจริง ให้แทน mock arrays และ handler ในแต่ละหน้าโดยคง markup และ class responsive เดิมไว้ เพื่อให้ logic เปลี่ยนได้โดยไม่ต้องออกแบบ UI ใหม่
