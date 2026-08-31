/* Civic Signal integration layer: one Worker contract for Inspector, Supervisor and Admin; no secrets are stored in the browser. */
export type Role = "inspector" | "supervisor" | "admin";
export type User = { Student_ID: string; Full_Name: string; Role: Role; Assigned_Grade?: string; Assigned_Type?: string; Assigned_Locations?: string; Inspector_Position?: string; Inspector_Status?: string };
export type SessionResult = { success: boolean; sessionId?: string; user?: User; expiresIn?: number; message?: string };
export type InspectionLocation = { id: string; label: string; type: "CLASSROOM" | "ZONE"; floor: string; status: "pending" | "completed"; score?: number };
export type SupervisorDashboard = { success: boolean; completed: number; pending: number; committee: number; average: number; message?: string };
export type AdminDashboard = { success: boolean; completed: number; pending: number; totalLocations: number; average: number; users: number; message?: string };

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "https://sangkha-inspection-api.25071.workers.dev").replace(/\/$/, "");

const demoUsers: Record<string, { password: string; user: User }> = {
  "inspector-01": { password: "demo", user: { Student_ID: "INS-01", Full_Name: "ผู้ตรวจตัวอย่าง", Role: "inspector", Assigned_Grade: "ม.3", Assigned_Type: "CLASSROOM" } },
  "supervisor-01": { password: "demo", user: { Student_ID: "SUP-01", Full_Name: "หัวหน้าชั้นตัวอย่าง", Role: "supervisor", Assigned_Grade: "ม.3", Assigned_Type: "CLASSROOM" } },
  "admin-01": { password: "demo", user: { Student_ID: "ADM-01", Full_Name: "ผู้ดูแลระบบตัวอย่าง", Role: "admin", Assigned_Grade: "ALL", Assigned_Type: "ALL" } },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) } });
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw || "ระบบตอบกลับไม่ใช่ JSON" }; }
  if (!response.ok) throw new Error(String(data.message || `เชื่อมต่อระบบไม่สำเร็จ (${response.status})`));
  return data as T;
}

export async function login(username: string, password: string): Promise<SessionResult> {
  if (API_BASE) return request<SessionResult>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  const demo = demoUsers[username];
  if (!demo || demo.password !== password) return { success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  return { success: true, sessionId: `demo-${demo.user.Student_ID}`, user: demo.user, expiresIn: 21600 };
}

export async function getInspectorLocations(sessionId: string): Promise<{ success: boolean; locations: InspectionLocation[]; averageScore?: number }> {
  if (API_BASE) {
    const data = await request<{ success: boolean; locations: Array<Record<string, unknown>>; averageScore?: number }>("/inspector/locations", { headers: { Authorization: `Bearer ${sessionId}` } });
    return { ...data, locations: (data.locations || []).map((item) => ({ id: String(item.Location_ID || ""), label: String(item.Location_Name || item.Location_ID || ""), type: String(item.Type || "CLASSROOM").toUpperCase() === "ZONE" ? "ZONE" : "CLASSROOM", floor: String(item.Grade_Level || ""), status: item.Completed ? "completed" : "pending", score: Number.isFinite(Number(item.Score)) ? Number(item.Score) : undefined })) };
  }
  return { success: true, locations: ["ห้อง 301", "ห้อง 302", "ห้อง 303", "ห้อง 304"].map((label, index) => ({ id: `M3-${index + 1}`, label, type: "CLASSROOM", floor: "ม.3", status: index < 1 ? "completed" : "pending", score: index < 1 ? 88 : undefined })) };
}

export async function submitInspection(sessionId: string, payload: Record<string, unknown>) {
  if (API_BASE) return request<{ success: boolean; message?: string }>("/inspections", { method: "POST", headers: { Authorization: `Bearer ${sessionId}` }, body: JSON.stringify(payload) });
  await new Promise((resolve) => setTimeout(resolve, 450));
  return { success: true, message: "บันทึกผลตรวจเรียบร้อย" };
}

export async function getSupervisorDashboard(sessionId: string): Promise<SupervisorDashboard> {
  if (API_BASE) return request<SupervisorDashboard>("/supervisor/dashboard", { headers: { Authorization: `Bearer ${sessionId}` } });
  return { success: true, completed: 7, pending: 4, committee: 11, average: 84.6 };
}

export async function getAdminDashboard(sessionId: string): Promise<AdminDashboard> {
  if (API_BASE) return request<AdminDashboard>("/admin/dashboard", { headers: { Authorization: `Bearer ${sessionId}` } });
  return { success: true, completed: 98, pending: 34, totalLocations: 132, average: 87.4, users: 74 };
}

export function clearSession() { sessionStorage.removeItem("sangkha_session"); localStorage.removeItem("sangkha_session"); }
