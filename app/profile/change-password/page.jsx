"use client";
import { useState } from "react";
import Shell from "@/components/payvision/Shell";

function StrengthBar({ password }) {
  const checks = [/.{8,}/, /[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];
  const score = checks.filter(r => r.test(password)).length;
  const levels = ["","Very Weak","Weak","Fair","Strong","Very Strong"];
  const colors = ["","bg-red-500","bg-orange-400","bg-yellow-400","bg-emerald-400","bg-emerald-600"];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i<=score ? colors[score] : "bg-slate-200"}`}/>
        ))}
      </div>
      <p className="text-xs text-slate-500">Strength: <span className="font-semibold">{levels[score]||"Very Weak"}</span></p>
    </div>
  );
}

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ type: "", msg: "" });

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast({ type: "", msg: "" }), 4000);
  }

  function validate() {
    const errs = {};
    if (!form.current) errs.current = "Current password is required.";
    if (!form.next) errs.next = "New password is required.";
    else if (form.next.length < 8) errs.next = "Minimum 8 characters.";
    else if (form.next === form.current) errs.next = "New password must differ from current.";
    if (!form.confirm) errs.confirm = "Please confirm your new password.";
    else if (form.next !== form.confirm) errs.confirm = "Passwords do not match.";
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("error", data?.message || "Failed to change password."); return; }
      showToast("success", "Password changed successfully!");
      setForm({ current: "", next: "", confirm: "" });
      setErrors({});
    } catch { showToast("error", "Network error. Please try again."); }
    finally { setBusy(false); }
  }

  function PwField({ id, label, value, showKey }) {
    return (
      <div>
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <div className="relative mt-1.5">
          <input
            type={show[showKey] ? "text" : "password"}
            value={value}
            onChange={e => setForm(p => ({ ...p, [showKey === "current" ? "current" : showKey === "next" ? "next" : "confirm"]: e.target.value }))}
            placeholder={label}
            className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${errors[showKey === "current" ? "current" : showKey === "next" ? "next" : "confirm"] ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}
          />
          <button type="button" onClick={() => setShow(p => ({ ...p, [showKey]: !p[showKey] }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-semibold">
            {show[showKey] ? "Hide" : "Show"}
          </button>
        </div>
        {errors[showKey === "current" ? "current" : showKey === "next" ? "next" : "confirm"] && (
          <p className="mt-1 text-xs text-red-600">⚠ {errors[showKey === "current" ? "current" : showKey === "next" ? "next" : "confirm"]}</p>
        )}
        {showKey === "next" && <StrengthBar password={value} />}
      </div>
    );
  }

  return (
    <Shell title="Change Password" breadcrumb="Home > Profile > Change Password">
      <div className="max-w-md">
        {toast.msg && (
          <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-2 text-sm font-medium ${toast.type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"}`}>
            {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xl">🔑</div>
            <div>
              <h2 className="font-bold text-slate-900">Change Password</h2>
              <p className="text-xs text-slate-500">Use a strong password with 8+ characters</p>
            </div>
          </div>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Current Password</label>
              <div className="relative mt-1.5">
                <input type={show.current?"text":"password"} value={form.current}
                  onChange={e=>setForm(p=>({...p,current:e.target.value}))} placeholder="Enter current password"
                  className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${errors.current?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50"}`}/>
                <button type="button" onClick={()=>setShow(p=>({...p,current:!p.current}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700">{show.current?"Hide":"Show"}</button>
              </div>
              {errors.current&&<p className="mt-1 text-xs text-red-600">⚠ {errors.current}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">New Password</label>
              <div className="relative mt-1.5">
                <input type={show.next?"text":"password"} value={form.next}
                  onChange={e=>setForm(p=>({...p,next:e.target.value}))} placeholder="Enter new password"
                  className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${errors.next?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50"}`}/>
                <button type="button" onClick={()=>setShow(p=>({...p,next:!p.next}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700">{show.next?"Hide":"Show"}</button>
              </div>
              {errors.next&&<p className="mt-1 text-xs text-red-600">⚠ {errors.next}</p>}
              <StrengthBar password={form.next}/>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Confirm New Password</label>
              <div className="relative mt-1.5">
                <input type={show.confirm?"text":"password"} value={form.confirm}
                  onChange={e=>setForm(p=>({...p,confirm:e.target.value}))} placeholder="Re-enter new password"
                  className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${errors.confirm?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50"}`}/>
                <button type="button" onClick={()=>setShow(p=>({...p,confirm:!p.confirm}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700">{show.confirm?"Hide":"Show"}</button>
              </div>
              {errors.confirm&&<p className="mt-1 text-xs text-red-600">⚠ {errors.confirm}</p>}
              {form.confirm&&form.next&&form.confirm===form.next&&<p className="mt-1 text-xs text-emerald-600">✓ Passwords match</p>}
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 py-2.5 text-sm text-white font-semibold disabled:opacity-60">
              {busy?"Updating...":"Update Password"}
            </button>
          </form>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700">Password requirements:</p>
          <p>• At least 8 characters long</p>
          <p>• Mix of uppercase and lowercase letters</p>
          <p>• At least one number</p>
          <p>• At least one special character (!@#$% etc.)</p>
        </div>
      </div>
    </Shell>
  );
}
