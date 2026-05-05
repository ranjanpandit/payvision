"use client";
import { useState } from "react";
import Shell from "@/components/payvision/Shell";

const METHODS = { GET:"bg-emerald-100 text-emerald-700", POST:"bg-indigo-100 text-indigo-700", PUT:"bg-amber-100 text-amber-700", DELETE:"bg-red-100 text-red-700" };

const endpoints = [
  {
    section: "Authentication",
    icon: "🔐",
    routes: [
      { method:"POST", path:"/api/v1/auth/login", auth:"Public", summary:"Login with email and password", body:'{"email":"admin@payvision.com","password":"your_password"}', response:'{"success":true,"user":{"id":1,"email":"...","role":"ADMIN"}}' },
      { method:"POST", path:"/api/v1/auth/logout", auth:"Session", summary:"Logout and clear session cookie", body:null, response:'{"success":true}' },
      { method:"GET", path:"/api/v1/auth/me", auth:"Session", summary:"Get current logged-in user details", body:null, response:'{"success":true,"user":{"id":1,"email":"...","role":"ADMIN","merchantId":null}}' },
      { method:"POST", path:"/api/v1/auth/setup-admin", auth:"Public (one-time)", summary:"Create the first admin account", body:'{"email":"admin@payvision.com","password":"password"}', response:'{"success":true}' },
      { method:"POST", path:"/api/v1/auth/change-password", auth:"Session", summary:"Change logged-in user password", body:'{"currentPassword":"old","newPassword":"new8char+"}', response:'{"success":true}' },
      { method:"POST", path:"/api/v1/auth/change-tpin", auth:"Session", summary:"Set or change transaction PIN (6 digits)", body:'{"currentTpin":"123456","newTpin":"654321"}', response:'{"success":true}' },
      { method:"POST", path:"/api/v1/auth/reset-merchant-password", auth:"Admin", summary:"Admin resets a merchant client password", body:'{"merchantId":"MER_XXXXXX"}', response:'{"success":true,"clientCredentials":{"email":"...","password":"..."}}' },
    ]
  },
  {
    section: "Merchants",
    icon: "🏢",
    routes: [
      { method:"GET", path:"/api/v1/merchants", auth:"Admin", summary:"List all merchants (paginated)", body:null, response:'{"success":true,"merchants":[...],"total":10}', params:'?page=1&size=10&q=search' },
      { method:"POST", path:"/api/v1/merchants", auth:"Admin", summary:"Register a new merchant", body:'{"firstName":"Ranjan","lastName":"Pandit","email":"...","phone":"9876543210","companyName":"ABC Ltd",...}', response:'{"success":true,"merchant":{...},"clientCredentials":{"email":"...","password":"..."}}' },
    ]
  },
  {
    section: "Profile",
    icon: "👤",
    routes: [
      { method:"GET", path:"/api/v1/profile", auth:"Session", summary:"Get current user profile (creates if first time)", body:null, response:'{"success":true,"profile":{...}}' },
      { method:"PUT", path:"/api/v1/profile", auth:"Session", summary:"Update profile details", body:'{"firstName":"...","mobile":"9876543210","pan":"ABCDE1234F",...}', response:'{"success":true,"profile":{...}}' },
    ]
  },
  {
    section: "Commission",
    icon: "💹",
    routes: [
      { method:"GET", path:"/api/v1/commission", auth:"Admin", summary:"Get commission rules for a merchant", body:null, response:'{"success":true,"rules":[...]}', params:'?merchantId=MER_XXXX&type=PAYIN' },
      { method:"POST", path:"/api/v1/commission", auth:"Admin", summary:"Create or update commission rule", body:'{"merchantId":"MER_XXXX","commissionType":"PAYIN","fromAmount":0,"toAmount":10000,"commission":1.5,"gst":18}', response:'{"success":true}' },
    ]
  },
  {
    section: "PayIn",
    icon: "⬇️",
    routes: [
      { method:"POST", path:"/api/v1/payin/create-order", auth:"API Key (Merchant)", summary:"Create a payment collection order", body:'{"amount":1000,"customerPhone":"9876543210","clientRefNo":"YOUR_REF_001"}', response:'{"success":true,"order":{...},"paymentUrl":"https://...","qrString":"..."}' },
      { method:"POST", path:"/api/v1/payin/status-check", auth:"API Key (Merchant)", summary:"Check status of a payin order", body:'{"clientRefNo":"YOUR_REF_001"}', response:'{"success":true,"status":"SUCCESS","order":{...}}' },
    ]
  },
  {
    section: "Payout",
    icon: "⬆️",
    routes: [
      { method:"POST", path:"/api/v1/payout/create-order", auth:"Bearer Token", summary:"Submit a payout/fund transfer request", body:'{"AccountNo":"...","MobileNumber":"9876543210","Amount":500,"HolderName":"John","IFSC":"SBIN0001234","BankName":"SBI","PaymentMode":2,"AccountType":"savings","latlong":"0,0"}', response:'{"success":true,"order":{...}}' },
      { method:"POST", path:"/api/v1/payout/status-check", auth:"Session", summary:"Check status of a payout order", body:'{"RefId":"REF_XXXXXX","Service_Id":"2"}', response:'{"success":true,"status":"SUCCESS"}' },
    ]
  },
  {
    section: "Wallet",
    icon: "💰",
    routes: [
      { method:"GET", path:"/api/v1/wallet/payin", auth:"Admin", summary:"List all merchant PG (payin) wallet balances", body:null, response:'{"success":true,"records":[{"merchantId":"...","pgBalance":5000}],"total":5}', params:'?page=1&size=10&q=search' },
      { method:"POST", path:"/api/v1/wallet/payin/deduct", auth:"Admin", summary:"Transfer amount from PG wallet to payout wallet", body:'{"merchantId":"MER_XXXX","amount":1000,"narration":"Monthly settlement","transactionPin":"123456"}', response:'{"success":true,"record":{"payinBalance":4000,"payoutBalance":1000}}' },
      { method:"POST", path:"/api/v1/wallet/payout/credit", auth:"Admin", summary:"Credit payout wallet for a merchant", body:'{"merchantId":"MER_XXXX","amount":500,"narration":"Top-up","transactionPin":"123456"}', response:'{"success":true}' },
    ]
  },
  {
    section: "Reports",
    icon: "📊",
    routes: [
      { method:"GET", path:"/api/v1/reports/transactions", auth:"Session", summary:"Payin transaction report (filtered by merchantId for admin)", body:null, response:'{"success":true,"records":[...],"pagination":{"page":1,"totalPages":3,"total":25}}', params:'?page=1&size=25&merchantId=MER_XXXX&status=SUCCESS' },
      { method:"GET", path:"/api/v1/reports/payout", auth:"Session", summary:"Payout transaction report", body:null, response:'{"success":true,"records":[...],"pagination":{...}}', params:'?page=1&size=25&merchantId=MER_XXXX' },
    ]
  },
];

