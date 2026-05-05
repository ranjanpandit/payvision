"use client";
import { useState } from "react";
import Shell from "@/components/payvision/Shell";

function PinInput({ label, hint, fieldKey, value, showPin, error, confirmMatch, onChange, onToggleShow }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      <div className="relative mt-1.5">
        <input
          type={showPin ? "text" : "password"}
          value={value}
          maxLength={6}
          inputMode="numeric"
          onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="• • • • • •"
          className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-sm tracking-[0.5em] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}
        />
        <button type="button" onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700">
          {showPin ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">⚠ {error}</p>}
      {confirmMatch && <p className="mt-1 text-xs text-emerald-600">✓ TPINs match</p>}
    </div>
  );
}

export default function ChangeTpinPage() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [isFirstTime, setIsFirstTime] = useState(false);
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
    if (!isFirstTime && !form.current) errs.current = "Current TPIN is required.";
    if (!isFirstTime && form.current && !/^\d{6}$/.test(form.current)) errs.current = "TPIN must be 6 digits.";
    if (!form.next) errs.next = "New TPIN is required.";
    else if (!/^\d{6}$/.test(form.next)) errs.next = "TPIN must be exactly 6 digits.";
    if (!form.confirm) errs.confirm = "Please confirm your new TPIN.";
    else if (form.next !== form.confirm) errs.confirm = "TPINs do not match.";
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/change-tpin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentTpin: isFirstTime ? null : form.current, newTpin: form.next }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "NO_TPIN_SET") { setIsFirstTime(true); showToast("error", "No TPIN set yet. Click 'First time?' to set your TPIN."); return; }
        showToast("error", data?.message || "Failed to change TPIN.");
        return;
      }
      showToast("success", isFirstTime ? "TPIN set successfully!" : "TPIN changed successfully!");
      setForm({ current: "", next: "", confirm: "" });
      setIsFirstTime(false);
    } catch { showToast("error", "Network error. Please try again."); }
    finally { setBusy(false); }
  }

  function setField(key, val) { setForm(p => ({ ...p, [key]: val })); }
  function toggleShow(key) { setShow(p => ({ ...p, [key]: !p[key] })); }

  return (
    <Shell title="Change Transaction PIN" breadcrumb="Home > Profile > Change TPIN">
      <div className="max-w-md">
        {toast.msg && (
          <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-2 text-sm font-medium ${toast.type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"}`}>
            {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xl">🔐</div>
            <div>
              <h2 className="font-bold text-slate-900">Transaction PIN (TPIN)</h2>
              <p className="text-xs text-slate-500">6-digit numeric PIN used to authorize wallet transactions</p>
            </div>
          </div>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {!isFirstTime && (
              <PinInput
                label="Current TPIN" fieldKey="current"
                hint="Enter your existing 6-digit TPIN"
                value={form.current} showPin={show.current} error={errors.current}
                onChange={v => setField("current", v)}
                onToggleShow={() => toggleShow("current")}
              />
            )}
            <PinInput
              label={isFirstTime ? "Set New TPIN" : "New TPIN"} fieldKey="next"
              hint="Choose a 6-digit numeric PIN"
              value={form.next} showPin={show.next} error={errors.next}
              onChange={v => setField("next", v)}
              onToggleShow={() => toggleShow("next")}
            />
            <PinInput
              label="Confirm New TPIN" fieldKey="confirm"
              value={form.confirm} showPin={show.confirm} error={errors.confirm}
              confirmMatch={!!(form.confirm && form.next === form.confirm)}
              onChange={v => setField("confirm", v)}
              onToggleShow={() => toggleShow("confirm")}
            />

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 py-2.5 text-sm text-white font-semibold disabled:opacity-60">
                {busy ? "Saving..." : isFirstTime ? "Set TPIN" : "Change TPIN"}
              </button>
              <button type="button" onClick={() => { setIsFirstTime(v => !v); setForm({ current: "", next: "", confirm: "" }); setErrors({}); }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                {isFirstTime ? "I have a TPIN" : "First time?"}
              </button>
            </div>
          </form>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Important:</p>
          <p>• TPIN is required for all wallet deduction transactions</p>
          <p>• Never share your TPIN with anyone</p>
          <p>• Use a PIN that is not your date of birth or 123456</p>
        </div>
      </div>
    </Shell>
  );
}
