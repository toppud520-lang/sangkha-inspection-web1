/* Original UI migration: preserve the user's existing asymmetric red glassmorphism login exactly; only the submit handler is adapted to the new API contract. */
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { login } from "@/lib/api";

const backgroundImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuDpeU0PXir8ziFgN8pJBbez-wRsvB1lfzc4lnXKDs1F1YG7ddMVhl31tznAQUTn1KgWH4t0dzljUouepEarpzlOqPLRLx6l7UFo_zkb2P-sFXW1DdyqPOq0BKEtLb3MXRlDgB8ElBHnWqaiQwSb7OhpRilqzT4BkQ_TT-XQAKkE6u7anYx_NyMdl5WEnnx91mOdQYKcq57w0ibQDCQQicVGpBK4iOQrUDidDVhwNQd9V-VJbiAGiWdx5nz7ZgmbBFXzlA";
const logo = "https://lh3.googleusercontent.com/aida-public/AB6AXuB_yKPcoB2urOMFN1CoCv1_4P9AJqrT194Smqvqb5QDTYVcBElAUEjQrnn03-lWW3v_XxSN0ncskHbyG-RBjWf9cmOkdf__Gq6JQp1TQfPZ1ETF3OHkewsqzqm6dQOOXfJ60mFKP8-ziZyickOF54om7sfEkNWbJ11R5kevhg3BWltzdaG6OcQowNyrh0cDuWKhN60cEh2dMTy8oijPzlfAkxJpGQKgfRE7GRqAYspGx-89-HCraRJW8tBtvmSK_DyXSw";

export default function Login() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (!result.success) throw new Error(result.message || "เข้าสู่ระบบไม่สำเร็จ");
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("sangkha_session", JSON.stringify(result));
      sessionStorage.setItem("sangkha_session", JSON.stringify(result));
      const role = String(result.user?.Role || "").toLowerCase();
      navigate(role === "admin" ? "/admin" : role === "supervisor" ? "/supervisor" : "/inspector");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally { setLoading(false); }
  }

  return <main className="relative flex h-screen w-full overflow-hidden bg-[#F8FAFC] font-body-md text-[#0b1c30] antialiased">
    <div className="absolute inset-0 z-0"><img alt="School Background" className="h-full w-full object-cover blur-sm" src={backgroundImage} /><div className="absolute inset-0 bg-[#ab0013]/75 mix-blend-multiply" /></div>
    <div className="relative z-10 flex h-full w-full">
      <div className="hidden w-1/2 flex-col items-center justify-center p-8 text-white lg:flex"><div className="max-w-lg text-center"><img alt="Sangkha School Logo" className="mx-auto mb-8 h-auto w-64 drop-shadow-2xl" src={logo} /><h1 className="font-display mb-4 text-5xl font-bold leading-tight tracking-tight drop-shadow-lg">ระบบตรวจความสะอาด<br />โรงเรียนแบบ Real-time</h1><p className="font-body-lg text-xl opacity-90 drop-shadow-md">Sangkha School Inspection System</p><div className="mt-12 flex justify-center gap-4"><span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold backdrop-blur-sm"><span className="material-symbols-outlined text-sm">speed</span>Fast</span><span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold backdrop-blur-sm"><span className="material-symbols-outlined text-sm">security</span>Secure</span><span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold backdrop-blur-sm"><span className="material-symbols-outlined text-sm">sync</span>Real-time</span></div></div></div>
      <div className="flex w-full items-center justify-center p-4 sm:p-8 lg:w-1/2"><div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/30 bg-white/85 p-8 shadow-2xl backdrop-blur-xl sm:p-10"><div className="absolute right-0 top-0 -z-0 h-32 w-32 rounded-bl-full bg-[#ab0013]/10" /><div className="absolute bottom-0 left-0 -z-0 h-24 w-24 rounded-tr-full bg-[#fcd400]/10" /><div className="relative z-10 mb-8 text-center"><img alt="Logo" className="mx-auto mb-4 h-auto w-24 lg:hidden" src={logo} /><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#d31e24] text-[#ab0013] shadow-inner"><span className="material-symbols-outlined text-3xl">admin_panel_settings</span></div><h2 className="font-display text-3xl font-bold">เข้าสู่ระบบ</h2><p className="mt-2 text-sm text-[#5c403d]">เข้าสู่ระบบเพื่อจัดการข้อมูลการตรวจสอบ</p></div><form className="relative z-10 space-y-6" onSubmit={handleSubmit}><div><label className="mb-2 block text-xs font-bold text-[#5c403d]" htmlFor="username">ชื่อผู้ใช้ (Username)</label><div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5c403d]">person</span><input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-white/80 py-3 pl-10 pr-4 text-base outline-none backdrop-blur-sm transition-all focus:border-transparent focus:ring-2 focus:ring-[#ab0013]" placeholder="กรอกชื่อผู้ใช้ของคุณ" required /></div></div><div><div className="mb-2 flex items-center justify-between"><label className="block text-xs font-bold text-[#5c403d]" htmlFor="password">รหัสผ่าน (Password)</label><a className="text-[11px] font-semibold text-[#ab0013]" href="#">ลืมรหัสผ่าน?</a></div><div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5c403d]">lock</span><input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-[#E2E8F0] bg-white/80 py-3 pl-10 pr-10 text-base outline-none backdrop-blur-sm transition-all focus:border-transparent focus:ring-2 focus:ring-[#ab0013]" placeholder="กรอกรหัสผ่านของคุณ" required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c403d]" aria-label="แสดงหรือซ่อนรหัสผ่าน"><span className="material-symbols-outlined">{showPassword ? "visibility" : "visibility_off"}</span></button></div></div><label className="flex items-center"><input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-[#E2E8F0] text-[#ab0013] focus:ring-2 focus:ring-[#ab0013]" /><span className="ml-2 text-sm text-[#5c403d]">จดจำการเข้าสู่ระบบ</span></label><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#d31e24] to-[#ab0013] py-3 font-display text-lg font-medium text-white shadow-lg transition hover:-translate-y-px hover:shadow-xl disabled:opacity-70"> <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span><span className="material-symbols-outlined text-lg">arrow_forward</span></button></form><div className="relative z-10 mt-8 border-t border-[#E2E8F0]/60 pt-6 text-center"><p className="text-[11px] font-semibold text-[#5c403d]">สร้างโดยคณะกรรมการสภานักเรียนประจำปีงบประมาณ 2569</p></div></div></div>
    </div>
  </main>;
}
