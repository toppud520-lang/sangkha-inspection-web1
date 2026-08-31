/* Sangkha Inspection - Worker API (PRIMARY/BACKUP production candidate)
   This file is based on the attached login-only Worker.

   Required variables/secrets:
   SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL,
   GOOGLE_PRIVATE_KEY, SESSION_SECRET, ALLOWED_ORIGIN.

   Primary/backup fields are read from Users.Inspector_Position and Users.Inspector_Status.
   TEST_MODE is read from System_Settings and restricted by TEST_INSPECTOR_ID when configured.
*/
const USERS_SHEET = "Users";
const LOCATIONS_SHEET = "Locations";
const LOGS_SHEET = "Inspection_Logs";
const SETTINGS_SHEET = "System_Settings";
const BUILD_VERSION = "2026-08-27-integrated-roles-v1";
const PAGES_ORIGIN = "https://sangkha-inspection-web.pages.dev";

export default {
  async fetch(request, env) {
    // Keep the existing preview-domain CORS behavior while allowing the production Pages origin.
    const origin = resolveOrigin(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/") return response({ success: true, service: "sangkha-inspection-api", build: BUILD_VERSION }, 200, origin);
      if (request.method === "GET" && url.pathname === "/__version") return response({ success: true, build: BUILD_VERSION }, 200, origin);
      if (request.method === "POST" && url.pathname === "/auth/login") return login(request, env, origin);
      if (request.method === "POST" && url.pathname === "/upload-ticket") return uploadTicket(request, env, origin);
      if (request.method === "GET" && url.pathname === "/auth/session") return session(request, env, origin);
      if (request.method === "POST" && url.pathname === "/auth/logout") return logout(request, env, origin);
      if (request.method === "GET" && url.pathname === "/inspector/me") return inspectorMe(request, env, origin);
      if (request.method === "GET" && url.pathname === "/inspector/locations") return inspectorLocations(request, env, origin);
      if (request.method === "GET" && url.pathname === "/supervisor/dashboard") return supervisorDashboard(request, env, origin);
      if (request.method === "GET" && url.pathname === "/admin/dashboard") return adminDashboard(request, env, origin);
      if (request.method === "POST" && url.pathname === "/inspections") return submitInspection(request, env, origin);
      return response({ success: false, message: "ไม่พบ API ที่ร้องขอ" }, 404, origin);
    } catch (error) {
      console.error(error);
      const message = String(env.DEBUG_ERRORS || '').toLowerCase() === 'true'
        ? `Worker error: ${error?.message || error}`
        : "เกิดข้อผิดพลาดในระบบ";
      return response({ success: false, message, build: BUILD_VERSION }, 500, origin);
    }
  },
};

async function uploadTicket(request, env, origin) {
  const user = await requireUser(request, env);
  if (!user || user.Role !== "INSPECTOR") return response({ success: false, message: "ไม่มีสิทธิ์อัปโหลดรูป" }, 401, origin);
  const secret = String(env.UPLOAD_BRIDGE_SECRET || "").trim();
  if (!secret) return response({ success: false, message: "ยังไม่ได้ตั้งค่า UPLOAD_BRIDGE_SECRET" }, 500, origin);
  return response({ success: true, ticket: await createUploadTicket(user, secret) }, 200, origin);
}

