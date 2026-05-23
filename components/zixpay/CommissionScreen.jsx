"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/zixpay/Shell";

const entryOptions = [10, 25, 50, 100];
const providerOptions = ["OPENMONEY"];

const initialForm = {
  id: 0,
  merchantId: "",
  provider: "OPENMONEY",
  fromAmount: "",
  toAmount: "",
  commission: "",
  gst: "",
  isSurcharge: false,
};

function formatMoney(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommissionScreen({ commissionType = "PAYIN" }) {
  const isPayin = commissionType === "PAYIN";
  const title = isPayin ? "PG Charges" : "Payout Charges";
  const breadcrumb = isPayin ? "Home > Setting > PG Charges" : "Home > Setting > Payout Charges";

  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const totalPages = Math.max(1, Math.ceil(total / size));

  function resetForm() {
    setForm(initialForm);
  }

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadRows() {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      params.set("type", commissionType);
      params.set("page", String(page));
      params.set("size", String(size));
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/v1/commission?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setRows([]);
        setTotal(0);
        setMessage(data?.message || "Failed to load commission settings.");
        return;
      }
      setRows(Array.isArray(data?.records) ? data.records : []);
      setTotal(Number(data?.total || 0));
    } catch {
      setRows([]);
      setTotal(0);
      setMessage("Failed to load commission settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, merchantsRes] = await Promise.all([
          fetch("/api/v1/auth/me", { cache: "no-store" }),
          fetch("/api/v1/merchants", { cache: "no-store" }),
        ]);
        const meData = await meRes.json();
        const merchantsData = await merchantsRes.json();

        if (cancelled) return;

        if (meRes.ok) {
          setRole(String(meData?.user?.role || ""));
        } else {
          setMessage(meData?.message || "Failed to load user");
        }

        if (merchantsRes.ok) {
          setMerchants(Array.isArray(merchantsData?.merchants) ? merchantsData.merchants : []);
        }
      } catch {
        if (!cancelled) setMessage("Failed to initialize commission settings.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role !== "ADMIN") {
      setLoading(false);
      return;
    }
    loadRows();
  }, [role, page, size, searchQuery, commissionType]);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!form.merchantId) {
      setMessage("Merchant is required.");
      return;
    }
    if (!form.fromAmount || !form.toAmount || !form.commission) {
      setMessage("From Amount, To Amount and Commission are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: form.id || undefined,
        merchantId: form.merchantId,
        provider: form.provider,
        commissionType,
        fromAmount: Number(form.fromAmount),
        toAmount: Number(form.toAmount),
        commission: Number(form.commission),
        gst: Number(form.gst || 0),
        isSurcharge: form.isSurcharge,
      };

      const res = await fetch("/api/v1/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to save commission setting.");
        return;
      }

      setMessage(form.id ? "Commission setting updated successfully." : "Commission setting added successfully.");
      resetForm();
      await loadRows();
    } catch {
      setMessage("Failed to save commission setting.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    const confirmed = window.confirm("Delete this commission setting?");
    if (!confirmed) return;
    setMessage("");
    try {
      const res = await fetch(`/api/v1/commission?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to delete commission setting.");
        return;
      }
      setMessage("Commission setting deleted.");
      await loadRows();
    } catch {
      setMessage("Failed to delete commission setting.");
    }
  }

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <Shell title={title} breadcrumb={breadcrumb}>
      {role && role !== "ADMIN" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          This section is available only for admin users.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-3xl font-bold text-slate-900">Add / Update {isPayin ? "PG" : "Payout"} Charges</h2>
        <form onSubmit={onSubmit} className="mt-4 grid md:grid-cols-5 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">Merchant ID *</label>
            <select
              value={form.merchantId}
              onChange={(e) => updateForm("merchantId", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-Please Select-</option>
              {merchants.map((m) => (
                <option key={m.merchantId} value={m.merchantId}>
                  {m.merchantId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Provider *</label>
            <select
              value={form.provider}
              onChange={(e) => updateForm("provider", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {providerOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">From Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.fromAmount}
              onChange={(e) => updateForm("fromAmount", e.target.value)}
              placeholder="From"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">To Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.toAmount}
              onChange={(e) => updateForm("toAmount", e.target.value)}
              placeholder="To"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Commission *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.commission}
              onChange={(e) => updateForm("commission", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">GST *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.gst}
              onChange={(e) => updateForm("gst", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 mt-6">
            <input
              id={`surcharge-${commissionType}`}
              type="checkbox"
              checked={form.isSurcharge}
              onChange={(e) => updateForm("isSurcharge", e.target.checked)}
            />
            <label htmlFor={`surcharge-${commissionType}`} className="text-sm font-semibold text-slate-800">
              Surcharge (unchecked means Flat)
            </label>
          </div>

          <div className="md:col-span-5 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-2 text-white font-medium disabled:opacity-60"
            >
              {saving ? "Saving..." : form.id ? "Update" : "Submit"}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-6 py-2 text-sm font-medium"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-indigo-600">Copy</button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-emerald-600">CSV</button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-emerald-600">Excel</button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-amber-500">Print</button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label htmlFor={`commission-search-${commissionType}`}>Search:</label>
            <input
              id={`commission-search-${commissionType}`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearchQuery(searchInput.trim());
                }
              }}
              className="w-56 rounded-full border border-slate-300 px-3 py-1.5"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-sky-50 p-3">
          <div className="text-sm">
            Show{" "}
            <select
              value={size}
              onChange={(e) => {
                setPage(1);
                setSize(Number(e.target.value));
              }}
              className="rounded-lg border border-slate-300 px-2 py-1"
            >
              {entryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>{" "}
            entries
          </div>
          <p className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700">
            Showing {from} to {to} of {total} entries
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-blue-500">
          <table className="min-w-full text-sm">
            <thead className="bg-[#0f1f3d] text-white">
              <tr>
                <th className="px-3 py-2 text-left">Merchant ID</th>
                <th className="px-3 py-2 text-left">Provider Name</th>
                <th className="px-3 py-2 text-left">From Amount</th>
                <th className="px-3 py-2 text-left">To Amount</th>
                <th className="px-3 py-2 text-left">Commission</th>
                <th className="px-3 py-2 text-left">GST</th>
                <th className="px-3 py-2 text-left">Flat / Surcharge</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-600">
                    Loading commission settings...
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-600">
                    No data available in table.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">{row.merchantId}</td>
                    <td className="px-3 py-2">{row.provider}</td>
                    <td className="px-3 py-2">{formatMoney(row.fromAmount)}</td>
                    <td className="px-3 py-2">{formatMoney(row.toAmount)}</td>
                    <td className="px-3 py-2">{formatMoney(row.commission)}</td>
                    <td className="px-3 py-2">{formatMoney(row.gst)}</td>
                    <td className="px-3 py-2">{row.isSurcharge ? "Surcharge" : "Flat"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              id: row.id,
                              merchantId: row.merchantId,
                              provider: row.provider,
                              fromAmount: String(row.fromAmount),
                              toAmount: String(row.toAmount),
                              commission: String(row.commission),
                              gst: String(row.gst),
                              isSurcharge: row.isSurcharge,
                            })
                          }
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.id)}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </Shell>
  );
}

