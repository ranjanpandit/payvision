"use client";
import { useState } from "react";
import Shell from "@/components/zixpay/Shell";

const METHODS = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-indigo-100 text-indigo-700",
};

const endpoints = [
  {
    section: "Core APIs",
    icon: "API",
    routes: [
      {
        method: "POST",
        path: "/api/v1/openmoney/auth/generate-token",
        auth: "Public / Credentials",
        summary: "Generate access token for authenticated API usage.",
        body: '{"mid":"MERCHANT_MID","email":"merchant@example.com","secretkey":"SECRET"}',
        response: '{"token":"<jwt_token>","expiresIn":1800}',
        curl: "curl --location 'http://localhost:3000/api/v1/openmoney/auth/generate-token' \\\n+--header 'accept: */*' \\\n+--header 'Content-Type: application/json' \\\n+--data-raw '{\n+    \"mid\":\"PV-MCH-20260416-HFTPKH\",\n+    \"email\":\"mact.ranjan@gmail.com\",\n+    \"secretkey\":\"pv_sk_S695GSYDFAK8BXSLSP2L7N7W2VYGC9J9\"\n+  }'",
      },
      {
        method: "POST",
        path: "/api/v1/openmoney/payin/create-order",
        auth: "Bearer Token",
        summary: "Create a payin collection order.",
        body: '{"RefID":"rcpt_EXAMPLE_001","Amount":"1500","Customer_Name":"John Example","Customer_Mobile":"9876543210","Customer_Email":"customer@example.com"}',
        response: '{"success":true,"status":"PENDING"}',
        curl: "curl --location 'http://localhost:3000/api/v1/openmoney/payin/create-order' \\\n--header 'Content-Type: application/json' \\\n--header 'Authorization: Bearer <TOKEN>' \\\n--data-raw '{\n    \"RefID\": \"rcpt_EXAMPLE_001\",\n    \"Amount\": \"1500\",\n    \"Customer_Name\": \"John Example\",\n    \"Customer_Mobile\": \"9876543210\",\n    \"Customer_Email\": \"customer@example.com\"\n  }'",
      },
      {
        method: "POST",
        path: "/api/v1/openmoney/payout/pay-order",
        auth: "Bearer Token",
        summary: "Create a payout order (auto or manual flow based on merchant settings).",
        body: '{"AccountNo":"1234567890","MobileNumber":"9876543210","Amount":500,"HolderName":"John Doe","IFSC":"SBIN0001234","BankName":"SBI","PaymentMode":2,"AccountType":"savings","latlong":"0,0"}',
        response: '{"success":true,"refId":"rcpt_...","status":"PENDING"}',
      },
      {
        method: "POST",
        path: "/api/v1/openmoney/payout/status-check",
        auth: "Session / Bearer (as implemented)",
        summary: "Check payout transaction status by RefId.",
        body: '{"receiptId":"rcpt_1776585727495","Service_Id":"1"}',
        response: '{"success":true,"status":"SUCCESS"}',
        curl: "curl --location 'http://localhost:3000/api/v1/openmoney/payout/status-check' \\\n+--header 'Content-Type: application/json' \\\n+--header 'Authorization: Bearer <TOKEN>' \\\n+--data '{\n+  \"receiptId\": \"rcpt_1776585727495\",\n+  \"Service_Id\": \"1\"\n+}'",
      },
      {
        method: "GET",
        path: "/api/check/balance",
        auth: "Provider Credentials",
        summary: "Check provider wallet balances (payin/payout totals).",
        body: null,
        response: '{"payinTotal":12345.67,"payoutTotal":2345.67}',
      },
    ],
  },
];

function Badge({ text, style }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{text}</span>;
}

function EndpointCard({ method, path, auth, summary, body, response, curl }) {
  const [open, setOpen] = useState(false);

  function formatJsonPreview(value) {
    if (!value) return "";
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return String(value);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold font-mono min-w-[48px] text-center ${METHODS[method] || "bg-slate-100 text-slate-700"}`}>{method}</span>
        <span className="font-mono text-sm text-slate-800 flex-1">{path}</span>
        <Badge text={auth} style="bg-slate-100 text-slate-600" />
        <span className="text-slate-400 text-sm">{open ? "?" : "?"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-3 text-sm">
          <p className="text-slate-700">{summary}</p>
          {body && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">REQUEST BODY</p>
              <pre className="bg-slate-900 text-indigo-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">{formatJsonPreview(body)}</pre>
            </div>
          )}
          {response && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">RESPONSE</p>
              <pre className="bg-slate-900 text-amber-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">{formatJsonPreview(response)}</pre>
            </div>
          )}
          {curl && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">CURL EXAMPLE</p>
              <pre className="bg-slate-900 text-emerald-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{curl}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const filtered = endpoints
    .map((s) => ({
      ...s,
      routes: s.routes.filter(
        (r) => !q || r.path.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.method.toLowerCase().includes(q),
      ),
    }))
    .filter((s) => s.routes.length > 0);

  const totalCount = endpoints.reduce((a, s) => a + s.routes.length, 0);

  return (
    <Shell title="API Documentation" breadcrumb="Home > API Docs">
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 p-px">
          <div className="rounded-2xl bg-white px-6 py-5">
            <h1 className="text-xl font-bold text-slate-900">ZIXPAY API Reference</h1>
            <p className="text-sm text-slate-500 mt-1">
              Base URL: <code className="bg-slate-100 rounded px-1.5 py-0.5 font-mono text-xs">http://zixpay.in</code>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge text="REST API" style="bg-indigo-100 text-indigo-700" />
              <Badge text="JSON" style="bg-slate-100 text-slate-700" />
              <Badge text={`${totalCount} Endpoints`} style="bg-emerald-100 text-emerald-700" />
            </div>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search endpoints, methods, paths..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {filtered.map((section) => (
          <div key={section.section} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{section.icon}</span>
              <h2 className="font-bold text-slate-800">{section.section}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{section.routes.length}</span>
            </div>
            <div className="space-y-2">
              {section.routes.map((r) => (
                <EndpointCard key={`${r.path}${r.method}`} {...r} />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Webhook Integrations</h2>
          <p className="text-sm text-slate-600">
            Configure callback URLs from merchant API settings so transaction updates are pushed to your system.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
            <p><span className="font-semibold">PG Callback:</span> Receives payin status updates.</p>
            <p><span className="font-semibold">Payout Callback:</span> Receives payout status updates.</p>
            <p><span className="font-semibold">Expected:</span> Your endpoint should return HTTP 200 quickly and process payload asynchronously.</p>
            <p><span className="font-semibold">Security:</span> Allowlist source IPs and verify payload signatures/tokens if enabled in your deployment.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">PAYOUT WEBHOOK CURL EXAMPLE</p>
            <pre className="bg-slate-900 text-emerald-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`curl --location 'http://localhost:5100/api/webhook/payout' \\
--form 'status_id="1"' \\
--form 'amount="500"' \\
--form 'utr="60xxx763"' \\
--form 'report_id="1215"' \\
--form 'client_id="202xxxx760"' \\
--form 'message="Payment succes"'`}</pre>
          </div>
        </div>

        {filtered.length === 0 && <p className="text-center text-slate-400 py-10">No endpoints match your search.</p>}
      </div>
    </Shell>
  );
}

