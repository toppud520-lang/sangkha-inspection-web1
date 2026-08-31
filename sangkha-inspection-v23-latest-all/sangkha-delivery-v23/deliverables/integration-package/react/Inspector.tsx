/* Civic Signal: field-first inspector workflow; show time, assignment, progress, and one decisive submit action. */
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Clock3, Camera, CheckCircle2, ChevronRight, ClipboardCheck, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getInspectorLocations, submitInspection, type InspectionLocation } from "@/lib/api";

const criteria = ["พื้นและทางเดิน", "โต๊ะและเก้าอี้", "ถังขยะ", "หน้าต่างและประตู", "กระดาน", "อุปกรณ์ห้องเรียน", "ความเรียบร้อย", "กลิ่นและอากาศ"];

export default function Inspector() {
  const [, navigate] = useLocation();
  const session = JSON.parse(sessionStorage.getItem("sangkha_session") || "{}");
  const user = session.user;
  const [locations, setLocations] = useState<InspectionLocation[]>([]);
  const [selected, setSelected] = useState<InspectionLocation | null>(null);
  const [scores, setScores] = useState<number[]>(Array(8).fill(0));
  const [remark, setRemark] = useState("");
  const [photoData, setPhotoData] = useState<{ base64: string; mimeType: string; fileName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { getInspectorLocations(session.sessionId).then((data) => setLocations(data.locations)).catch((e) => toast.error(e.message)).finally(() => setLoading(false)); }, [session.sessionId]);
  const completed = locations.filter((location) => location.status === "completed").length;
  const progress = locations.length ? Math.round((completed / locations.length) * 100) : 0;
  const total = useMemo(() => scores.reduce((sum, score) => sum + score, 0), [scores]);

  function logout() { sessionStorage.removeItem("sangkha_session"); navigate("/login"); }
  function openLocation(location: InspectionLocation) { setSelected(location); setScores(Array(8).fill(0)); setRemark(""); setPhotoData(null); }
  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 8 * 1024 * 1024) return toast.error("รูปภาพต้องมีขนาดไม่เกิน 8 MB");
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ")); reader.readAsDataURL(file); });
    setPhotoData({ base64, mimeType: file.type, fileName: file.name });
  }
  async function handleSubmit() {
    if (!selected || scores.some((score) => score < 1)) return toast.error("กรุณาให้คะแนนครบทั้ง 8 หัวข้อ");
    if (!photoData) return toast.error("กรุณาแนบรูปหลักฐานก่อนส่งผลตรวจ");
    setSending(true);
    try { const result = await submitInspection(session.sessionId, { locationId: selected.id, scores, remark, photoData }); if (!result.success) throw new Error(result.message); setLocations((items) => items.map((item) => item.id === selected.id ? { ...item, status: "completed", score: total } : item)); setSelected(null); toast.success("บันทึกผลตรวจเรียบร้อย"); } catch (e) { toast.error(e instanceof Error ? e.message : "ส่งข้อมูลไม่สำเร็จ"); } finally { setSending(false); }
  }

  return <div className="min-h-screen bg-[#f8f5ef] text-[#142436] pb-24">
    <header className="sticky top-0 z-30 flex items-center justify-between bg-[#ab0013] px-4 py-3 text-white shadow-lg sm:px-8"><div className="flex items-center gap-3"><img src="/manus-storage/sangkha-mark_05f1f42c.png" alt="ตราสัญลักษณ์" className="h-10 w-10 rounded-xl bg-white p-1" /><div><p className="font-display text-lg font-semibold">Inspectors</p><p className="text-xs text-white/70">{user?.Full_Name || "ผู้ตรวจ"} · {user?.Student_ID || "—"}</p></div></div><div className="text-right"><div className="flex items-center justify-end gap-1 text-xs text-white/75"><Clock3 className="h-3.5 w-3.5" /> เปิดตรวจ</div><p className="font-display text-sm font-semibold">15:00–18:00</p></div></header>
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#ab0013]">Field board / วันนี้</p><h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">งานตรวจของคุณ</h1><p className="mt-2 text-[#5d6b78]">{user?.Assigned_Grade || "ทุกชั้นที่ได้รับมอบหมาย"} · {user?.Assigned_Type === "ZONE" ? "ตรวจเขตพื้นที่" : "ตรวจห้องเรียน"}</p></div><div className="rounded-2xl border border-[#e1dbd2] bg-white px-4 py-3 shadow-sm"><p className="text-xs text-[#71808c]">ความคืบหน้าวันนี้</p><p className="mt-1 font-display text-2xl font-semibold text-[#ab0013]">{progress}% <span className="text-sm font-normal text-[#71808c]">({completed}/{locations.length})</span></p></div></div>
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-[#e3ded5]"><div className="h-full rounded-full bg-[#ab0013] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      <section className="grid gap-3 sm:grid-cols-2">{loading ? <div className="rounded-2xl bg-white p-8 text-center text-[#71808c] sm:col-span-2">กำลังโหลดรายการงาน...</div> : locations.map((location) => <button key={location.id} onClick={() => openLocation(location)} className="group flex items-center justify-between rounded-2xl border border-[#e1dbd2] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#ab0013] hover:shadow-md active:scale-[.99]"><div className="flex items-center gap-4"><div className={`flex h-12 w-12 items-center justify-center rounded-xl ${location.status === "completed" ? "bg-[#e9f7ef] text-[#10834f]" : "bg-[#f9e8e7] text-[#ab0013]"}`}>{location.status === "completed" ? <CheckCircle2 /> : <MapPin />}</div><div><p className="font-display text-lg font-semibold">{location.label}</p><p className="mt-1 text-sm text-[#71808c]">{location.status === "completed" ? `ตรวจแล้ว · ${location.score}/100 คะแนน` : "รอตรวจ · แตะเพื่อเริ่ม"}</p></div></div><ChevronRight className="h-5 w-5 text-[#a3adb4] transition group-hover:translate-x-1 group-hover:text-[#ab0013]" /></button>)}</section>
    </main>
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#ded8cf] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(20,36,54,.08)] backdrop-blur sm:px-8"><div className="mx-auto flex max-w-5xl items-center justify-between"><div className="flex items-center gap-2 text-xs text-[#71808c]"><ShieldCheck className="h-4 w-4 text-[#ab0013]" /> สิทธิ์ของคุณถูกจำกัดตามพื้นที่</div><button onClick={logout} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#ab0013] hover:bg-[#f9e8e7]"><LogOut className="h-4 w-4" /> ออกจากระบบ</button></div></nav>
    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#142436]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#f8f5ef] p-5 sm:rounded-3xl sm:p-7"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ab0013]">Inspection form</p><h2 className="mt-1 font-display text-2xl font-semibold">{selected.label}</h2></div><button onClick={() => setSelected(null)} className="rounded-xl px-3 py-2 text-sm text-[#71808c] hover:bg-white">ปิด</button></div><div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#ded8cf] bg-white p-4"><ClipboardCheck className="h-6 w-6 text-[#ab0013]" /><div><p className="font-semibold">ให้คะแนนความสะอาด</p><p className="text-sm text-[#71808c]">เลือก 1–10 ในแต่ละหัวข้อ</p></div><span className="ml-auto font-display text-xl font-semibold text-[#ab0013]">{total}/80</span></div><div className="grid gap-3">{criteria.map((criterion, index) => <label key={criterion} className="flex items-center justify-between rounded-xl border border-[#e1dbd2] bg-white px-4 py-3"><span className="text-sm font-semibold">{index + 1}. {criterion}</span><select value={scores[index]} onChange={(e) => setScores((old) => old.map((score, i) => i === index ? Number(e.target.value) : score))} className="w-20 rounded-lg border-[#d7d2ca] bg-[#f8f5ef] text-center font-semibold focus:border-[#ab0013] focus:ring-[#ab0013]"><option value={0}>—</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>)}</div><label className="mt-4 block"><span className="mb-2 block text-sm font-semibold">หมายเหตุ</span><textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} className="w-full rounded-xl border-[#d7d2ca] bg-white focus:border-[#ab0013] focus:ring-[#ab0013]" placeholder="ระบุสิ่งที่พบ (ถ้ามี)" /></label><label className="mt-4 block rounded-2xl border border-dashed border-[#ab0013]/40 bg-white p-4"><span className="mb-2 block text-sm font-semibold text-[#142436]">รูปหลักฐาน <span className="text-[#ab0013]">* จำเป็น</span></span><input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#f9e8e7] file:px-3 file:py-2 file:font-semibold file:text-[#ab0013]" />{photoData && <p className="mt-2 text-xs text-[#10834f]">แนบแล้ว: {photoData.fileName}</p>}</label><button onClick={handleSubmit} disabled={sending || !photoData} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ab0013] font-display text-lg font-semibold text-white shadow-lg transition hover:bg-[#8e0010] active:scale-[.98] disabled:opacity-60"><Camera className="h-5 w-5" />{sending ? "กำลังบันทึก..." : "ยืนยันผลตรวจ"}</button></div></div>}
  </div>;
}
