import fs from "node:fs";

const source = fs.readFileSync(new URL("./worker-primary-backup-direct-upload.js", import.meta.url), "utf8").replace("export default {", "const workerDefault = {");
const functions = new Function(`${source}\nreturn { canAccess, sameInspectorPosition, normalizeGrade, normalizeType };`)();
const { canAccess, sameInspectorPosition } = functions;

const normal = (grade) => ({ Location_ID: `M${grade}-02`, Grade_Level: String(grade), Type: "CLASSROOM", Is_SME: "FALSE" });
const sme = (grade) => ({ Location_ID: `M${grade}-01`, Grade_Level: String(grade), Type: "CLASSROOM", Is_SME: "TRUE" });
const zone = (grade) => ({ Location_ID: `Z${grade}-01`, Grade_Level: String(grade), Type: "ZONE", Is_SME: "FALSE" });
const classroom = (grade, position = "1") => ({ Role: "INSPECTOR", Assigned_Grade: String(grade), Assigned_Type: "CLASSROOM", Inspector_Position: position });
const zoneInspector = (grade) => ({ Role: "INSPECTOR", Assigned_Grade: String(grade), Assigned_Type: "ZONE" });

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(canAccess(classroom(1), normal(1)) && !canAccess(classroom(1), normal(2)), "ม.1 ต้องเห็นเฉพาะห้องปกติ ม.1");
assert(!canAccess(classroom(1), sme(1)) && canAccess(classroom(3), sme(1)) && canAccess(classroom(3), sme(6)), "ม.3 ต้องเห็น SME ทุกชั้น แต่ม.1 ต้องไม่เห็น SME");
assert(canAccess(classroom(3), normal(3)) && !canAccess(classroom(3), normal(2)), "ม.3 ต้องเห็นห้องปกติของตนเองเท่านั้น");
assert(canAccess(zoneInspector(1), zone(1)) && !canAccess(zoneInspector(1), zone(2)) && !canAccess(zoneInspector(1), normal(1)), "ZONE ต้องกรองตามชั้นและไม่ปน CLASSROOM");
const positionByInspector = new Map([["PRIMARY01", "4"], ["BACKUP01", "4"]]);
assert(sameInspectorPosition({ Inspector_ID: "PRIMARY01" }, { Student_ID: "BACKUP01", Inspector_Position: "4" }, positionByInspector), "PRIMARY/BACKUP ตำแหน่งเดียวกันต้องถูกมองว่าเป็นรายการซ้ำ");
assert(!sameInspectorPosition({ Inspector_ID: "PRIMARY01" }, { Student_ID: "BACKUP01", Inspector_Position: "5" }, positionByInspector), "คนละตำแหน่งต้องไม่ถูกมองว่าเป็นรายการซ้ำ");
console.log("PRIMARY/BACKUP smoke tests: PASS");
