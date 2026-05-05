"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/payvision/Shell";

const entryOptions = [10, 25, 50, 100];

function formatMoney(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

export default function PayoutWalletPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditBusy, setCreditBusy] = useState(false);
  const [creditForm, setCreditForm] = useState({
    merchantId: "",
    currentBalance: 0,
    amount: "",
    narration: "",
    transactionPin: "",
  });
  const [payoutActionType, setPayoutActionType] = useState("CREDIT");
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewMerchantId, setViewMerchantId] = useState("");
  const [viewRows, setViewRows] = useState([]);

  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const totalPages = Math.max(1, Math.ceil(total / size));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) {
            setRole(String(data?.user?.role || ""));
          } else {
            setMessage(data?.message || "Failed to load user");
          }
        }
      } catch {
        if (!cancelled) setMessage("Failed to load user");
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

    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("size", String(size));
        if (searchQuery) params.set("q", searchQuery);

        const res = await fetch(`/api/v1/wallet/payin?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) {
            setRows([]);
            setTotal(0);
            setMessage(data?.message || "Failed to load payout wallet balances.");
            return;
          }

          setRows(Array.isArray(data?.records) ? data.records : []);
          setTotal(Number(data?.total || 0));
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setMessage("Failed to load payout wallet balances.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, page, size, searchQuery]);

  const displayRows = useMemo(() => rows, [rows]);

  function openCreditModal(row, actionType = "CREDIT") {
    setMessage("");
    setPayoutActionType(actionType === "DEBIT" ? "DEBIT" : "CREDIT");
    setCreditForm({
      merchantId: row.merchantId,
      currentBalance: Number(row.payoutBalance || 0),
      amount: "",
      narration: "",
      transactionPin: "",
    });
    setCreditModalOpen(true);
  }

  function closeCreditModal() {
    if (creditBusy) return;
    setCreditModalOpen(false);
  }

  async function openViewModal(row) {
    const merchantId = String(row?.merchantId || "").trim();
    if (!merchantId) return;

    setViewModalOpen(true);
    setViewLoading(true);
    setViewMerchantId(merchantId);
    setViewRows([]);
    setMessage("");

    try {
      const allRecords = [];
      let nextPage = 1;
      let totalPagesFromApi = 1;

      while (nextPage <= totalPagesFromApi) {
        const params = new URLSearchParams();
        params.set("merchantId", merchantId);
        params.set("page", String(nextPage));
        params.set("size", "100");

        const res = await fetch(`/api/v1/reports/payout?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load payout transactions.");
        }

        const records = Array.isArray(data?.records) ? data.records : [];
        allRecords.push(...records);
        totalPagesFromApi = Number(data?.pagination?.totalPages || 1);
        nextPage += 1;
      }

      setViewRows(allRecords);
    } catch (error) {
      setMessage(error?.message || "Failed to load payout transactions.");
    } finally {
      setViewLoading(false);
    }
  }

  function closeViewModal() {
    if (viewLoading) return;
    setViewModalOpen(false);
  }

  async function submitCredit() {
    const merchantId = String(creditForm.merchantId || "").trim();
    const amount = Number(creditForm.amount);
    const narration = String(creditForm.narration || "").trim();
    const transactionPin = String(creditForm.transactionPin || "").trim();

    if (!merchantId) {
      setMessage("Merchant ID is missing.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Add Amount must be greater than 0.");
      return;
    }
    if (!narration) {
      setMessage("Narration is required.");
      return;
    }
    if (!transactionPin) {
      setMessage("Transaction PIN is required.");
      return;
    }

    setCreditBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/wallet/payout/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, amount, narration, transactionPin, actionType: payoutActionType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || `Failed to ${payoutActionType.toLowerCase()} payout balance.`);
        return;
      }

      const nextBalance = Number(data?.record?.payoutBalance || 0);
      setRows((prev) =>
        prev.map((row) =>
          row.merchantId === merchantId
            ? {
                ...row,
                payoutBalance: nextBalance,
              }
            : row,
        ),
      );
      setCreditModalOpen(false);
      setMessage(`Payout wallet ${payoutActionType.toLowerCase()}ed successfully for ${merchantId}.`);
    } catch {
      setMessage(`Failed to ${payoutActionType.toLowerCase()} payout balance.`);
    } finally {
      setCreditBusy(false);
    }
  }

  return (
    <Shell title="Payout Passbook" breadcrumb="Dashboard > Payout Passbook">
      {role && role !== "ADMIN" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          This section is available only for admin users.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-indigo-600">Copy</button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-emerald-600">CSV</button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-emerald-600">Excel</button>
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-amber-500">Print</button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="wallet-search">Search:</label>
            <input
              id="wallet-search"
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
                <th className="px-3 py-2 text-left">S.No</th>
                <th className="px-3 py-2 text-left">Merchant ID</th>
                <th className="px-3 py-2 text-left">Company Name</th>
                <th className="px-3 py-2 text-left">Contact Number</th>
                <th className="px-3 py-2 text-left">Email Id</th>
                <th className="px-3 py-2 text-left">Payout Balance</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-600">
                    Loading payout wallet balances...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-600">
                    No records found.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, index) => (
                  <tr key={row.merchantId} className="border-t border-slate-200">
                    <td className="px-3 py-2">{(page - 1) * size + index + 1}</td>
                    <td className="px-3 py-2">{row.merchantId}</td>
                    <td className="px-3 py-2">{row.companyName || "-"}</td>
                    <td className="px-3 py-2 font-semibold">{row.contactNumber || "-"}</td>
                    <td className="px-3 py-2">{row.emailId || "-"}</td>
                    <td className="px-3 py-2">{formatMoney(row.payoutBalance)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/wallet/payout/history?merchantId=${encodeURIComponent(row.merchantId)}`)}
                          className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white"
                          title="View"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreditModal(row, "CREDIT")}
                          className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white"
                          title="Credit"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreditModal(row, "DEBIT")}
                          className="rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white"
                          title="Debit"
                        >
                          -
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

      {viewModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex h-[80vh] w-full max-w-6xl flex-col rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-800">Payout Transactions - {viewMerchantId}</h3>
              <button
                type="button"
                onClick={closeViewModal}
                className="text-2xl leading-none text-slate-500 hover:text-slate-700"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">S.No</th>
                      <th className="px-3 py-2 text-left">Created At</th>
                      <th className="px-3 py-2 text-left">Client Ref</th>
                      <th className="px-3 py-2 text-left">Txn ID</th>
                      <th className="px-3 py-2 text-left">Bank RRN</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Charge</th>
                      <th className="px-3 py-2 text-left">GST</th>
                      <th className="px-3 py-2 text-left">Provider</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewLoading ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-slate-600">
                          Loading payout transactions...
                        </td>
                      </tr>
                    ) : viewRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-slate-600">
                          No payout transactions found.
                        </td>
                      </tr>
                    ) : (
                      viewRows.map((item, idx) => (
                        <tr key={`${item.id || item.clientRefNo || idx}`} className="border-t border-slate-200">
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                          <td className="px-3 py-2">{item.clientRefNo || "-"}</td>
                          <td className="px-3 py-2">{item.txnId || "-"}</td>
                          <td className="px-3 py-2">{item.bankRrn || "-"}</td>
                          <td className="px-3 py-2">{formatMoney(item.amount)}</td>
                          <td className="px-3 py-2">{formatMoney(item.charge)}</td>
                          <td className="px-3 py-2">{formatMoney(item.gst)}</td>
                          <td className="px-3 py-2">{item.provider || "-"}</td>
                          <td className="px-3 py-2">{item.status || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-300 px-4 py-3">
              <button
                type="button"
                onClick={closeViewModal}
                disabled={viewLoading}
                className="rounded-xl bg-slate-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creditModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3">
              <h3 className="text-xl font-semibold text-slate-800">
                {payoutActionType === "DEBIT" ? "Deduct Amount from Merchant Wallet" : "Add Amount to Merchant Wallet"}
              </h3>
              <button
                type="button"
                onClick={closeCreditModal}
                className="text-3xl leading-none text-slate-500 hover:text-slate-700"
              >
                x
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              <div>
                <label className="text-sm font-semibold text-slate-800">Merchant ID</label>
                <input
                  value={creditForm.merchantId}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Current Wallet Balance</label>
                <input
                  value={formatMoney(creditForm.currentBalance)}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Add Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditForm.amount}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Narration *</label>
                <input
                  value={creditForm.narration}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, narration: e.target.value }))}
                  placeholder={payoutActionType === "DEBIT" ? "Reason for deduction" : "Reason for credit"}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Transaction PIN *</label>
                <input
                  type="password"
                  value={creditForm.transactionPin}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, transactionPin: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-300 px-4 py-3">
              <button
                type="button"
                onClick={submitCredit}
                disabled={creditBusy}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {creditBusy ? "Submitting..." : payoutActionType === "DEBIT" ? "Deduct Wallet" : "Add Wallet"}
              </button>
              <button
                type="button"
                onClick={closeCreditModal}
                disabled={creditBusy}
                className="rounded-xl bg-slate-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </Shell>
  );
}
