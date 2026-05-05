"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/payvision/Shell";

const initialFilters = {
  fromDate: "",
  toDate: "",
  merchantId: "",
  status: "ALL",
  query: "",
};

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayoutReportPage() {
  const [role, setRole] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [statusBusyRef, setStatusBusyRef] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, size: 50, total: 0, totalPages: 1 });

  async function loadMerchants() {
    try {
      const res = await fetch("/api/v1/merchants", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      setMerchants(Array.isArray(data?.merchants) ? data.merchants : []);
    } catch {
    }
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.merchantId) params.set("merchantId", filters.merchantId);
    if (filters.status) params.set("status", filters.status);
    if (filters.query) params.set("query", filters.query);
    params.set("page", String(page));
    params.set("size", String(size));
    return params.toString();
  }, [filters, page, size]);

  async function loadReport() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/v1/reports/payout?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to load payout report.");
        return;
      }
      setRows(Array.isArray(data?.records) ? data.records : []);
      setPagination(data?.pagination || { page: 1, size, total: 0, totalPages: 1 });
    } catch {
      setMessage("Failed to load payout report.");
    } finally {
      setLoading(false);
    }
  }

  async function onCheckStatus(refId) {
    const safeRef = String(refId || "").trim();
    if (!safeRef) return;

    setStatusBusyRef(safeRef);
    setMessage("");
    try {
      const res = await fetch("/api/v1/payout/status-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ RefId: safeRef, Service_Id: "2" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Status check failed.");
        return;
      }
      setMessage(`Status refreshed for RefID: ${safeRef}`);
      await loadReport();
    } catch {
      setMessage("Status check failed.");
    } finally {
      setStatusBusyRef("");
    }
  }

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setRole(String(data?.user?.role || ""));
        }
      } catch {
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    loadMerchants();
  }, []);

  useEffect(() => {
    loadReport();
  }, [queryString]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function onReset() {
    setFilters(initialFilters);
    setPage(1);
    setSize(50);
  }

  return (
    <Shell title="Payout Report" breadcrumb="Home > Reports > Payout Report">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">From Date</label>
            <input type="date" value={filters.fromDate} onChange={(e) => updateFilter("fromDate", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">To Date</label>
            <input type="date" value={filters.toDate} onChange={(e) => updateFilter("toDate", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {role !== "CLIENT" ? (
            <div>
              <label className="text-sm font-semibold text-slate-800">Merchant ID</label>
              <select value={filters.merchantId} onChange={(e) => updateFilter("merchantId", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="">-Please Select-</option>
                {merchants.map((m) => (
                  <option key={m.merchantId} value={m.merchantId}>{m.merchantId}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="text-sm font-semibold text-slate-800">Status</label>
            <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="ALL">ALL</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">TxnId/BankRRN/RefNo</label>
            <input value={filters.query} onChange={(e) => updateFilter("query", e.target.value)} placeholder="TxnId/BankRRN/RefNo" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => loadReport()} className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-2 text-white font-medium">Search</button>
          <button type="button" onClick={onReset} className="rounded-xl bg-slate-500 px-6 py-2 text-white font-medium">Reset</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span>Show</span>
            <select value={size} onChange={(e) => { setPage(1); setSize(Number(e.target.value)); }} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#0f1f3d] text-white">
              <tr>
                <th className="px-3 py-2 text-left">S.No</th>
                <th className="px-3 py-2 text-left">Merchant ID</th>
                <th className="px-3 py-2 text-left">Txn Date</th>
                <th className="px-3 py-2 text-left">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">TxnID</th>
                <th className="px-3 py-2 text-left">BankRRN</th>
                <th className="px-3 py-2 text-left">Ref No</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-600">Loading payout transactions...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-600">No records found.</td></tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">{idx + 1 + (pagination.page - 1) * pagination.size}</td>
                    <td className="px-3 py-2">{r.merchantId || "-"}</td>
                    <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2">{money(r.amount)}</td>
                    <td className="px-3 py-2">{r.status || "-"}</td>
                    <td className="px-3 py-2">{r.txnId || "-"}</td>
                    <td className="px-3 py-2">{r.bankRrn || "-"}</td>
                    <td className="px-3 py-2">{r.clientRefNo || "-"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onCheckStatus(r.clientRefNo)}
                        disabled={!r.clientRefNo || statusBusyRef === r.clientRefNo}
                        className="rounded-lg bg-slate-700 px-3 py-1 text-white disabled:opacity-60"
                      >
                        {statusBusyRef === r.clientRefNo ? "Checking..." : "Check Status"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="disabled:opacity-40">Previous</button>
          <p>Page {pagination.page} of {pagination.totalPages} | Total Records: {pagination.total}</p>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} className="disabled:opacity-40">Next</button>
        </div>

        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </Shell>
  );
}
