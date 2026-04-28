"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/payvision/Shell";

const paymentModes = [
  { value: "1", label: "IMPS" },
  { value: "2", label: "NEFT" },
  { value: "3", label: "RTGS" },
];

const initialForm = {
  merchantId: "",
  accountNumber: "",
  mobileNumber: "",
  paymentMode: "2",
  amount: "",
  accountName: "",
  ifsc: "",
  latlong: "0,0",
  accountType: "savings",
  bankName: "",
};

function parseResponseText(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function deriveAccounts(rows) {
  const requests = [];
  rows.forEach((row) => {
    let parsed = {};
    try {
      parsed = row?.providerRaw ? JSON.parse(row.providerRaw) : {};
    } catch {
      parsed = {};
    }
    const req = parsed?.payOrderRequest || {};
    const accountNumber = String(req?.AccountNo || "").trim();
    const ifsc = String(req?.IFSC || "").trim();
    if (!accountNumber || !ifsc) return;
    requests.push({
      bankName: String(req?.BankName || "").trim(),
      ifsc,
      accountName: String(req?.HolderName || "").trim(),
      accountNumber,
      parentId: String(row?.merchantId || "").trim(),
      acType: String(req?.AccountType || "").trim(),
      refId: String(req?.RefID || row?.clientRefNo || "").trim(),
      status: String(row?.status || "").trim() || "PENDING",
    });
  });
  return requests;
}

export default function WalletPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [form, setForm] = useState(initialForm);
  const [accounts, setAccounts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [statusBusyRef, setStatusBusyRef] = useState("");
  const [lastRefId, setLastRefId] = useState("");
  const [lastStatusPayload, setLastStatusPayload] = useState(null);
  const [message, setMessage] = useState("");

  const selectedMerchantId = useMemo(() => {
    if (role === "ADMIN") return form.merchantId;
    return form.merchantId;
  }, [role, form.merchantId]);

  async function loadUser() {
    const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to load user");
    }
    const nextRole = String(data?.user?.role || "");
    const nextMerchantId = String(data?.user?.merchantId || "");
    setRole(nextRole);
    if (nextRole === "CLIENT" && nextMerchantId) {
      setForm((prev) => ({ ...prev, merchantId: nextMerchantId }));
    }
    return { role: nextRole, merchantId: nextMerchantId };
  }

  async function loadMerchants() {
    const res = await fetch("/api/v1/merchants", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    const list = Array.isArray(data?.merchants) ? data.merchants : [];
    setMerchants(list);
  }

  async function loadRequests(merchantIdForAdmin = "") {
    try {
      const params = new URLSearchParams();
      params.set("size", "20");
      if (merchantIdForAdmin) params.set("merchantId", merchantIdForAdmin);
      const res = await fetch(`/api/v1/reports/payout?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to load account details.");
        return;
      }
      const rows = Array.isArray(data?.records) ? data.records : [];
      setAccounts(deriveAccounts(rows));
    } catch {
      setMessage("Failed to load account details.");
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await loadUser();
        if (user.role === "ADMIN") {
          router.replace("/wallet/payin");
          return;
        }
        await loadMerchants();
        if (!mounted) return;
        await loadRequests();
      } catch (error) {
        if (mounted) setMessage(error?.message || "Failed to initialize wallet.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (role === "ADMIN") {
      loadRequests(form.merchantId || "");
    }
  }, [role, form.merchantId]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateForm() {
    if (!selectedMerchantId) return "Merchant is required.";
    if (!form.accountNumber.trim()) return "AccountNo is required.";
    if (!form.mobileNumber.trim()) return "MobileNumber is required.";
    if (!form.paymentMode.trim()) return "PaymentMode is required.";
    if (!form.bankName.trim()) return "Bank Name is required.";
    if (!form.ifsc.trim()) return "IFSC is required.";
    if (!form.accountName.trim()) return "Account Name is required.";
    if (!form.amount || Number(form.amount) <= 0) return "Amount must be greater than 0.";
    if (!form.latlong.trim()) return "latlong is required.";
    if (!form.accountType.trim()) return "AccountType is required.";
    return "";
  }

  async function checkPayoutStatus(refId) {
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
      setLastStatusPayload(data);
      setMessage(`Status refreshed for RefID: ${safeRef}`);
      await loadRequests(role === "ADMIN" ? selectedMerchantId : "");
    } catch {
      setMessage("Status check failed.");
    } finally {
      setStatusBusyRef("");
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMessage("");
    const validationError = validateForm();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const tokenRes = await fetch("/api/v1/openmoney/auth/client-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: selectedMerchantId }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        setMessage(tokenData?.message || "Failed to get OpenMoney token.");
        return;
      }

      const bearer = String(tokenData?.token || "").trim();
      if (!bearer) {
        setMessage("Invalid OpenMoney token response.");
        return;
      }

      const payload = {
        AccountNo: form.accountNumber.trim(),
        MobileNumber: form.mobileNumber.trim(),
        PaymentMode: Number(form.paymentMode || "2"),
        Amount: Number(form.amount),
        HolderName: form.accountName.trim(),
        IFSC: form.ifsc.trim(),
        latlong: form.latlong.trim(),
        AccountType: form.accountType,
        BankName: form.bankName.trim(),
      };

      const payRes = await fetch("/api/v1/payout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(payload),
      });

      const payText = await payRes.text();
      const payData = parseResponseText(payText);
      const generatedRefId =
        String(
          payRes.headers.get("x-payvision-refid") ||
            payData?.data?.ref_id ||
            payData?.ref_id ||
            payData?.RefID ||
            "",
        ).trim();

      if (!payRes.ok) {
        setMessage(payData?.message || "Payout request failed.");
        return;
      }

      setLastRefId(generatedRefId);
      setLastStatusPayload(null);
      setMessage(`Payout request submitted. RefID: ${generatedRefId || "-"}`);

      const accountKey = `${payload.AccountNo}|${payload.IFSC}`;
      setAccounts((prev) => {
        const exists = prev.some((item) => `${item.accountNumber}|${item.ifsc}` === accountKey);
        if (exists) return prev;
        return [
          ...prev,
          {
            bankName: payload.BankName,
            ifsc: payload.IFSC,
            accountName: payload.HolderName,
            accountNumber: payload.AccountNo,
            parentId: selectedMerchantId,
            acType: payload.AccountType,
          },
        ];
      });

      setForm((prev) => ({
        ...prev,
        amount: "",
      }));
      await loadRequests(role === "ADMIN" ? selectedMerchantId : "");
    } catch {
      setMessage("Payout request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell title="Fund Request Account Details" breadcrumb="Home > Dashboard > Fund Request Account Details">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-3 py-2 text-left">S.No</th>
                <th className="px-3 py-2 text-left">BankName</th>
                <th className="px-3 py-2 text-left">IFSC</th>
                <th className="px-3 py-2 text-left">AccountName</th>
                <th className="px-3 py-2 text-left">AccountNumber</th>
                <th className="px-3 py-2 text-left">ParentId</th>
                <th className="px-3 py-2 text-left">AcType</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-600">
                    No payout requests yet. Submit a fund request to populate this section.
                  </td>
                </tr>
              ) : (
                accounts.map((row, idx) => (
                  <tr key={`${row.refId || row.accountNumber}-${idx}`} className="border-t border-slate-200">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{row.bankName}</td>
                    <td className="px-3 py-2">{row.ifsc}</td>
                    <td className="px-3 py-2">{row.accountName}</td>
                    <td className="px-3 py-2">{row.accountNumber}</td>
                    <td className="px-3 py-2">{row.parentId}</td>
                    <td className="px-3 py-2">{row.acType}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => checkPayoutStatus(row.refId)}
                        disabled={!row.refId || statusBusyRef === row.refId}
                        className="rounded-lg bg-slate-700 px-3 py-1 text-white disabled:opacity-60"
                      >
                        {statusBusyRef === row.refId ? "Checking..." : "Check Status"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Fund Request</h2>
        <form onSubmit={onSubmit} className="grid md:grid-cols-3 gap-3">
          {role === "ADMIN" ? (
            <div className="md:col-span-3">
              <label className="text-sm font-semibold text-slate-800">Merchant *</label>
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
          ) : null}

          <div>
            <label className="text-sm font-semibold text-slate-800">AccountNo *</label>
            <input
              value={form.accountNumber}
              onChange={(e) => updateForm("accountNumber", e.target.value)}
              placeholder="135301503629"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">MobileNumber *</label>
            <input
              value={form.mobileNumber}
              onChange={(e) => updateForm("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="8962190343"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Bank *</label>
            <input
              value={form.bankName}
              onChange={(e) => updateForm("bankName", e.target.value)}
              placeholder="Bank Name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Payment Mode *</label>
            <select
              value={form.paymentMode}
              onChange={(e) => updateForm("paymentMode", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-Please Select-</option>
              {paymentModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Amount *</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(e) => updateForm("amount", e.target.value)}
              placeholder="Enter Amount"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">IFSC *</label>
            <input
              value={form.ifsc}
              onChange={(e) => updateForm("ifsc", e.target.value.toUpperCase())}
              placeholder="IFSC"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">HolderName *</label>
            <input
              value={form.accountName}
              onChange={(e) => updateForm("accountName", e.target.value)}
              placeholder="Ranjan Kumar Pandit"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">latlong *</label>
            <input
              value={form.latlong}
              onChange={(e) => updateForm("latlong", e.target.value)}
              placeholder="0,0"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">AccountType *</label>
            <select
              value={form.accountType}
              onChange={(e) => updateForm("accountType", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-2 text-white font-medium disabled:opacity-60"
              >
                {submitting ? "Requesting..." : "Request"}
              </button>
              {lastRefId ? (
                <button
                  type="button"
                  onClick={() => checkPayoutStatus(lastRefId)}
                  disabled={statusBusyRef === lastRefId}
                  className="rounded-xl bg-slate-700 px-6 py-2 text-white font-medium disabled:opacity-60"
                >
                  {statusBusyRef === lastRefId ? "Checking..." : `Check Status (${lastRefId})`}
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      {lastStatusPayload ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Latest Status Response</h3>
          <pre className="text-xs bg-slate-100 rounded-xl p-3 overflow-auto">{JSON.stringify(lastStatusPayload, null, 2)}</pre>
        </div>
      ) : null}
    </Shell>
  );
}