async function login(request, env, origin) {
  const body = await request.json();
  const studentId = String(body?.username || body?.studentId || "").trim();
  const pin = String(body?.password || body?.pin || "").trim();
  if (!studentId || !pin) return response({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, 400, origin);
  const users = await readSheet(env, USERS_SHEET);
  const user = users.find((item) => String(item.Student_ID || "").trim().toLowerCase() === studentId.toLowerCase());
  if (!user) return response({ success: false, message: "ไม่พบชื่อผู้ใช้" }, 401, origin);
  if (pin !== String(user.PIN || "").trim()) return response({ success: false, message: "รหัสผ่านไม่ถูกต้อง" }, 401, origin);
  const cleanUser = { Student_ID: user.Student_ID || "", Full_Name: user.Full_Name || "", Role: String(user.Role || "").trim().toUpperCase(), Assigned_Grade: user.Assigned_Grade || "", Assigned_Type: user.Assigned_Type || "", Assigned_Locations: user.Assigned_Locations || "", Inspector_Position: user.Inspector_Position || "", Inspector_Status: user.Inspector_Status || "" };
  if (!["INSPECTOR", "SUPERVISOR", "ADMIN"].includes(cleanUser.Role)) return response({ success: false, message: "บทบาทผู้ใช้ไม่ถูกต้อง" }, 403, origin);
  const expiresIn = Number(env.SESSION_SECONDS || 21600);
  const token = await sign({ ...cleanUser, exp: Math.floor(Date.now() / 1000) + expiresIn }, env.SESSION_SECRET);
  return response({ success: true, sessionId: token, user: cleanUser, expiresIn }, 200, origin);
}

async function logout(request, env, origin) {
  const user = await requireUser(request, env);
  return user ? response({ success: true, message: "ออกจากระบบแล้ว" }, 200, origin) : response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
}

async function session(request, env, origin) {
  const token = String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const payload = await verify(token, env.SESSION_SECRET);
  return payload ? response({ success: true, sessionId: token, user: publicUser(payload), expiresIn: payload.exp - Math.floor(Date.now() / 1000) }, 200, origin) : response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
}

async function supervisorDashboard(request, env, origin) {
  const user = await requireUser(request, env);
  if (!user) return response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
  if (user.Role !== "SUPERVISOR") return response({ success: false, message: "ไม่มีสิทธิ์ดูแดชบอร์ด Supervisor" }, 403, origin);
  const [locations, logs, users] = await Promise.all([readSheet(env, LOCATIONS_SHEET), readSheet(env, LOGS_SHEET), readSheet(env, USERS_SHEET)]);
  const accessible = locations.filter((location) => canAccessSupervisor(user, location));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const completedLogs = logs.filter((log) => normalizeDate(log.Date, env) === today && accessible.some((location) => normalize(location.Location_ID) === normalize(log.Location_ID)));
  const completedIds = new Set(completedLogs.map((log) => normalize(log.Location_ID)).filter(Boolean));
  const scores = completedLogs.map((log) => scoreAsPercent(log)).filter((value) => Number.isFinite(value));
  const committee = users.filter((item) => normalize(item.Role) === "INSPECTOR" && normalizeGrade(item.Assigned_Grade) === normalizeGrade(user.Assigned_Grade)).length;
  return response({ success: true, completed: completedIds.size, pending: Math.max(0, accessible.length - completedIds.size), committee, average: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0 }, 200, origin);
}

async function adminDashboard(request, env, origin) {
  const user = await requireUser(request, env);
  if (!user) return response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
  if (user.Role !== "ADMIN") return response({ success: false, message: "ไม่มีสิทธิ์ดูแดชบอร์ด Admin" }, 403, origin);
  const [locations, logs, users] = await Promise.all([readSheet(env, LOCATIONS_SHEET), readSheet(env, LOGS_SHEET), readSheet(env, USERS_SHEET)]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const completedLogs = logs.filter((log) => normalizeDate(log.Date, env) === today);
  const completedIds = new Set(completedLogs.map((log) => normalize(log.Location_ID)).filter(Boolean));
  const scores = completedLogs.map((log) => scoreAsPercent(log)).filter((value) => Number.isFinite(value));
  return response({ success: true, completed: completedIds.size, pending: Math.max(0, locations.length - completedIds.size), totalLocations: locations.length, average: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0, users: users.length }, 200, origin);
}

function canAccessSupervisor(user, location) {
  if (user.Role === "ADMIN") return true;
  const type = normalizeType(user.Assigned_Type);
  const rowType = normalizeType(location.Type);
  const grade = normalizeGrade(user.Assigned_Grade);
  const rowGrade = normalizeGrade(location.Grade_Level);
  const allowed = splitList(user.Assigned_Locations);
  if (type !== "ALL" && rowType !== type) return false;
  if (grade !== "ALL" && rowGrade !== grade) return false;
  return allowed.length === 0 || allowed.includes(normalize(location.Location_ID).toLowerCase());
}

function scoreAsPercent(log) {
  const average = Number(log.Average_Score ?? log.AverageScore ?? log.Score_Percent ?? log.ScorePercent);
  if (Number.isFinite(average)) return average <= 1 ? average * 100 : average;
  const total = Number(log.Total_Score ?? log.TotalScore ?? log.Score);
  if (!Number.isFinite(total)) return NaN;
  const type = normalizeType(log.Type || log.Assigned_Type);
  const max = type === "ZONE" ? 110 : 100;
  return (total / max) * 100;
}

async function inspectorMe(request, env, origin) {
  const user = await requireUser(request, env);
  if (!user) return response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
  if (user.Role !== "INSPECTOR") return response({ success: false, message: "ไม่มีสิทธิ์ใช้งาน Inspector" }, 403, origin);
  return response({ success: true, sessionId: getToken(request), user: publicUser(user) }, 200, origin);
}

async function inspectorLocations(request, env, origin) {
  const user = await requireUser(request, env);
  if (!user) return response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
  if (user.Role !== "INSPECTOR") return response({ success: false, message: "ไม่มีสิทธิ์ดูรายการ Inspector" }, 403, origin);
  const locations = await readSheet(env, LOCATIONS_SHEET);
  const logs = await readSheet(env, LOGS_SHEET);
  const users = await readSheet(env, USERS_SHEET);
  const positionByInspector = new Map(users.map((item) => [normalize(item.Student_ID), normalizePosition(item.Inspector_Position)]));
  const allowed = splitList(user.Assigned_Locations);
  const grade = normalizeGrade(user.Assigned_Grade);
  const type = normalizeType(user.Assigned_Type);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const completed = new Map();
  for (const log of logs) {
    const date = normalizeDate(log.Date, env);
    const id = String(log.Location_ID || "").trim();
    if (date === today && id && sameInspectorPosition(log, user, positionByInspector)) completed.set(id, Number(log.Total_Score ?? log.Score ?? log.TotalScore));
  }
  const isM3 = grade === "3";
  const result = locations.filter((row) => {
    const id = String(row.Location_ID || "").trim();
    if (!id) return false;
    const rowGrade = normalizeGrade(row.Grade_Level);
    const rowType = normalizeType(row.Type);
    const isSME = ["TRUE", "1", "YES", "ใช่"].includes(String(row.Is_SME || "").trim().toUpperCase());

    // SME is a classroom-only exception for Inspector M.3.
    if (type === "CLASSROOM") {
      if (isM3 && isSME) return true;
      if (isSME) return false;
      return rowType === "CLASSROOM" && rowGrade === grade && (allowed.length === 0 || allowed.includes(id.toLowerCase()));
    }

    // ZONE never uses SME logic.
    if (type === "ZONE") {
      return rowType === "ZONE" && (grade === "ALL" || rowGrade === grade) && (allowed.length === 0 || allowed.includes(id.toLowerCase()));
    }

    return rowType === type && (grade === "ALL" || rowGrade === grade) && (allowed.length === 0 || allowed.includes(id.toLowerCase()));
  }).map((row) => {
    const id = String(row.Location_ID || "").trim();
    const score = completed.has(id) ? completed.get(id) : null;
    const isSME = ["TRUE", "1", "YES", "ใช่"].includes(String(row.Is_SME || "").trim().toUpperCase());
    return { Location_ID: id, Location_Name: String(row.Location_Name || "").trim(), Grade_Level: row.Grade_Level || "", Type: normalizeType(row.Type), Is_SME: isSME, Completed: completed.has(id), Score: Number.isFinite(score) ? score : null };
  });
  const scores = result.map((row) => row.Score).filter((value) => Number.isFinite(value));
  const averageScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;
  return response({ success: true, locations: result, averageScore }, 200, origin);
}

async function submitInspection(request, env, origin) {
  const user = await requireUser(request, env);
  if (!user) return response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
  if (user.Role !== "INSPECTOR") return response({ success: false, message: "ไม่มีสิทธิ์ส่งผลตรวจในฐานะ Inspector" }, 403, origin);

  const body = await request.json();
  const locationId = String(body?.locationId || body?.Location_ID || "").trim();
  const scores = Array.isArray(body?.scores) ? body.scores.map(Number) : [];
  const remark = String(body?.remark || "").trim();
  const photoData = body?.photoData;
  let photoUrl = String(body?.photoUrl || "").trim();
  if (!photoUrl && (!photoData || typeof photoData !== "object" || !photoData.base64)) {
    return response({ success: false, message: "กรุณาแนบรูปหลักฐานก่อนส่งผลตรวจ" }, 400, origin);
  }

  // The original form has eight criteria; max scores differ by CLASSROOM and ZONE, and 0 is valid.
  if (!locationId || scores.length !== 8 || scores.some((score) => !Number.isInteger(score) || score < 0 || score > 20)) {
    return response({ success: false, message: "ข้อมูลคะแนนไม่ถูกต้อง ต้องมีคะแนน 8 ข้อ และแต่ละข้ออยู่ระหว่าง 0–20" }, 400, origin);
  }

  const locations = await readSheet(env, LOCATIONS_SHEET);
  const location = locations.find((item) => String(item.Location_ID || "").trim().toLowerCase() === locationId.toLowerCase());
  if (!location || !canAccess(user, location)) return response({ success: false, message: "ไม่มีสิทธิ์ตรวจพื้นที่นี้" }, 403, origin);
  const maxScores = normalizeType(location.Type) === "ZONE" ? [20, 15, 15, 10, 10, 10, 10, 10] : [15, 15, 10, 10, 10, 10, 15, 15];
  if (scores.some((score, index) => score > maxScores[index])) {
    return response({ success: false, message: `คะแนนไม่ตรงกับเกณฑ์ของ ${normalizeType(location.Type) === "ZONE" ? "เขตพื้นที่" : "ห้องเรียน"}` }, 400, origin);
  }

  let start = "15:00";
  let end = "18:00";
  let sheetTestMode = false;
  try {
    const settings = await readInspectionSettings(env);
    start = settings.start;
    end = settings.end;
    sheetTestMode = settings.testMode;
  } catch (error) {
    console.warn("System_Settings unavailable; using default inspection window", error);
  }

  const now = new Date();
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);

  const secretTestMode = String(env.TEST_MODE || "").trim().toLowerCase() === "true";
  const testInspectorId = normalize(env.TEST_INSPECTOR_ID);
  const authorizedTestSubmission = sheetTestMode || (secretTestMode && (!testInspectorId || normalize(user.Student_ID) === testInspectorId));
  if (!authorizedTestSubmission && (hhmm < start || hhmm >= end)) {
    return response({ success: false, message: `เปิดให้ส่งผลตรวจเวลา ${start}–${end} เท่านั้น` }, 403, origin);
  }

  const logs = await readSheet(env, LOGS_SHEET);
  const users = await readSheet(env, USERS_SHEET);
  const positionByInspector = new Map(users.map((item) => [normalize(item.Student_ID), normalizePosition(item.Inspector_Position)]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
  const duplicate = logs.some((log) => normalizeDate(log.Date, env) === today && String(log.Location_ID || "").trim().toLowerCase() === locationId.toLowerCase() && sameInspectorPosition(log, user, positionByInspector));
  if (duplicate) return response({ success: false, message: "รายการนี้ถูกบันทึกแล้วในวันนี้" }, 409, origin);

  if (!photoUrl && photoData && typeof photoData === "object" && photoData.base64) {
    photoUrl = await uploadPhotoToBridge(photoData, user, env);
  }

  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const row = [crypto.randomUUID(), today, bangkokTime(), locationId, user.Student_ID, ...scores, totalScore, photoUrl, remark, false, user.Student_ID];
  await appendRow(env, LOGS_SHEET, row);
  return response({ success: true, message: "บันทึกผลตรวจเรียบร้อย", logId: row[0] }, 200, origin);
}

function canAccess(user, location) {
  if (user.Role === "ADMIN") return true;
  const locationId = String(location.Location_ID || "").trim().toLowerCase();
  const allowed = splitList(user.Assigned_Locations);
  const grade = normalizeGrade(user.Assigned_Grade);
  const type = normalizeType(user.Assigned_Type);
  const rowGrade = normalizeGrade(location.Grade_Level);
  const rowType = normalizeType(location.Type);
  const sme = isTrue(location.Is_SME);

  // CLASSROOM: M.3 sees every SME room; other grades see only non-SME rooms on their grade.
  if (type === "CLASSROOM" || (type === "ALL" && rowType === "CLASSROOM")) {
    if (rowType !== "CLASSROOM") return false;
    if (sme) return grade === "3";
    return grade !== "ALL" && grade === rowGrade && (allowed.length === 0 || allowed.includes(locationId));
  }

  // ZONE never uses SME logic.
  if (type === "ZONE") {
    return rowType === "ZONE" && (grade === "ALL" || grade === rowGrade) && (allowed.length === 0 || allowed.includes(locationId));
  }

  return rowType === type && (grade === "ALL" || grade === rowGrade) && (allowed.length === 0 || allowed.includes(locationId));
}

async function requireUser(request, env) {
  const payload = await verify(getToken(request), env.SESSION_SECRET);
  return payload ? publicUser(payload) : null;
}
function getToken(request) { return String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim(); }
function splitList(value) { return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean); }
function normalizeGrade(value) { const text = String(value || "").trim().toUpperCase().replace(/\s+/g, ""); if (!text || text === "ALL") return "ALL"; const cleaned = text.replace(/^ม\./, "").replace(/^ม/, "").replace(/^M\./, "").replace(/^M/, ""); const number = Number(cleaned); return Number.isFinite(number) ? String(number) : text; }
function normalizeType(value) { const text = String(value || "").trim().toUpperCase(); if (!text || text === "ALL") return "ALL"; if (["AREA", "ZONE", "ZONE_AREA", "เขต", "เขตพื้นที่"].includes(text)) return "ZONE"; if (["ROOM", "CLASS", "CLASSROOM", "ห้อง", "ห้องเรียน"].includes(text)) return "CLASSROOM"; return text; }
function normalize(value) { return String(value || "").trim().toUpperCase(); }
function normalizePosition(value) { const text = String(value || "").trim(); return /^\d+$/.test(text) ? String(Number(text)) : normalize(text); }
function isTrue(value) { return ["TRUE", "1", "YES", "Y", "ใช่"].includes(normalize(value)); }
function isEnabled(value) { return isTrue(value); }
function normalizeTimeWindow(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const clock = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (clock) return `${String(Number(clock[1])).padStart(2, "0")}:${clock[2]}`;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial >= 0 && serial < 1) return normalizeTimeWindow(serial, fallback);
  }
  return fallback;
}
async function readInspectionSettings(env) {
  const rows = await readSheet(env, SETTINGS_SHEET);
  const row = rows[0] || {};
  const start = normalizeTimeWindow(row.Active_Window_Start, "15:00");
  const end = normalizeTimeWindow(row.Active_Window_End, "18:00");
  return { start, end, testMode: isEnabled(row.TEST_MODE) };
}
function sameInspectorPosition(log, user, positionByInspector) { const current = normalizePosition(user.Inspector_Position); const logged = normalizePosition(log.Inspector_Position || positionByInspector.get(normalize(log.Inspector_ID))); if (current && logged) return current === logged; return normalize(log.Inspector_ID) === normalize(user.Student_ID); }
function normalizeDate(value, env) { if (!value) return ""; const raw = String(value).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10); const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date); }
function bangkokTime() { return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); }