function Badge({ text, style }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{text}</span>;
}

function EndpointCard({ method, path, auth, summary, body, response, params }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold font-mono min-w-[48px] text-center ${METHODS[method]||"bg-slate-100 text-slate-700"}`}>{method}</span>
        <span className="font-mono text-sm text-slate-800 flex-1">{path}</span>
        <Badge text={auth} style={auth==="Public"?"bg-green-100 text-green-700":auth==="Admin"?"bg-purple-100 text-purple-700":"bg-slate-100 text-slate-600"}/>
        <span className="text-slate-400 text-sm">{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-3 text-sm">
          <p className="text-slate-700">{summary}</p>
          {params && <div><p className="text-xs font-semibold text-slate-500 mb-1">QUERY PARAMS</p><code className="block bg-slate-900 text-emerald-400 rounded-lg px-3 py-2 text-xs font-mono">{params}</code></div>}
          {body && <div><p className="text-xs font-semibold text-slate-500 mb-1">REQUEST BODY</p><pre className="bg-slate-900 text-indigo-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">{JSON.stringify(JSON.parse(body),null,2)}</pre></div>}
          {response && <div><p className="text-xs font-semibold text-slate-500 mb-1">RESPONSE</p><pre className="bg-slate-900 text-amber-300 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">{JSON.stringify(JSON.parse(response),null,2)}</pre></div>}
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const filtered = endpoints.map(s => ({
    ...s,
    routes: s.routes.filter(r => !q || r.path.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.method.toLowerCase().includes(q))
  })).filter(s => s.routes.length > 0);

  const totalCount = endpoints.reduce((a,s) => a+s.routes.length, 0);

  return (
    <Shell title="API Documentation" breadcrumb="Home > API Docs">
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 p-px">
          <div className="rounded-2xl bg-white px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">PayVision API Reference</h1>
                <p className="text-sm text-slate-500 mt-1">Base URL: <code className="bg-slate-100 rounded px-1.5 py-0.5 font-mono text-xs">http://187.127.162.29/api/v1</code></p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge text="REST API" style="bg-indigo-100 text-indigo-700"/>
                  <Badge text="JSON" style="bg-slate-100 text-slate-700"/>
                  <Badge text={`${totalCount} Endpoints`} style="bg-emerald-100 text-emerald-700"/>
                </div>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="font-semibold">Auth:</span> Session cookie <code className="bg-slate-100 rounded px-1 font-mono text-xs">payvision_session</code></p>
                <p><span className="font-semibold">Content-Type:</span> <code className="bg-slate-100 rounded px-1 font-mono text-xs">application/json</code></p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth note */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Authentication:</span> Login first via <code className="bg-amber-100 rounded px-1 font-mono text-xs">POST /api/v1/auth/login</code> — the session cookie is automatically sent on all subsequent requests from the browser.
        </div>

        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search endpoints, methods, paths..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>

        {/* Sections */}
        {filtered.map(section => (
          <div key={section.section} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{section.icon}</span>
              <h2 className="font-bold text-slate-800">{section.section}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{section.routes.length}</span>
            </div>
            <div className="space-y-2">
              {section.routes.map(r => <EndpointCard key={r.path+r.method} {...r}/>)}
            </div>
          </div>
        ))}
        {filtered.length===0&&<p className="text-center text-slate-400 py-10">No endpoints match your search.</p>}
      </div>
    </Shell>
  );
}
