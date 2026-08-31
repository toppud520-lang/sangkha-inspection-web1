/* Sangkha Inspection - Login only Worker API
   Paste this entire file into Cloudflare Worker > Edit code.
   Required variables/secrets: SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL,
   GOOGLE_PRIVATE_KEY, SESSION_SECRET, ALLOWED_ORIGIN.
*/
const USERS_SHEET = "Users";

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/") return response({ success: true, service: "sangkha-login-api" }, 200, origin);
      if (request.method === "POST" && url.pathname === "/auth/login") return login(request, env, origin);
      if (request.method === "GET" && url.pathname === "/auth/session") return session(request, env, origin);
      return response({ success: false, message: "ไม่พบ API ที่ร้องขอ" }, 404, origin);
    } catch (error) {
      console.error(error);
      return response({ success: false, message: "เกิดข้อผิดพลาดในระบบ" }, 500, origin);
    }
  },
};

async function login(request, env, origin) {
  const body = await request.json();
  const studentId = String(body?.username || body?.studentId || "").trim();
  const pin = String(body?.password || body?.pin || "").trim();
  if (!studentId || !pin) return response({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, 400, origin);
  const users = await readSheet(env, USERS_SHEET);
  const user = users.find((item) => String(item.Student_ID || "").trim().toLowerCase() === studentId.toLowerCase());
  if (!user) return response({ success: false, message: "ไม่พบชื่อผู้ใช้" }, 401, origin);
  if (pin !== String(user.PIN || "").trim()) return response({ success: false, message: "รหัสผ่านไม่ถูกต้อง" }, 401, origin);
  const cleanUser = { Student_ID: user.Student_ID || "", Full_Name: user.Full_Name || "", Role: String(user.Role || "").trim().toUpperCase(), Assigned_Grade: user.Assigned_Grade || "", Assigned_Type: user.Assigned_Type || "", Assigned_Locations: user.Assigned_Locations || "" };
  if (!["INSPECTOR", "SUPERVISOR", "ADMIN"].includes(cleanUser.Role)) return response({ success: false, message: "บทบาทผู้ใช้ไม่ถูกต้อง" }, 403, origin);
  const expiresIn = Number(env.SESSION_SECONDS || 21600);
  const token = await sign({ ...cleanUser, exp: Math.floor(Date.now() / 1000) + expiresIn }, env.SESSION_SECRET);
  return response({ success: true, sessionId: token, user: cleanUser, expiresIn }, 200, origin);
}

async function session(request, env, origin) {
  const token = String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const payload = await verify(token, env.SESSION_SECRET);
  return payload ? response({ success: true, sessionId: token, user: publicUser(payload), expiresIn: payload.exp - Math.floor(Date.now() / 1000) }, 200, origin) : response({ success: false, message: "Session หมดอายุหรือไม่ถูกต้อง" }, 401, origin);
}

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

async function googleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(JSON.stringify({ iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
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
function publicUser(user) { return { Student_ID: user.Student_ID || "", Full_Name: user.Full_Name || "", Role: user.Role || "", Assigned_Grade: user.Assigned_Grade || "", Assigned_Type: user.Assigned_Type || "", Assigned_Locations: user.Assigned_Locations || "" }; }
function b64(value) { return b64Bytes(new TextEncoder().encode(value)); }
function b64Bytes(bytes) { let binary = ""; bytes.forEach((byte) => binary += String.fromCharCode(byte)); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromB64(value) { const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "=="; return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)); }
function cors(origin) { return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" }; }
function response(body, status, origin) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) } }); }
