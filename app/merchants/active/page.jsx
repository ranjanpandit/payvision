"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/zixpay/Shell";

const emptyEditForm = {
  merchantId: "",
  apiKey: "",
  apiSecret: "",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  callbackUrl: "",
  city: "",
  state: "",
  status: "ACTIVE",
  payoutMode: "MANUAL",
};

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

export default function ActiveMerchantPage() {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState("");
  const [resetCredentials, setResetCredentials] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  async function loadMerchants() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/merchants", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to load merchants.");
        return;
      }
      setMerchants(Array.isArray(data?.merchants) ? data.merchants : []);
    } catch {
      setMessage("Failed to load merchants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMerchants();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants.filter((m) => String(m?.status || "").toUpperCase() === "ACTIVE");

    return merchants.filter((m) => {
      if (String(m?.status || "").toUpperCase() !== "ACTIVE") return false;
      const haystack = [
        m?.merchantId,
        m?.companyName,
        m?.name,
        m?.email,
        m?.phone,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [merchants, query]);

  function beginEdit(merchant) {
    setEditForm({
      merchantId: String(merchant?.merchantId || ""),
      apiKey: String(merchant?.apiKey || ""),
      apiSecret: String(merchant?.apiSecret || ""),
      firstName: String(merchant?.firstName || ""),
      lastName: String(merchant?.lastName || ""),
      companyName: String(merchant?.companyName || ""),
      email: String(merchant?.email || ""),
      phone: String(merchant?.phone || ""),
      callbackUrl: String(merchant?.callbackUrl || ""),
      city: String(merchant?.city || ""),
      state: String(merchant?.state || ""),
      status: String(merchant?.status || "ACTIVE").toUpperCase(),
      payoutMode: String(merchant?.payoutMode || "MANUAL").toUpperCase(),
    });
    setMessage("");
  }

  function resetEdit() {
    setEditForm(emptyEditForm);
  }

  function updateEditField(key, value) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onEditSubmit(e) {
    e.preventDefault();
    if (!editForm.merchantId) return;

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/merchants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Merchant update failed.");
        return;
      }

      setMerchants((prev) =>
        prev.map((m) => (m.merchantId === data?.merchant?.merchantId ? data.merchant : m)),
      );
      setMessage(`Merchant ${data?.merchant?.merchantId || ""} updated successfully.`);
      resetEdit();
    } catch {
      setMessage("Merchant update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function onResetPassword(merchantId) {
    if (!merchantId) return;
    setResettingId(merchantId);
    setMessage("");
    setResetCredentials(null);

    try {
      const res = await fetch("/api/v1/auth/reset-merchant-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to reset merchant password.");
        return;
      }

      setResetCredentials(data?.clientCredentials || null);
      setMessage(`Merchant ${merchantId} password reset successfully.`);
    } catch {
      setMessage("Failed to reset merchant password.");
    } finally {
      setResettingId("");
    }
  }

  async function copyText(text, key) {
    const str = String(text || "");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(str);
      } else {
        const el = document.createElement("textarea");
        el.value = str;
        el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch {
      setMessage("Copy failed. Please copy manually.");
    }
  }

  return (
    <Shell title="Activate Merchant List" breadcrumb="Home > Dashboard > Activate List">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600">Manage active merchants and edit merchant details.</p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, company, name, email"
            className="w-full md:w-80 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#0f1f3d] text-white">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Merchant ID</th>
                <th className="px-3 py-2 text-left">Company Name</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-600">Loading merchants...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-600">No active merchants found.</td>
                </tr>
              ) : (
                filtered.map((m, idx) => (
                  <tr key={m.merchantId} className="border-t border-slate-200">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{m.merchantId}</td>
                    <td className="px-3 py-2">{m.companyName || "-"}</td>
                    <td className="px-3 py-2">{m.name || "-"}</td>
                    <td className="px-3 py-2">{m.email || "-"}</td>
                    <td className="px-3 py-2">{m.phone || "-"}</td>
                    <td className="px-3 py-2">{formatDate(m.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {m.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(m)}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onResetPassword(m.merchantId)}
                          disabled={resettingId === m.merchantId}
                          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {resettingId === m.merchantId ? "Resetting..." : "Resend/Reset Password"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {resetCredentials ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Merchant Client Credentials</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p>Email: {resetCredentials.email}</p>
              <button
                type="button"
                onClick={() => copyText(resetCredentials.email, "email")}
                className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white"
              >
                {copiedKey === "email" ? "Copied" : "Copy Email"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p>Password: {resetCredentials.password}</p>
              <button
                type="button"
                onClick={() => copyText(resetCredentials.password, "password")}
                className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white"
              >
                {copiedKey === "password" ? "Copied" : "Copy Password"}
              </button>
            </div>
            <p>Role: {resetCredentials.role}</p>
            <button
              type="button"
              onClick={() => copyText(`Email: ${resetCredentials.email}\nPassword: ${resetCredentials.password}\nRole: ${resetCredentials.role}`, "all")}
              className="mt-2 rounded-md bg-slate-700 px-3 py-1 text-xs font-medium text-white"
            >
              {copiedKey === "all" ? "Copied" : "Copy All"}
            </button>
          </div>
        ) : null}

        {editForm.merchantId ? (
          <form onSubmit={onEditSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Edit Merchant: {editForm.merchantId}</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">API Key</label>
                <input
                  value={editForm.apiKey}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">API Secret</label>
                <input
                  value={editForm.apiSecret}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">First Name</label>
                <input
                  value={editForm.firstName}
                  onChange={(e) => updateEditField("firstName", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Last Name</label>
                <input
                  value={editForm.lastName}
                  onChange={(e) => updateEditField("lastName", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Company Name</label>
                <input
                  value={editForm.companyName}
                  onChange={(e) => updateEditField("companyName", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Email</label>
                <input
                  value={editForm.email}
                  onChange={(e) => updateEditField("email", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => updateEditField("phone", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => updateEditField("status", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Payout Mode</label>
                <select
                  value={editForm.payoutMode}
                  onChange={(e) => updateEditField("payoutMode", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="AUTO">AUTO</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">City</label>
                <input
                  value={editForm.city}
                  onChange={(e) => updateEditField("city", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">State</label>
                <input
                  value={editForm.state}
                  onChange={(e) => updateEditField("state", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Callback URL</label>
              <input
                value={editForm.callbackUrl}
                onChange={(e) => updateEditField("callbackUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={resetEdit}
                className="rounded-lg bg-slate-500 px-4 py-2 text-sm font-medium text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </Shell>
  );
}