async function readSheet(env, sheetName) {
  const token = await googleToken(env);
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const result = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!result.ok) throw new Error(`Sheets read failed: ${result.status}`);
  const data = await result.json();
  const rows = data.values || [];
  if (!rows.length) return [];
  const headers = rows[0].map((value) => String(value || "").trim());
  return rows.slice(1).filter((row) => row.some((value) => String(value || "").trim())).map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ""])));
}

async function uploadPhotoToBridge(photoData, user, env) {
  const bridgeUrl = String(env.UPLOAD_BRIDGE_URL || "").trim();
  const bridgeSecret = String(env.UPLOAD_BRIDGE_SECRET || "").trim();
  if (!bridgeUrl || !bridgeSecret) throw new Error("ยังไม่ได้ตั้งค่า UPLOAD_BRIDGE_URL หรือ UPLOAD_BRIDGE_SECRET ใน Worker");

  const raw = String(photoData?.base64 || "").trim();
  const mimeType = String(photoData?.mimeType || "image/jpeg").trim();
  const normalizedPhoto = { ...photoData, base64: raw.startsWith("data:") ? raw : `data:${mimeType};base64,${raw}`, mimeType };
  const ticket = await createUploadTicket(user, bridgeSecret);
  const payload = JSON.stringify({ ticket, photoData: normalizedPhoto });
  const bridgeHeaders = { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" };
  let bridgeResponse = await fetch(bridgeUrl, {
    method: "POST",
    headers: bridgeHeaders,
    body: new URLSearchParams({ payload }).toString(),
    redirect: "follow"
  });

  // Apps Script Web Apps may redirect the initial POST to a googleusercontent.com URL.
  // Fetch follows the redirect itself; do not manually replay the POST because that can
  // trigger Cloudflare Worker error 1101 and duplicate the upload request.

  const bridgeBody = await bridgeResponse.json().catch(() => ({}));
  if (!bridgeResponse.ok || bridgeBody.success !== true || !bridgeBody.url) {
    throw new Error(`Upload bridge failed: ${bridgeBody.message || bridgeResponse.status}`);
  }
  return String(bridgeBody.url); 
}

async function createUploadTicket(user, secret) {
  const payload = b64(JSON.stringify({ user: user.Student_ID, exp: Math.floor(Date.now() / 1000) + 300, nonce: crypto.randomUUID() }));
  const key = await hmacKey(secret, "sign");
  const signature = b64Bytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
  return `${payload}.${signature}`;
}

async function appendRow(env, sheetName, row) {
  const token = await googleToken(env);
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const result = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }) });
  if (!result.ok) throw new Error(`Sheets append failed: ${result.status}`);
  return result.json();
}

