"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/payvision/Shell";

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(String(text));
  }
  const el = document.createElement("textarea");
  el.value = String(text);
  el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  return Promise.resolve();
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [newCredentials, setNewCredentials] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [resettingId, setResettingId] = useState(null);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/employees", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setEmployees(Array.isArray(data?.employees) ? data.employees : []);
      else setMessage({ type: "error", text: data?.message || "Failed to load employees." });
    } catch { setMessage({ type: "error", text: "Failed to load employees." }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEmployees(); }, []);

  async function onAdd(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setBusy(true);
    setMessage({ type: "", text: "" });
    setNewCredentials(null);
    try {
      const res = await fetch("/api/v1/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data?.message || "Failed to add employee." }); return; }
      setNewCredentials(data?.credentials);
      setNewEmail("");
      setMessage({ type: "success", text: "Employee account created. Share credentials securely." });
      await loadEmployees();
    } catch { setMessage({ type: "error", text: "Failed to add employee." }); }
    finally { setBusy(false); }
  }

  async function onToggleActive(emp) {
    try {
      const res = await fetch("/api/v1/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id, action: "toggleActive" }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data?.message || "Update failed." }); return; }
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, isActive: data.isActive } : e));
    } catch { setMessage({ type: "error", text: "Update failed." }); }
  }

  async function onResetPassword(emp) {
    setResettingId(emp.id);
    setResetInfo(null);
    try {
      const res = await fetch("/api/v1/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id, action: "resetPassword" }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data?.message || "Reset failed." }); return; }
      setResetInfo({ email: emp.email, password: data.credentials?.password });
      setMessage({ type: "success", text: `Password reset for ${emp.email}.` });
    } catch { setMessage({ type: "error", text: "Reset failed." }); }
    finally { setResettingId(null); }
  }

  async function doCopy(text, key) {
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch { setMessage({ type: "error", text: "Copy failed. Please copy manually." }); }
  }

  return (
    <Shell title="Manage Employees" breadcrumb="Home > Manage Employee">
      <div className="space-y-5">

        {/* Add form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xl">👤</div>
            <div>
              <h2 className="font-bold text-slate-900">Add New Admin Employee</h2>
              <p className="text-xs text-slate-500">Creates an admin account with a temporary password</p>
            </div>
          </div>
          <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-3">
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="employee@yourcompany.com" required
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"/>
            <button type="submit" disabled={busy || !newEmail.trim()}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* Status message */}
        {message.text && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2
            ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {message.type === "success" ? "✓" : "⚠"} {message.text}
          </div>
        )}

        {/* New credentials */}
        {newCredentials && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="font-semibold text-indigo-900 mb-3">New Employee Credentials — Share Securely</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl bg-white border border-indigo-200 px-4 py-3">
                <p className="text-xs font-semibold text-indigo-500 uppercase mb-1">Email</p>
                <p className="font-mono text-sm text-slate-800 break-all">{newCredentials.email}</p>
              </div>
              <div className="rounded-xl bg-white border border-indigo-200 px-4 py-3">
                <p className="text-xs font-semibold text-indigo-500 uppercase mb-1">Temp Password</p>
                <p className="font-mono text-sm text-slate-800">{newCredentials.password}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => doCopy(newCredentials.email, "nc-email")}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">
                {copiedKey === "nc-email" ? "✓ Copied" : "Copy Email"}
              </button>
              <button onClick={() => doCopy(newCredentials.password, "nc-pass")}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">
                {copiedKey === "nc-pass" ? "✓ Copied" : "Copy Password"}
              </button>
              <button onClick={() => doCopy(`Email: ${newCredentials.email}\nPassword: ${newCredentials.password}`, "nc-all")}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white">
                {copiedKey === "nc-all" ? "✓ Copied" : "Copy All"}
              </button>
            </div>
          </div>
        )}

        {/* Reset credentials */}
        {resetInfo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900 mb-3">Password Reset — New Credentials</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl bg-white border border-amber-200 px-4 py-3">
                <p className="text-xs font-semibold text-amber-500 uppercase mb-1">Email</p>
                <p className="font-mono text-sm text-slate-800 break-all">{resetInfo.email}</p>
              </div>
              <div className="rounded-xl bg-white border border-amber-200 px-4 py-3">
                <p className="text-xs font-semibold text-amber-500 uppercase mb-1">New Password</p>
                <p className="font-mono text-sm text-slate-800">{resetInfo.password}</p>
              </div>
            </div>
            <button onClick={() => doCopy(`Email: ${resetInfo.email}\nPassword: ${resetInfo.password}`, "ri-all")}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white">
              {copiedKey === "ri-all" ? "✓ Copied" : "Copy All"}
            </button>
          </div>
        )}

        {/* Employee table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Admin Accounts</h2>
            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-500">{employees.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#0f1f3d] text-white">
                <tr>
                  {["#", "Email", "Role", "Status", "Joined", "Actions"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading employees...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No employees found.</td></tr>
                ) : employees.map((emp, idx) => (
                  <tr key={emp.id} className={`border-t border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                    <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{emp.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{emp.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${emp.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(emp.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onToggleActive(emp)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold text-white ${emp.isActive ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
                          {emp.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => onResetPassword(emp)} disabled={resettingId === emp.id}
                          className="rounded-lg bg-slate-600 hover:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
                          {resettingId === emp.id ? "Resetting..." : "Reset Pass"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
