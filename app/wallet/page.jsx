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
  merchantId: "", accountNumber: "", mobileNumber: "",
  paymentMode: "2", amount: "", accountName: "",
  ifsc: "", latlong: "0,0", accountType: "savings", bankName: "",
};

function formatMoney(v) {
  const n = Number(v); return Number.isFinite(n) ? n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}) : "0.00";
}

function parseText(t) { try { return t?JSON.parse(t):{} } catch { return {raw:t} } }

function deriveAccounts(rows) {
  return rows.flatMap(row => {
    try {
      const req = (row?.providerRaw ? JSON.parse(row.providerRaw) : {})?.payOrderRequest || {};
      const accountNumber = String(req?.AccountNo||"").trim();
      const ifsc = String(req?.IFSC||"").trim();
      if (!accountNumber||!ifsc) return [];
      return [{
        bankName: String(req?.BankName||"").trim(),
        ifsc, accountName: String(req?.HolderName||"").trim(),
        accountNumber, parentId: String(row?.merchantId||"").trim(),
        acType: String(req?.AccountType||"").trim(),
        refId: String(req?.RefID||row?.clientRefNo||"").trim(),
        status: String(row?.status||"PENDING").trim(),
      }];
    } catch { return []; }
  });
}

function Field({label, value, onChange, placeholder="", maxLength, hint, required, error, type="text"}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}{required&&<span className="text-red-500 ml-0.5">*</span>}</label>
      {hint&&<p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      <input type={type} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={e=>onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${error?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50 focus:bg-white"}`}
      />
      {error&&<p className="mt-1 text-xs text-red-600">⚠ {error}</p>}
    </div>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [form, setForm] = useState(initialForm);
  const [accounts, setAccounts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [balance, setBalance] = useState({ payinBalance: 0, payoutBalance: 0, loaded: false });
  const [submitting, setSubmitting] = useState(false);
  const [statusBusyRef, setStatusBusyRef] = useState("");
  const [lastRefId, setLastRefId] = useState("");
  const [lastStatusPayload, setLastStatusPayload] = useState(null);
  const [message, setMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const selectedMerchantId = form.merchantId;

  async function loadBalance(merchantId) {
    try {
      const params = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : "";
      const res = await fetch(`/api/v1/wallet/balance${params}`, {cache:"no-store"});
      const data = await res.json();
      if (res.ok) setBalance({payinBalance:Number(data?.payinBalance||0), payoutBalance:Number(data?.payoutBalance||0), loaded:true});
    } catch {}
  }

  async function loadUser() {
    const res = await fetch("/api/v1/auth/me", {cache:"no-store"});
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message||"Failed to load user");
    const nextRole = String(data?.user?.role||"");
    const nextMerchantId = String(data?.user?.merchantId||"");
    setRole(nextRole);
    if (nextRole==="CLIENT"&&nextMerchantId) {
      setForm(p=>({...p,merchantId:nextMerchantId}));
      loadBalance(nextMerchantId);
    }
    return {role:nextRole,merchantId:nextMerchantId};
  }

  async function loadRequests(merchantIdForAdmin="") {
    try {
      const params = new URLSearchParams({size:"20"});
      if (merchantIdForAdmin) params.set("merchantId", merchantIdForAdmin);
      const res = await fetch(`/api/v1/reports/payout?${params}`, {cache:"no-store"});
      const data = await res.json();
      if (!res.ok) { setMessage(data?.message||"Failed to load account details."); return; }
      setAccounts(deriveAccounts(Array.isArray(data?.records)?data.records:[]));
    } catch { setMessage("Failed to load account details."); }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await loadUser();
        if (user.role==="ADMIN") { router.replace("/wallet/payin"); return; }
        if (!mounted) return;
        await loadRequests();
      } catch (error) { if (mounted) setMessage(error?.message||"Failed to initialize wallet."); }
    })();
    return () => { mounted=false; };
  }, [router]);

  useEffect(() => {
    if (role==="ADMIN") { loadRequests(form.merchantId||""); loadBalance(form.merchantId); }
  }, [role, form.merchantId]);

  function updateForm(key, value) { setForm(p=>({...p,[key]:value})); if (formErrors[key]) setFormErrors(p=>({...p,[key]:""})); }

  function validateForm() {
    const errs = {};
    if (!selectedMerchantId) errs.merchantId="Merchant is required.";
    if (!form.accountNumber.trim()) errs.accountNumber="Account number is required.";
    else if (!/^\d{9,18}$/.test(form.accountNumber.trim())) errs.accountNumber="Enter a valid bank account number (9–18 digits).";
    if (!form.mobileNumber.trim()) errs.mobileNumber="Mobile number is required.";
    else if (!/^[6-9]\d{9}$/.test(form.mobileNumber.trim())) errs.mobileNumber="Enter a valid 10-digit mobile number.";
    if (!form.paymentMode.trim()) errs.paymentMode="Payment mode is required.";
    if (!form.bankName.trim()) errs.bankName="Bank name is required.";
    if (!form.ifsc.trim()) errs.ifsc="IFSC code is required.";
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) errs.ifsc="Invalid IFSC. Format: SBIN0001234";
    if (!form.accountName.trim()) errs.accountName="Bank account holder name is required.";
    const amt = Number(form.amount);
    if (!form.amount||isNaN(amt)||amt<=0) errs.amount="Amount must be greater than 0.";
    else if (balance.loaded && amt > balance.payoutBalance) errs.amount=`Amount exceeds available balance of ₹${formatMoney(balance.payoutBalance)}.`;
    if (!form.accountType.trim()) errs.accountType="Account type is required.";
    return errs;
  }

  async function checkPayoutStatus(refId) {
    const safeRef = String(refId||"").trim(); if (!safeRef) return;
    setStatusBusyRef(safeRef); setMessage("");
    try {
      const res = await fetch("/api/v1/payout/status-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({RefId:safeRef,Service_Id:"2"})});
      const data = await res.json();
      if (!res.ok) { setMessage(data?.message||"Status check failed."); return; }
      setLastStatusPayload(data); setMessage(`Status refreshed for RefID: ${safeRef}`);
      await loadRequests(role==="ADMIN"?selectedMerchantId:"");
    } catch { setMessage("Status check failed."); }
    finally { setStatusBusyRef(""); }
  }

  async function onSubmit(e) {
    e.preventDefault(); setMessage("");
    const errs = validateForm(); setFormErrors(errs);
    if (Object.keys(errs).length) { setMessage("Please fix the errors below."); return; }
    setSubmitting(true);
    try {
      const tokenRes = await fetch("/api/v1/openmoney/auth/client-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({merchantId:selectedMerchantId})});
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) { setMessage(tokenData?.message||"Failed to get token."); return; }
      const bearer = String(tokenData?.token||"").trim();
      if (!bearer) { setMessage("Invalid token response."); return; }

      const payload = {
        AccountNo: form.accountNumber.trim(), MobileNumber: form.mobileNumber.trim(),
        PaymentMode: Number(form.paymentMode||"2"), Amount: Number(form.amount),
        HolderName: form.accountName.trim(), IFSC: form.ifsc.trim().toUpperCase(),
        latlong: form.latlong.trim(), AccountType: form.accountType, BankName: form.bankName.trim(),
      };

      const payRes = await fetch("/api/v1/payout/create-order",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${bearer}`},body:JSON.stringify(payload)});
      const payText = await payRes.text();
      const payData = parseText(payText);
      const generatedRefId = String(payRes.headers.get("x-payvision-refid")||payData?.data?.ref_id||payData?.ref_id||payData?.RefID||"").trim();

      if (!payRes.ok) { setMessage(payData?.message||"Payout request failed."); return; }
      setLastRefId(generatedRefId); setLastStatusPayload(null);
      setMessage(`Payout request submitted. RefID: ${generatedRefId||"-"}`);
      setForm(p=>({...p,amount:""}));
      setFormErrors({});
      await loadBalance(selectedMerchantId);
      await loadRequests(role==="ADMIN"?selectedMerchantId:"");
    } catch { setMessage("Payout request failed."); }
    finally { setSubmitting(false); }
  }

  return (
    <Shell title="Fund Request" breadcrumb="Home > Dashboard > Fund Request">

      {/* Balance Card */}
      {balance.loaded && (
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Available Payout Balance</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">₹{formatMoney(balance.payoutBalance)}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">PG (Payin) Balance</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">₹{formatMoney(balance.payinBalance)}</p>
          </div>
        </div>
      )}

      {/* Recent Requests Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Recent Payout Requests</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                {["#","Bank","IFSC","Account Holder","Account No.","Type","Status","Action"].map(h=>(
                  <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.length===0?(
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400 text-sm">No payout requests yet.</td></tr>
              ):(
                accounts.map((row,idx)=>(
                  <tr key={`${row.refId||row.accountNumber}-${idx}`} className={`border-t border-slate-100 ${idx%2===0?"bg-white":"bg-slate-50"}`}>
                    <td className="px-3 py-2 text-slate-500">{idx+1}</td>
                    <td className="px-3 py-2 font-medium">{row.bankName||"—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.ifsc}</td>
                    <td className="px-3 py-2">{row.accountName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.accountNumber}</td>
                    <td className="px-3 py-2 capitalize">{row.acType}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status==="SUCCESS"?"bg-emerald-100 text-emerald-700":row.status==="FAILED"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-700"}`}>{row.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={()=>checkPayoutStatus(row.refId)} disabled={!row.refId||statusBusyRef===row.refId}
                        className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50">
                        {statusBusyRef===row.refId?"...":"Refresh"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fund Request Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
          <span className="text-xl">💸</span>
          <h2 className="font-bold text-slate-800">New Fund Request</h2>
        </div>

        {message&&(
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${message.includes("submitted")||message.includes("refreshed")?"bg-emerald-50 border-emerald-300 text-emerald-800":"bg-red-50 border-red-300 text-red-700"}`}>
            {message.includes("submitted")||message.includes("refreshed")?"✓":"⚠"} {message}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="grid md:grid-cols-2 gap-4">
          {role==="ADMIN"&&(
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Merchant <span className="text-red-500">*</span></label>
              <select value={form.merchantId} onChange={e=>updateForm("merchantId",e.target.value)}
                className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${formErrors.merchantId?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50"}`}>
                <option value="">— Select Merchant —</option>
                {merchants.map(m=><option key={m.merchantId} value={m.merchantId}>{m.merchantId}</option>)}
              </select>
              {formErrors.merchantId&&<p className="mt-1 text-xs text-red-600">⚠ {formErrors.merchantId}</p>}
            </div>
          )}

          <Field label="Bank Account Number" required placeholder="e.g. 135301503629" hint="9–18 digit bank account number"
            value={form.accountNumber} onChange={v=>updateForm("accountNumber",v.replace(/\D/g,""))} maxLength={18} error={formErrors.accountNumber}/>

          <Field label="Registered Mobile Number" required placeholder="e.g. 9876543210" hint="10-digit mobile linked to bank account"
            value={form.mobileNumber} onChange={v=>updateForm("mobileNumber",v.replace(/\D/g,"").slice(0,10))} maxLength={10} error={formErrors.mobileNumber}/>

          <Field label="Bank Name" required placeholder="e.g. State Bank of India"
            value={form.bankName} onChange={v=>updateForm("bankName",v)} error={formErrors.bankName}/>

          <div>
            <label className="text-sm font-semibold text-slate-700">Payment Mode <span className="text-red-500">*</span></label>
            <select value={form.paymentMode} onChange={e=>updateForm("paymentMode",e.target.value)}
              className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${formErrors.paymentMode?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50"}`}>
              <option value="">— Select Mode —</option>
              {paymentModes.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {formErrors.paymentMode&&<p className="mt-1 text-xs text-red-600">⚠ {formErrors.paymentMode}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Amount (₹) <span className="text-red-500">*</span></label>
            {balance.loaded&&<p className="text-xs text-slate-400 mt-0.5">Available: <span className="font-semibold text-emerald-600">₹{formatMoney(balance.payoutBalance)}</span></p>}
            <input type="number" min="1" step="0.01" value={form.amount}
              onChange={e=>updateForm("amount",e.target.value)} placeholder="Enter amount"
              className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${formErrors.amount?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50"}`}/>
            {formErrors.amount&&<p className="mt-1 text-xs text-red-600">⚠ {formErrors.amount}</p>}
          </div>

          <Field label="IFSC Code" required placeholder="e.g. SBIN0001234" hint="11-character bank branch code"
            value={form.ifsc} onChange={v=>updateForm("ifsc",v.toUpperCase())} maxLength={11} error={formErrors.ifsc}/>

          <Field label="Bank Account Holder Name" required placeholder="Full name as per bank records"
            value={form.accountName} onChange={v=>updateForm("accountName",v)} error={formErrors.accountName}/>

          <div>
            <label className="text-sm font-semibold text-slate-700">Account Type <span className="text-red-500">*</span></label>
            <select value={form.accountType} onChange={e=>updateForm("accountType",e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </div>

          <Field label="Latitude, Longitude" placeholder="0,0" hint="Device location (default: 0,0)"
            value={form.latlong} onChange={v=>updateForm("latlong",v)} error={formErrors.latlong}/>

          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-2.5 text-sm text-white font-semibold disabled:opacity-60 hover:opacity-90">
              {submitting?"Submitting...":"Submit Fund Request"}
            </button>
            {lastRefId&&(
              <button type="button" onClick={()=>checkPayoutStatus(lastRefId)} disabled={statusBusyRef===lastRefId}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">
                {statusBusyRef===lastRefId?"Checking...":"Check Status"}
              </button>
            )}
          </div>
        </form>
      </div>

      {lastStatusPayload&&(
        <div className="rounded-2xl border border-slate-200 bg-white p-5 mt-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2">Last Status Response</h3>
          <pre className="text-xs bg-slate-900 text-emerald-400 rounded-xl p-3 overflow-auto">{JSON.stringify(lastStatusPayload,null,2)}</pre>
        </div>
      )}
    </Shell>
  );
}