async function googleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // Write access is required temporarily because submitInspection appends to Inspection_Logs.
  // Worker only writes Sheets now; the school account writes Drive via Apps Script bridge.
  const claim = b64(JSON.stringify({ iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const assertion = `${header}.${claim}.${await rsa(`${header}.${claim}`, env.GOOGLE_PRIVATE_KEY)}`;
  const result = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}` });
  if (!result.ok) throw new Error("Google token request failed");
  return (await result.json()).access_token;
}

async function rsa(value, pem) {
  const normalized = String(pem || "").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  const clean = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return b64Bytes(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(value))));
}

async function sign(payload, secret) { const body = b64(JSON.stringify(payload)); const key = await hmacKey(secret, "sign"); return `${body}.${b64Bytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))))}`; }
async function verify(token, secret) { try { const [body, sig] = String(token || "").split("."); const key = await hmacKey(secret, "verify"); const ok = await crypto.subtle.verify("HMAC", key, fromB64(sig), new TextEncoder().encode(body)); const payload = JSON.parse(new TextDecoder().decode(fromB64(body))); return ok && payload.exp > Math.floor(Date.now() / 1000) ? payload : null; } catch { return null; } }
async function hmacKey(secret, usage) { return crypto.subtle.importKey("raw", new TextEncoder().encode(String(secret || "")), { name: "HMAC", hash: "SHA-256" }, false, [usage]); }
  function publicUser(user) { return { Student_ID: user.Student_ID || "", Full_Name: user.Full_Name || "", Role: user.Role || "", Assigned_Grade: user.Assigned_Grade || "", Assigned_Type: user.Assigned_Type || "", Assigned_Locations: user.Assigned_Locations || "", Inspector_Position: user.Inspector_Position || "", Inspector_Status: user.Inspector_Status || "" }; }
function b64(value) { return b64Bytes(new TextEncoder().encode(value)); }
function b64Bytes(bytes) { let binary = ""; bytes.forEach((byte) => binary += String.fromCharCode(byte)); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromB64(value) { const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/"); const padding = normalized.length % 4 === 2 ? "==" : normalized.length % 4 === 3 ? "=" : ""; return Uint8Array.from(atob(normalized + padding), (c) => c.charCodeAt(0)); }
function resolveOrigin(request, env) {
  const requestOrigin = String(request.headers.get("Origin") || "").trim().replace(/\/$/, "");
  const configured = String(env.ALLOWED_ORIGIN || "").trim().replace(/\/$/, "");
  const allowed = configured ? configured.split(",").map((item) => item.trim().replace(/\/$/, "")).filter(Boolean) : [];
  const pagesOrigin = "https://sangkha-inspection-web.pages.dev";
  const isProjectPagesOrigin = requestOrigin === pagesOrigin || /^https:\/\/[-a-z0-9]+\.sangkha-inspection-web\.pages\.dev$/i.test(requestOrigin);
  if (isProjectPagesOrigin) return requestOrigin || pagesOrigin;
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return pagesOrigin;
}
function cors(origin) { return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "Content-Type", Vary: "Origin" }; }
function response(body, status, origin) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) } }); }
