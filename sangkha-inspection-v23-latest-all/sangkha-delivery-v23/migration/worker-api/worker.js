/*
 Sangkha Inspection Worker API
 Migration from Google Apps Script code.gs.
 Paste this file into Cloudflare Worker after adding the required secrets.
 No real credentials are included in this file.
*/

const SHEETS = {
  USERS: "Users",
  LOCATIONS: "Locations",
  LOGS: "Inspection_Logs",
  SETTINGS: "System_Settings",
};

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    try {
      const url = new URL(request.url);
      const result = await route(request, url, env);
      return json(result.body, result.status || 200, origin);
    } catch (error) {
      console.error(error);
      return json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" }, 500, origin);
    }
  },
};

async function route(request, url, env) {
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "GET" && path === "/") return { body: { success: true, service: "sangkha-inspection-api" } };
  if (request.method === "POST" && path === "/auth/login") return login(await request.json(), env);
  if (request.method === "GET" && path === "/auth/session") return withSession(request, env, (session) => ({ body: { success: true, sessionId: bearer(request), user: publicUser(session), expiresIn: session.exp - Math.floor(Date.now() / 1000) } }));
  if (request.method === "POST" && path === "/auth/logout") return { body: { success: true } };
  if (request.method === "GET" && path === "/inspector/me") return withRole(request, env, ["INSPECTOR"], async (session) => ({ body: { success: true, user: publicUser(session) } }));
  if (request.method === "GET" && path === "/inspector/locations") return withRole(request, env, ["INSPECTOR"], async (session) => inspectorLocations(session, env));
  if (request.method === "GET" && path === "/supervisor/dashboard") return withRole(request, env, ["SUPERVISOR", "ADMIN"], async (session) => supervisorDashboard(session, env));
  if (request.method === "POST" && path === "/inspections") return withRole(request, env, ["INSPECTOR"], async (session) => submitInspection(session, await request.json(), env));
  return { status: 404, body: { success: false, message: "ไม่พบ API ที่ร้องขอ" } };
}

