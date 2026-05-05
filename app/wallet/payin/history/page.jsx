"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/payvision/Shell";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

function money(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseProviderRaw(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function PayinWalletHistoryContent() {
  const searchParams = useSearchParams();
  const merchantId = String(searchParams.get("merchantId") || "").trim();

  const [filters, setFilters] = useState(() => ({
    fromDate: toYmd(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    toDate: toYmd(new Date()),
    query: "",
    page: 1,
    size: 50,
  }));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, size: 50, total: 0, totalPages: 1 });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (merchantId) params.set("merchantId", merchantId);
    params.set("status", "SUCCESS");
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.query) params.set("query", filters.query);
    params.set("page", String(filters.page));
    params.set("size", String(filters.size));
    return params.toString();
  }, [filters, merchantId]);

  async function loadHistory() {
    if (!merchantId) {
      setMessage("merchantId is required.");
      setRows([]);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/v1/reports/transactions?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to load payin passbook history.");
        setRows([]);
        return;
      }
      const records = Array.isArray(data?.records) ? data.records : [];
      setRows(records);
      setPagination(data?.pagination || { page: 1, size: filters.size, total: 0, totalPages: 1 });
    } catch {
      setMessage("Failed to load payin passbook history.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function onReset() {
    setFilters({
      fromDate: "",
      toDate: "",
      query: "",
      page: 1,
      size: 50,
    });
  }

  const viewRows = useMemo(() => {
    return rows.map((r, idx) => {
      const parsed = parseProviderRaw(r.providerRaw);
      const actionType = String(parsed?.actionType || "").toUpperCase();
      const narration = String(parsed?.narration || parsed?.type || "Transaction").trim();

      const baseAmount = Number(r.amount || 0);
      const charge = Number(r.charge || 0);
      const gst = Number(r.gst || 0);
      const net = Number(r.balance || 0);

      let credit = 0;
      let debit = 0;

      if (actionType === "DEBIT") {
        debit = baseAmount;
      } else {
        credit = net || baseAmount;
      }

      return {
        id: r.id || `${r.clientRefNo || "R"}-${idx}`,
        merchantId: r.merchantId || merchantId,
        date: r.createdAt,
        transactionId: r.clientRefNo || r.providerRef || "-",
        narration,
        credit,
        debit,
        charge,
        gst,
        balance: net,
      };
    });
  }, [rows, merchantId]);

  return (
    <Shell title="Payin Passbook History" breadcrumb="Dashboard > Payin Passbook > Payin Passbook History">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">From Date</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, fromDate: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">To Date</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, toDate: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">Transaction ID</label>
            <input
              value={filters.query}
              onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, query: e.target.value }))}
              placeholder="Enter Transaction ID"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={loadHistory} className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-2 text-white font-medium">Search</button>
          <button type="button" onClick={onReset} className="rounded-xl bg-slate-500 px-6 py-2 text-white font-medium">Reset</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-semibold">Merchant ID:</span> {merchantId || "-"}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span>Show</span>
            <select
              value={filters.size}
              onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, size: Number(e.target.value) }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
          <p className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700">
            Showing {rows.length > 0 ? (pagination.page - 1) * pagination.size + 1 : 0} to {Math.min(pagination.page * pagination.size, pagination.total)} of {pagination.total} entries
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-[#0f1f3d] text-white">
              <tr>
                <th className="px-3 py-2 text-left">S.No</th>
                <th className="px-3 py-2 text-left">Merchant ID</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Transaction ID</th>
                <th className="px-3 py-2 text-left">Narration</th>
                <th className="px-3 py-2 text-left">Credit</th>
                <th className="px-3 py-2 text-left">Debit</th>
                <th className="px-3 py-2 text-left">Charge</th>
                <th className="px-3 py-2 text-left">GST</th>
                <th className="px-3 py-2 text-left">Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-600">Loading payin passbook history...</td>
                </tr>
              ) : viewRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-600">No records found.</td>
                </tr>
              ) : (
                viewRows.map((row, idx) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">{(pagination.page - 1) * pagination.size + idx + 1}</td>
                    <td className="px-3 py-2">{row.merchantId}</td>
                    <td className="px-3 py-2">{formatDateTime(row.date)}</td>
                    <td className="px-3 py-2 font-semibold">{row.transactionId}</td>
                    <td className="px-3 py-2">{row.narration}</td>
                    <td className="px-3 py-2 text-emerald-700 font-semibold">{money(row.credit)}</td>
                    <td className="px-3 py-2 text-rose-700 font-semibold">{money(row.debit)}</td>
                    <td className="px-3 py-2">{money(row.charge)}</td>
                    <td className="px-3 py-2">{money(row.gst)}</td>
                    <td className="px-3 py-2">{money(row.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
          <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))} className="disabled:opacity-40">Previous</button>
          <p>Page {pagination.page} of {pagination.totalPages} | Total Records: {pagination.total}</p>
          <button type="button" disabled={filters.page >= pagination.totalPages} onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))} className="disabled:opacity-40">Next</button>
        </div>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </Shell>
  );
}

export default function PayinWalletHistoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading...</div>}>
      <PayinWalletHistoryContent />
    </Suspense>
  );
}
