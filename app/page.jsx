"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/payvision/Shell";

function fmt(v) { return Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:true});
}
function fmtShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
}

function StatusBadge({ status }) {
  const s = String(status||"").toUpperCase();
  const cls = s==="SUCCESS" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : s==="FAILED" ? "bg-red-100 text-red-700 border-red-200"
    : "bg-amber-100 text-amber-700 border-amber-200";
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{s||"PENDING"}</span>;
}

function Sparkline({ data }) {
  if (!data || data.length < 2) return <div className="h-10 flex items-end gap-1">{Array(7).fill(0).map((_,i)=><div key={i} className="flex-1 rounded-sm bg-indigo-200" style={{height:"4px"}}/>)}</div>;
  const vals = data.map(d => d.amount || 0);
  const max = Math.max(...vals, 1);
  const w = 140, h = 40;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - Math.max(2, (v / max) * h);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const fillPts = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#spk)"/>
      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function KpiCard({ title, value, sub, badge, icon, gradient, extra }) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-8 translate-x-8"/>
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">{icon}</div>
        {badge && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">{badge}</span>}
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-white/70 mt-1">{title}</p>
      {sub && <p className="text-xs text-white/50 mt-1">{sub}</p>}
      {extra}
    </div>
  );
}

function BalCard({ title, value, sub, icon, accent }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg ${accent}`}>{icon}</div>
        <span className="text-xs text-slate-400 font-medium">Balance</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">₹{value}</p>
      <p className="text-sm text-slate-500 mt-1">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const quickActions = [
  { label: "New Merchant", href: "/merchants/new-registration", icon: "➕", color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { label: "PG Wallet", href: "/wallet/payin", icon: "💰", color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { label: "Reports", href: "/reports", icon: "📊", color: "bg-violet-50 text-violet-700 hover:bg-violet-100" },
  { label: "Employees", href: "/employees", icon: "👤", color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
];

const clientActions = [
  { label: "Fund Request", href: "/wallet", icon: "💸", color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { label: "PG Report", href: "/reports", icon: "📊", color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { label: "API Credentials", href: "/api-credentials", icon: "🔑", color: "bg-violet-50 text-violet-700 hover:bg-violet-100" },
  { label: "Payout Report", href: "/reports/payout", icon: "📋", color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [greeting, setGreeting] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/dashboard/stats", { cache: "no-store" });
      const d = await res.json();
      if (res.ok) { setData(d); setLastUpdated(new Date()); }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening");
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const t = data?.today || {};
  const b = data?.balances || {};
  const isClient = data?.isClient;
  const actions = isClient ? clientActions : quickActions;

  return (
    <Shell title="Dashboard" breadcrumb="Home > Dashboard">
      <div className="space-y-5">

        {/* Welcome banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#0a1628] to-[#0f2444] border border-white/10 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div>
            <p className="text-white/60 text-sm">{greeting} 👋</p>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {isClient ? "Welcome to PayVision Merchant Portal" : "PayVision Admin Console"}
            </h2>
            <p className="text-white/40 text-xs mt-1">
              {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              {lastUpdated && ` · Updated ${fmtShort(lastUpdated)}`}
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-white font-medium transition-colors disabled:opacity-60">
            <svg className={loading ? "animate-spin" : ""} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
            </svg>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* KPI Row */}
        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(isClient ? 2 : 4)].map((_,i) => (
              <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-36"/>
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-2 xl:grid-cols-${isClient?"2":"4"} gap-4`}>
            {isClient ? (
              <>
                <KpiCard title="Your PG Balance" value={`₹${fmt(b.myPayin)}`} sub="Available for settlement" icon="💳" gradient="bg-gradient-to-br from-indigo-600 to-indigo-800"/>
                <KpiCard title="Your Payout Balance" value={`₹${fmt(b.myPayout)}`} sub="Available to withdraw" icon="🏦" gradient="bg-gradient-to-br from-emerald-600 to-emerald-800"/>
              </>
            ) : (
              <>
                <KpiCard
                  title="PayIn Transactions Today"
                  value={t.payinCount?.toLocaleString() || "0"}
                  sub={`₹${fmt(t.payinAmount)} volume`}
                  badge={`${t.successRate||0}% success`}
                  icon="⬇️"
                  gradient="bg-gradient-to-br from-indigo-600 to-indigo-900"
                  extra={
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"/>{t.payinSuccessCount||0} success</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block"/>{t.payinFailed||0} failed</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block"/>{t.payinPending||0} pending</span>
                    </div>
                  }
                />
                <KpiCard
                  title="Payout Transactions Today"
                  value={t.payoutCount?.toLocaleString() || "0"}
                  sub={`₹${fmt(t.payoutAmount)} transferred`}
                  badge={`${t.payoutSuccess||0} success`}
                  icon="⬆️"
                  gradient="bg-gradient-to-br from-emerald-600 to-emerald-900"
                />
                <KpiCard
                  title="PayIn Success Rate"
                  value={`${t.successRate||0}%`}
                  sub={`${t.payinSuccessCount||0} of ${t.payinCount||0} succeeded`}
                  icon="✅"
                  gradient="bg-gradient-to-br from-violet-600 to-violet-900"
                  extra={
                    <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div className="h-full rounded-full bg-white/70 transition-all" style={{width:`${t.successRate||0}%`}}/>
                    </div>
                  }
                />
                <KpiCard
                  title="Active Merchants"
                  value={data?.merchants?.active?.toLocaleString() || "0"}
                  sub={`${data?.merchants?.total||0} total registered`}
                  icon="🏢"
                  gradient="bg-gradient-to-br from-[#0a1628] to-slate-700"
                />
              </>
            )}
          </div>
        )}

        {/* Balance Cards (Admin only) */}
        {!isClient && !loading && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <BalCard title="Admin API Payout" value={fmt(b.adminPayout)} icon="🔐" accent="bg-indigo-100 text-indigo-600"/>
            <BalCard title="Merchant Payout Total" value={fmt(b.totalMerchantPayout)} sub="Across all merchants" icon="💸" accent="bg-emerald-100 text-emerald-600"/>
            <BalCard title="Merchant PG Total" value={fmt(b.totalMerchantPayin)} sub="Collected payin" icon="📥" accent="bg-violet-100 text-violet-600"/>
            <BalCard title="Today Success Volume" value={fmt(t.payinSuccessAmount)} sub="Confirmed payin" icon="📈" accent="bg-amber-100 text-amber-600"/>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid xl:grid-cols-3 gap-5">

          {/* Recent PayIn Transactions */}
          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Recent PayIn Transactions</h3>
                <p className="text-xs text-slate-400 mt-0.5">Latest 10 transactions</p>
              </div>
              <Link href="/reports" className="rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 transition-colors">
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#0f1f3d] text-white">
                    {["Ref No", isClient ? "Time" : "Merchant", "Amount", "Status", "Time"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_,i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {[...Array(5)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse"/></td>)}
                      </tr>
                    ))
                  ) : !data?.recentPayin?.length ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No transactions yet.</td></tr>
                  ) : data.recentPayin.map((row, i) => (
                    <tr key={row.id} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${i%2===0?"bg-white":"bg-slate-50/50"}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{String(row.clientRefNo||"").slice(-12)}</td>
                      {!isClient && <td className="px-4 py-3 text-slate-700 font-medium">{String(row.merchantId||"").slice(-8)}</td>}
                      <td className="px-4 py-3 font-semibold text-slate-800">₹{fmt(row.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status}/></td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtTime(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Recent Payout */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Recent Payouts</h3>
                <Link href="/reports/payout" className="text-xs text-indigo-600 hover:underline">View All</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {loading ? [...Array(4)].map((_,i)=>(
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse shrink-0"/>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4"/>
                      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2"/>
                    </div>
                  </div>
                )) : !data?.recentPayout?.length ? (
                  <p className="px-4 py-6 text-center text-slate-400 text-sm">No payout transactions.</p>
                ) : data.recentPayout.map(row => (
                  <div key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 text-sm">↑</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-slate-600 truncate">{String(row.clientRefNo||"").slice(-10)}</p>
                      <p className="text-xs text-slate-400">{fmtTime(row.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-slate-800 text-sm">₹{fmt(row.amount)}</p>
                      <StatusBadge status={row.status}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {actions.map(a => (
                  <Link key={a.href} href={a.href}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-semibold transition-colors ${a.color}`}>
                    <span className="text-xl">{a.icon}</span>
                    <span>{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7-day sparkline */}
        {!loading && data?.sparkline && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">7-Day PayIn Volume</h3>
                <p className="text-xs text-slate-400 mt-0.5">Daily transaction amount trend</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total this week</p>
                <p className="font-bold text-slate-800">₹{fmt(data.sparkline.reduce((a,d)=>a+d.amount,0))}</p>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="flex items-end gap-2 h-16">
                  {data.sparkline.map((d, i) => {
                    const maxAmt = Math.max(...data.sparkline.map(x=>x.amount), 1);
                    const pct = Math.max(8, (d.amount / maxAmt) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          ₹{fmt(d.amount)} ({d.count} txn)
                        </div>
                        <div className="w-full rounded-t-sm bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all"
                          style={{height:`${pct}%`}}/>
                        <span className="text-xs text-slate-400 mt-1">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Shell>
  );
}