async function login(body, env) {
  const username = String(body?.username || body?.studentId || "").trim().toLowerCase();
  const password = String(body?.password || body?.pin || "").trim();
  if (!username || !password) return { status: 400, body: { success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" } };
  const users = await readObjects(env, SHEETS.USERS);
  const user = users.find((item) => String(item.Student_ID || "").trim().toLowerCase() === username);
  if (!user) return { status: 401, body: { success: false, message: "ไม่พบผู้ใช้งาน" } };
  // The legacy sheet uses PIN. Replace this comparison with hash verification before production.
  if (password !== String(user.PIN || "").trim()) return { status: 401, body: { success: false, message: "รหัสผ่านไม่ถูกต้อง" } };
  const role = String(user.Role || "").trim().toUpperCase();
  if (!["INSPECTOR", "SUPERVISOR", "ADMIN"].includes(role)) return { status: 403, body: { success: false, message: "บทบาทผู้ใช้ไม่ถูกต้อง" } };
  const session = { ...publicUser({ ...user, Role: role }), exp: Math.floor(Date.now() / 1000) + Number(env.SESSION_SECONDS || 21600) };
  const sessionId = await signToken(session, env.SESSION_SECRET);
  return { body: { success: true, sessionId, user: publicUser(session), expiresIn: Number(env.SESSION_SECONDS || 21600) } };
}

async function inspectorLocations(session, env) {
  const locations = await readObjects(env, SHEETS.LOCATIONS);
  const logs = await readObjects(env, SHEETS.LOGS);
  const users = await readObjects(env, SHEETS.USERS);
  const assigned = splitIds(session.Assigned_Locations);
  const today = todayBangkok();
  const positionByInspector = new Map(users.map((user) => [normalize(user.Student_ID), normalizePosition(user.Inspector_Position)]));
  const currentPosition = normalizePosition(session.Inspector_Position);
  const visible = locations.filter((location) => canAccess(session, location) && (!assigned.length || assigned.includes(normalize(location.Location_ID))));
  return { body: { success: true, locations: visible.map((location) => {
    const log = logs.find((item) => String(item.Date) === today && normalize(item.Location_ID) === normalize(location.Location_ID) && sameInspectorPosition(item, session, positionByInspector));
    return { id: location.Location_ID, label: location.Location_Name, type: String(location.Type || "CLASSROOM").toUpperCase(), floor: String(location.Grade_Level || ""), isSME: isTrue(location.Is_SME), status: log ? "completed" : "pending", score: log ? Number(log.Total_Score || 0) : undefined, inspectorPosition: currentPosition || undefined };
  }) } };
}

async function supervisorDashboard(session, env) {
  const locations = await readObjects(env, SHEETS.LOCATIONS);
  const logs = await readObjects(env, SHEETS.LOGS);
  const today = todayBangkok();
  const visibleLocations = locations.filter((location) => session.Role === "ADMIN" || canAccess(session, location));
  const visibleIds = new Set(visibleLocations.map((item) => normalize(item.Location_ID)));
  const todayLogs = logs.filter((log) => String(log.Date) === today && visibleIds.has(normalize(log.Location_ID)));
  const scores = todayLogs.map((log) => Number(log.Total_Score || 0)).filter(Number.isFinite);
  return { body: { success: true, completed: todayLogs.length, pending: Math.max(0, visibleLocations.length - todayLogs.length), committee: new Set(todayLogs.map((log) => log.Inspector_ID)).size, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 } };
}

async function submitInspection(session, body, env) {
  const locationId = String(body?.locationId || "").trim();
  const photoUrl = String(body?.photoUrl || "").trim();
  const scores = Array.isArray(body?.scores) ? body.scores.map(Number) : [];
  if (!locationId || scores.length !== 8 || scores.some((score) => !Number.isInteger(score) || score < 1 || score > 15)) return { status: 400, body: { success: false, message: "ข้อมูลคะแนนไม่ถูกต้อง" } };
  if (!photoUrl) return { status: 400, body: { success: false, message: "กรุณาแนบรูปหลักฐานก่อนส่งผลตรวจ" } };
  const locations = await readObjects(env, SHEETS.LOCATIONS);
  const location = locations.find((item) => normalize(item.Location_ID) === normalize(locationId));
  if (!location || !canAccess(session, location)) return { status: 403, body: { success: false, message: "ไม่มีสิทธิ์ตรวจพื้นที่นี้" } };
  const settings = (await readObjects(env, SHEETS.SETTINGS))[0] || {};
  const now = new Date();
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const start = String(settings.Active_Window_Start || "15:00").slice(0, 5);
  const end = String(settings.Active_Window_End || "18:00").slice(0, 5);
  // TEST_MODE is controlled by System_Settings.TEST_MODE. The Worker secret remains a backwards-compatible fallback.
  const sheetTestMode = isEnabled(settings.TEST_MODE);
  const secretTestMode = String(env.TEST_MODE || '').trim().toLowerCase() === 'true';
  const testInspectorId = String(env.TEST_INSPECTOR_ID || '').trim().toUpperCase();
  const isAuthorizedTestSubmission = (sheetTestMode || secretTestMode) && (!testInspectorId || normalize(session.Student_ID) === testInspectorId);
  if (!isAuthorizedTestSubmission && (hhmm < start || hhmm >= end)) return { status: 403, body: { success: false, message: `เปิดให้ส่งผลตรวจเวลา ${start}–${end} เท่านั้น` } };
  const logs = await readObjects(env, SHEETS.LOGS);
  const users = await readObjects(env, SHEETS.USERS);
  const positionByInspector = new Map(users.map((user) => [normalize(user.Student_ID), normalizePosition(user.Inspector_Position)]));
  const today = todayBangkok();
  if (logs.some((log) => String(log.Date) === today && normalize(log.Location_ID) === normalize(locationId) && sameInspectorPosition(log, session, positionByInspector))) return { status: 409, body: { success: false, duplicate: true, message: "ตำแหน่งนี้ตรวจพื้นที่นี้ไปแล้วในวันนี้" } };
  const row = [crypto.randomUUID(), today, bangkokTime(), locationId, session.Student_ID, ...scores, scores.reduce((sum, score) => sum + score, 0), photoUrl, String(body?.remark || "").trim(), false, session.Student_ID];
  await appendRow(env, SHEETS.LOGS, row);
  return { body: { success: true, message: "บันทึกผลตรวจเรียบร้อย", logId: row[0] } };
}

function canAccess(user, location) {
  if (user.Role === "ADMIN") return true;
  const floor = normalizeGrade(location.Grade_Level);
  const type = normalizeType(location.Type);
  const assignedFloor = normalizeGrade(user.Assigned_Grade);
  const assignedType = normalizeType(user.Assigned_Type);
  if (assignedType !== "ALL" && assignedType !== type) return false;
  if (assignedType === "ZONE" || type === "ZONE") {
    if (type !== "ZONE") return false;
    if (assignedFloor !== "ALL" && assignedFloor !== floor) return false;
    return true;
  }
  if (type !== "CLASSROOM") return false;
  const sme = isTrue(location.Is_SME);
  // Only classroom inspectors assigned to grade 3 may see SME rooms, across all grades.
  if (sme) return assignedFloor === "3";
  return assignedFloor === "ALL" || assignedFloor === floor;
}

function withRole(request, env, roles, handler) { return withSession(request, env, async (session) => roles.includes(session.Role) ? handler(session) : ({ status: 403, body: { success: false, message: "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" } })); }
async function withSession(request, env, handler) { const token = bearer(request); const session = await verifyToken(token, env.SESSION_SECRET); return session ? handler(session) : ({ status: 401, body: { success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" } }); }
function bearer(request) { return String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim(); }
function publicUser(user) { return { Student_ID: user.Student_ID || "", Full_Name: user.Full_Name || "", Role: String(user.Role || "").toUpperCase(), Assigned_Grade: user.Assigned_Grade || "", Assigned_Type: user.Assigned_Type || "", Assigned_Locations: user.Assigned_Locations || "", Inspector_Position: user.Inspector_Position || "", Inspector_Status: user.Inspector_Status || "" }; }
function normalize(value) { return String(value || "").trim().toUpperCase(); }
function normalizeGrade(value) { const text = normalize(value).replace(/\s+/g, ""); if (!text || text === "ALL") return "ALL"; const cleaned = text.replace(/^ม\.?/, "").replace(/^M\.?/, ""); return /^\d+$/.test(cleaned) ? String(Number(cleaned)) : text; }
function normalizeType(value) { const text = normalize(value); if (!text || text === "ALL") return "ALL"; if (["ROOM", "CLASS", "CLASSROOM", "ห้อง", "ห้องเรียน"].includes(text)) return "CLASSROOM"; if (["AREA", "ZONE", "ZONE_AREA", "เขต", "เขตพื้นที่"].includes(text)) return "ZONE"; return text; }
function normalizePosition(value) { const text = String(value || "").trim(); return /^\d+$/.test(text) ? String(Number(text)) : normalize(text); }
function isTrue(value) { return ["TRUE", "1", "YES", "Y", "ใช่"].includes(normalize(value)); }
function isEnabled(value) { return isTrue(value); }
function sameInspectorPosition(log, session, positionByInspector) { const current = normalizePosition(session.Inspector_Position); const logged = normalizePosition(log.Inspector_Position || positionByInspector.get(normalize(log.Inspector_ID))); if (current && logged) return current === logged; return normalize(log.Inspector_ID) === normalize(session.Student_ID); }
function splitIds(value) { return String(value || "").split(",").map(normalize).filter(Boolean); }
function todayBangkok() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function bangkokTime() { return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); }
function corsHeaders(origin) { return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" }; }
function json(data, status, origin) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) } }); }

async function readObjects(env, sheetName) { const values = await sheetsValues(env, `${sheetName}!A:Z`); if (!values.length) return []; const headers = values[0].map((value) => String(value || "").trim()); return values.slice(1).filter((row) => row.some((value) => String(value || "").trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))); }
async function appendRow(env, sheetName, row) { await sheetsRequest(env, `values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: [row] }) }); }
async function sheetsValues(env, range) { const data = await sheetsRequest(env, `values/${encodeURIComponent(range)}`); return data.values || []; }
async function sheetsRequest(env, path, options = {}) { const token = await googleAccessToken(env); const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Google Sheets API ${response.status}`); return response.json(); }

async function googleAccessToken(env) { const now = Math.floor(Date.now() / 1000); const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })); const claim = base64url(JSON.stringify({ iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })); const signature = await rsaSign(`${header}.${claim}`, env.GOOGLE_PRIVATE_KEY); const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claim}.${signature}` }); if (!response.ok) throw new Error("Google access token failed"); return (await response.json()).access_token; }
async function rsaSign(value, pem) { const clean = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""); const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]); return base64urlBytes(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(value)))); }
function base64url(value) { return base64urlBytes(new TextEncoder().encode(value)); }
function base64urlBytes(bytes) { let binary = ""; bytes.forEach((byte) => binary += String.fromCharCode(byte)); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function signToken(payload, secret) { const body = base64url(JSON.stringify(payload)); const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const signature = base64urlBytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))); return `${body}.${signature}`; }
async function verifyToken(token, secret) { try { const [body, signature] = String(token || "").split("."); if (!body || !signature) return null; const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); const valid = await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "=="), (c) => c.charCodeAt(0)), new TextEncoder().encode(body)); if (!valid) return null; const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/") + "==")); return payload.exp > Math.floor(Date.now() / 1000) ? payload : null; } catch { return null; } }
