"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Fintech SVG illustration - payment flow themed
function ZIXPAYIllustration() {
  return (
    <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-xs mx-auto">
      {/* Background circles */}
      <circle cx="200" cy="160" r="140" fill="white" fillOpacity="0.05"/>
      <circle cx="200" cy="160" r="100" fill="white" fillOpacity="0.05"/>

      {/* Central phone/device */}
      <rect x="155" y="70" width="90" height="160" rx="14" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
      <rect x="163" y="84" width="74" height="108" rx="6" fill="white" fillOpacity="0.1"/>
      <circle cx="200" cy="210" r="5" fill="white" fillOpacity="0.5"/>
      {/* Screen content */}
      <rect x="171" y="92" width="58" height="8" rx="4" fill="white" fillOpacity="0.5"/>
      <rect x="171" y="106" width="40" height="6" rx="3" fill="white" fillOpacity="0.3"/>
      {/* Amount display */}
      <rect x="163" y="120" width="74" height="32" rx="6" fill="white" fillOpacity="0.15"/>
      <rect x="171" y="126" width="30" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
      <rect x="171" y="135" width="50" height="8" rx="4" fill="white" fillOpacity="0.6"/>
      {/* Success check */}
      <circle cx="200" cy="167" r="12" fill="#10b981" fillOpacity="0.9"/>
      <path d="M194 167l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Floating card - left */}
      <rect x="40" y="100" width="95" height="60" rx="10" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <rect x="52" y="112" width="24" height="16" rx="4" fill="#f59e0b" fillOpacity="0.8"/>
      <rect x="52" y="134" width="40" height="5" rx="2.5" fill="white" fillOpacity="0.5"/>
      <rect x="52" y="143" width="28" height="4" rx="2" fill="white" fillOpacity="0.3"/>
      <circle cx="107" cy="118" r="10" fill="white" fillOpacity="0.2"/>
      <circle cx="116" cy="118" r="10" fill="white" fillOpacity="0.15"/>

      {/* Floating card - right */}
      <rect x="265" y="110" width="95" height="60" rx="10" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <rect x="277" y="122" width="24" height="16" rx="4" fill="#6366f1" fillOpacity="0.8"/>
      <rect x="277" y="144" width="40" height="5" rx="2.5" fill="white" fillOpacity="0.5"/>
      <rect x="277" y="153" width="28" height="4" rx="2" fill="white" fillOpacity="0.3"/>
      <circle cx="332" cy="128" r="10" fill="white" fillOpacity="0.2"/>
      <circle cx="341" cy="128" r="10" fill="white" fillOpacity="0.15"/>

      {/* Connection lines */}
      <path d="M135 130 Q155 130 155 140" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 3"/>
      <path d="M265 140 Q245 140 245 130" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 3"/>

      {/* Top stat bubble */}
      <rect x="135" y="40" width="130" height="30" rx="15" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <circle cx="152" cy="55" r="8" fill="#10b981" fillOpacity="0.8"/>
      <path d="M148 55l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="164" y="49" width="45" height="5" rx="2.5" fill="white" fillOpacity="0.7"/>
      <rect x="164" y="58" width="32" height="4" rx="2" fill="white" fillOpacity="0.4"/>

      {/* Bottom stats row */}
      <rect x="90" y="248" width="220" height="38" rx="10" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.2" strokeWidth="1"/>
      {/* Stat 1 */}
      <rect x="100" y="256" width="20" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
      <rect x="100" y="265" width="30" height="6" rx="3" fill="white" fillOpacity="0.7"/>
      {/* Divider */}
      <line x1="150" y1="253" x2="150" y2="281" stroke="white" strokeOpacity="0.2" strokeWidth="1"/>
      {/* Stat 2 */}
      <rect x="160" y="256" width="24" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
      <rect x="160" y="265" width="40" height="6" rx="3" fill="white" fillOpacity="0.7"/>
      {/* Divider */}
      <line x1="215" y1="253" x2="215" y2="281" stroke="white" strokeOpacity="0.2" strokeWidth="1"/>
      {/* Stat 3 */}
      <rect x="225" y="256" width="20" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
      <rect x="225" y="265" width="55" height="6" rx="3" fill="white" fillOpacity="0.7"/>

      {/* Floating dots */}
      <circle cx="80" cy="180" r="4" fill="white" fillOpacity="0.3"/>
      <circle cx="70" cy="200" r="2.5" fill="white" fillOpacity="0.2"/>
      <circle cx="320" cy="175" r="4" fill="white" fillOpacity="0.3"/>
      <circle cx="335" cy="195" r="2.5" fill="white" fillOpacity="0.2"/>
      <circle cx="100" cy="240" r="3" fill="white" fillOpacity="0.2"/>
      <circle cx="300" cy="235" r="3" fill="white" fillOpacity="0.2"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");
  const [adminExists, setAdminExists] = useState(true);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [lockout, setLockout] = useState({ locked: false, until: null });
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNextPath(params.get("next") || "/");
      if (params.get("reason") === "inactivity") {
        setMessage({ type: "warning", text: "You were automatically logged out due to inactivity." });
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/v1/auth/setup-admin", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d) setAdminExists(Boolean(d?.adminExists)); })
      .catch(() => {})
      .finally(() => setLoadingSetup(false));
  }, []);

  useEffect(() => {
    if (!lockout.locked || !lockout.until) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((lockout.until - Date.now()) / 1000));
      setCountdown(rem);
      if (rem <= 0) setLockout({ locked: false, until: null });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockout]);

  async function onSubmit(e) {
    e.preventDefault();
    if (lockout.locked) return;
    if (!email || !password) { setMessage({ type: "error", text: "Email and password are required." }); return; }
    setBusy(true); setMessage({ type: "", text: "" });
    const endpoint = adminExists ? "/api/v1/auth/login" : "/api/v1/auth/setup-admin";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.lockedUntil) {
          setLockout({ locked: true, until: data.lockedUntil });
          setMessage({ type: "error", text: data.message || "Account locked." });
        } else {
          setMessage({ type: "error", text: data?.message || "Invalid email or password." });
        }
        return;
      }
      router.push(nextPath); router.refresh();
    } catch { setMessage({ type: "error", text: "Network error. Please try again." }); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen flex bg-white">

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-indigo-600 text-xl">🔑</div>
              <h3 className="font-bold text-slate-900 text-lg">Forgot Password?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-3">Password resets are managed by your system administrator.</p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 mb-4">
              Contact your admin with your registered email address to verify identity and get a temporary password.
            </div>
            <button onClick={() => setForgotOpen(false)}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Left panel — brand + illustration */}
      <div className="hidden lg:flex lg:w-[55%] flex-col bg-gradient-to-br from-[#0a1628] via-[#0f2444] to-[#065f46] relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="white"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <text x="16" y="23" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="system-ui">PV</text>
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">ZIXPAY</p>
              <p className="text-xs text-white/60">Merchant Payment Platform</p>
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center -mt-8">
            <h2 className="text-3xl font-bold text-white mb-2">Payments Made Simple</h2>
            <p className="text-white/70 text-sm max-w-xs mb-8">Accept, transfer, and manage money with confidence. Built for modern businesses.</p>

            <ZIXPAYIllustration />

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-6 w-full max-w-sm">
              {[
                { value: "₹10Cr+", label: "Processed" },
                { value: "99.9%", label: "Uptime" },
                { value: "500+", label: "Merchants" },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/60 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center pb-4">
            {["Instant PayIn", "Fast Payout", "Real-time Reports", "Secure API", "Multi-bank Support"].map(f => (
              <span key={f} className="rounded-full bg-white/15 px-3 py-1 text-xs text-white/80 border border-white/20">{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 flex items-center justify-center mb-3 shadow-lg">
              <span className="text-2xl font-bold text-white">PV</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">ZIXPAY</h1>
            <p className="text-sm text-slate-500 mt-1">Merchant Payment Platform</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-600 to-emerald-600"/>
            <div className="px-8 py-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {loadingSetup ? "Loading..." : adminExists ? "Welcome back 👋" : "Create Admin"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {adminExists ? "Sign in to manage your payment operations" : "Set up the first admin account"}
              </p>

              {message.text && (
                <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium flex items-start gap-2
                  ${message.type === "error" ? "bg-red-50 border-red-200 text-red-700" :
                    message.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-700" :
                    "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                  <span className="mt-0.5 shrink-0">{message.type === "error" ? "⚠" : "⏰"}</span>
                  <span>{message.text}{lockout.locked && countdown > 0 ? ` Retry in ${countdown}s.` : ""}</span>
                </div>
              )}

              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                    </span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="admin@ZIXPAY.com" autoComplete="email"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"/>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-slate-700">Password</label>
                    {adminExists && (
                      <button type="button" onClick={() => setForgotOpen(true)}
                        className="text-xs text-indigo-600 hover:underline">Forgot password?</button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </span>
                    <input type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"/>
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                      {showPass ? (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                {adminExists && (
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`relative h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${rememberMe ? "bg-indigo-600 border-indigo-600" : "border-slate-300 group-hover:border-blue-400"}`}
                      onClick={() => setRememberMe(v => !v)}>
                      {rememberMe && <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>}
                    </div>
                    <span className="text-sm text-slate-600 select-none">Keep me signed in for 30 days</span>
                  </label>
                )}

                {/* Submit */}
                <button type="submit" disabled={busy || loadingSetup || lockout.locked}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  {busy ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Signing in...
                    </>
                  ) : lockout.locked ? `Locked — retry in ${countdown}s` : adminExists ? "Sign In →" : "Create Admin Account"}
                </button>
              </form>
              {adminExists && (
                <div className="mt-4 text-center text-sm text-slate-600">
                  Don't have account?{" "}
                  <Link href="/login/new-registration" className="font-semibold text-indigo-600 hover:text-indigo-700">
                    Create merchant account
                  </Link>
                </div>
              )}

              {/* Trust row */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-5 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  256-bit SSL
                </span>
                <span className="text-slate-200">|</span>
                <span>PCI DSS Compliant</span>
                <span className="text-slate-200">|</span>
                <span>Bank-grade Security</span>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} ZIXPAY Technologies. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}

