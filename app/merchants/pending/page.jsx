"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/payvision/Shell";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

export default function PendingMerchantPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [merchants, setMerchants] = useState([]);

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

  const pendingMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter((m) => {
      if (String(m?.status || "").toUpperCase() !== "PENDING") return false;
      if (!q) return true;
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

  async function changeStatus(merchant, status) {
    const merchantId = String(merchant?.merchantId || "");
    if (!merchantId) return;
    setSavingId(merchantId);
    setMessage("");

    try {
      const res = await fetch("/api/v1/merchants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId,
          firstName: merchant.firstName,
          lastName: merchant.lastName,
          companyName: merchant.companyName,
          email: merchant.email,
          phone: merchant.phone,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Status update failed.");
        return;
      }

      setMerchants((prev) =>
        prev.map((m) => (m.merchantId === data?.merchant?.merchantId ? data.merchant : m)),
      );
      setMessage(`Merchant ${merchantId} moved to ${status}.`);
    } catch {
      setMessage("Status update failed.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <Shell title="Pending Merchant" breadcrumb="Home > Dashboard > Pending Merchant">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600">Review merchants with pending status.</p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pending merchants"
            className="w-full md:w-80 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#0f1f3d] text-white">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Merchant ID</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-600">Loading pending merchants...</td>
                </tr>
              ) : pendingMerchants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-600">No pending merchants found.</td>
                </tr>
              ) : (
                pendingMerchants.map((m, idx) => (
                  <tr key={m.merchantId} className="border-t border-slate-200">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{m.merchantId}</td>
                    <td className="px-3 py-2">{m.companyName || "-"}</td>
                    <td className="px-3 py-2">{m.name || "-"}</td>
                    <td className="px-3 py-2">{m.email || "-"}</td>
                    <td className="px-3 py-2">{m.phone || "-"}</td>
                    <td className="px-3 py-2">{formatDate(m.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingId === m.merchantId}
                          onClick={() => changeStatus(m, "ACTIVE")}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={savingId === m.merchantId}
                          onClick={() => changeStatus(m, "INACTIVE")}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </Shell>
  );
}

