"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/payvision/Shell";

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(String(text));
  const el = document.createElement("textarea");
  el.value = String(text);
  el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
  document.body.appendChild(el); el.focus(); el.select();
  document.execCommand("copy"); document.body.removeChild(el);
  return Promise.resolve();
}

const emptyForm = { pgCallbackUrl: "", payoutCallbackUrl: "", ipAddress: "", ipAddressStatus: "INACTIVE" };

export default function ApiSettingsPage() {
  const [merchants, setMerchants] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [apiCreds, setApiCreds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    fetch("/api/v1/merchants?size=200", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setMerchants(Array.isArray(d?.merchants) ? d.merchants : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) { setForm(emptyForm); setApiCreds(null); return; }
    setLoading(true);
    setMessage({ type: "", text: "" });
    fetch(`/api/v1/api-settings?merchantId=${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d?.settings) {
          setForm({
            pgCallbackUrl: d.settings.pgCallbackUrl || "",
            payoutCallbackUrl: d.settings.payoutCallbackUrl || "",
            ipAddress: d.settings.ipAddress || "",
            ipAddressStatus: d.settings.ipAddressStatus || "INACTIVE",
          });
        } else {
          setForm(emptyForm);
        }
        if (d?.merchant) setApiCreds(d.merchant);
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load settings." }))
      .finally(() => setLoading(false));
  }, [selectedId]);

  function updateForm(key, val) { setForm(p => ({ ...p, [key]: val })); }

  async function onSave(e) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true); setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/v1/api-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: selectedId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data?.message || "Save failed." }); return; }
      setMessage({ type: "success", text: "API settings saved successfully." });
    } catch { setMessage({ type: "error", text: "Save failed." }); }
    finally { setSaving(false); }
  }

  async function doCopy(text, key) {
    try { await copyToClipboard(text); setCopiedKey(key); setTimeout(() => setCopiedKey(""), 1500); }
    catch { setMessage({ type: "error", text: "Copy failed." }); }
  }

  const selectedMerchant = merchants.find(m => m.merchantId === selectedId);

  return (
    <Shell title="API Settings" breadcrumb="Home > API Setting">
      <div className="space-y-5">

        {/* Merchant selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label className="text-sm font-bold text-slate-700 block mb-2">Select Merchant</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500">
            <option value="">— Select a merchant —</option>
            {merchants.map(m => (
              <option key={m.merchantId} value={m.merchantId}>
                {m.merchantId} — {m.companyName || m.name || m.email}
              </option>
            ))}
          </select>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2
            ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {message.type === "success" ? "✓" : "⚠"} {message.text}
          </div>
        )}

        {selectedId && (
          <>
            {/* API Credentials (read-only) */}
            {apiCreds && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <span>🔑</span> API Credentials (Read-only)
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { label: "Merchant ID", val: apiCreds.merchantId, key: "mid" },
                    { label: "API Key", val: apiCreds.apiKey, key: "apiKey" },
                    { label: "API Secret", val: apiCreds.apiSecret, key: "apiSecret" },
                    { label: "Status", val: apiCreds.status, key: "status", noBtn: true },
                  ].map(({ label, val, key, noBtn }) => (
                    <div key={key} className="rounded-xl bg-white border border-blue-200 px-4 py-3">
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">{label}</p>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-sm text-slate-800 break-all font-mono">{val || "—"}</code>
                        {!noBtn && val && (
                          <button onClick={() => doCopy(val, key)}
                            className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
                            {copiedKey === key ? "✓" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>⚙️</span> Webhook & IP Settings
                {loading && <span className="text-xs text-slate-400 font-normal">Loading...</span>}
              </h2>
              <form onSubmit={onSave} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">PG (PayIn) Callback URL</label>
                  <p className="text-xs text-slate-400 mt-0.5">URL called after successful PayIn payment</p>
                  <input type="url" value={form.pgCallbackUrl} onChange={e => updateForm("pgCallbackUrl", e.target.value)}
                    placeholder="https://yoursite.com/webhook/payin"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500"/>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Payout Callback URL</label>
                  <p className="text-xs text-slate-400 mt-0.5">URL called after payout status update</p>
                  <input type="url" value={form.payoutCallbackUrl} onChange={e => updateForm("payoutCallbackUrl", e.target.value)}
                    placeholder="https://yoursite.com/webhook/payout"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500"/>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Whitelisted IP Address</label>
                    <p className="text-xs text-slate-400 mt-0.5">Only this IP can call your APIs</p>
                    <input type="text" value={form.ipAddress} onChange={e => updateForm("ipAddress", e.target.value)}
                      placeholder="e.g. 203.0.113.10"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500"/>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">IP Whitelist Status</label>
                    <p className="text-xs text-slate-400 mt-0.5">Enable to enforce IP restriction</p>
                    <select value={form.ipAddressStatus} onChange={e => updateForm("ipAddressStatus", e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500">
                      <option value="INACTIVE">Inactive (disabled)</option>
                      <option value="ACTIVE">Active (enforced)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={saving || loading}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {saving ? "Saving..." : "Save API Settings"}
                  </button>
                </div>
              </form>
            </div>

            {/* Integration guide */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><span>📡</span> Webhook Integration Guide</h3>
              <div className="space-y-2 text-sm text-amber-800">
                <p>• Callbacks are sent as <code className="bg-amber-100 rounded px-1 font-mono text-xs">POST</code> requests with JSON body.</p>
                <p>• Your endpoint must respond with <code className="bg-amber-100 rounded px-1 font-mono text-xs">HTTP 200</code> to acknowledge receipt.</p>
                <p>• Verify the request by matching the merchant API key in headers.</p>
                <p>• If your endpoint fails, the system will retry up to 3 times with exponential backoff.</p>
              </div>
            </div>
          </>
        )}

        {!selectedId && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="text-5xl mb-3">⚙️</div>
            <p className="text-slate-500 text-sm">Select a merchant above to view and manage their API settings.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
