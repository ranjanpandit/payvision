"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 30 * 60 * 1000;

const adminMenu = [
  { label: "Dashboard", href: "/" },
  {
    label: "Profile",
    href: "/profile",
    children: [
      { label: "Change Profile", href: "/profile" },
      { label: "Change Password", href: "/profile/change-password" },
      { label: "Change Tpin", href: "/profile/change-tpin" },
    ],
  },
  {
    label: "Manage Merchants",
    href: "/merchants",
    children: [
      { label: "New Registration", href: "/merchants/new-registration" },
      { label: "Active Merchant", href: "/merchants/active" },
      { label: "Pending Merchant", href: "/merchants/pending" },
      { label: "New Connection Merchant", href: "/merchants/new-connection" },
    ],
  },
  {
    label: "Manage Wallet",
    href: "/wallet",
    children: [
      { label: "PG Wallet", href: "/wallet/payin" },
      { label: "Payout Wallet", href: "/wallet/payout" },
    ],
  },
  {
    label: "Commission Setting",
    href: "/commission",
    children: [
      { label: "PG Commission", href: "/commission/pg" },
      { label: "Payout Commission", href: "/commission/payout" },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    children: [
      { label: "PG Report", href: "/reports" },
      { label: "Payout Report", href: "/reports/payout" },
      { label: "Security Amount Report", href: "/reports/security-amount" },
    ],
  },
  { label: "API Docs", href: "/api-docs" },
  { label: "Manage Employee", href: "/employees" },
  { label: "API Setting", href: "/api-settings" },
];

const clientMenu = [
  { label: "Dashboard", href: "/" },
  {
    label: "Profile",
    href: "/profile",
    children: [
      { label: "Change Profile", href: "/profile" },
      { label: "Change Password", href: "/profile/change-password" },
      { label: "Change Tpin", href: "/profile/change-tpin" },
    ],
  },
  { label: "Wallet", href: "/wallet" },
  {
    label: "Report",
    href: "/reports",
    children: [
      { label: "Paying Settlement", href: "/reports" },
      { label: "Payout Report", href: "/reports/payout" },
      { label: "Security Amount Report", href: "/reports/security-amount" },
    ],
  },
  { label: "API Credentials", href: "/api-credentials" },
  { label: "API Docs", href: "/api-docs" },
];

function activePath(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Shell({ title, breadcrumb, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      try {
        const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) setRole(String(data?.user?.role || ""));
      } catch {
        if (!cancelled) setRole("ADMIN");
      }
    }
    loadRole();
    return () => { cancelled = true; };
  }, []);

  // Inactivity auto-logout
  useEffect(() => {
    function resetActivity() { lastActivityRef.current = Date.now(); }
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    events.forEach(ev => window.addEventListener(ev, resetActivity, { passive: true }));
    const id = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        clearInterval(id);
        try { await fetch("/api/v1/auth/logout", { method: "POST" }); } catch {}
        router.push("/login?reason=inactivity");
      }
    }, 60_000);
    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetActivity));
      clearInterval(id);
    };
  }, [router]);

  const mainMenu = useMemo(() => {
    if (role === null) return [];
    return role === "CLIENT" ? clientMenu : adminMenu;
  }, [role]);

  async function onLogout() {
    try { await fetch("/api/v1/auth/logout", { method: "POST" }); } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="h-20 px-5 flex items-center border-b border-white/10">
        <div className="h-10 w-10 shrink-0">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="pvG" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818cf8"/>
                <stop offset="100%" stopColor="#3730a3"/>
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx="10" fill="url(#pvG)"/>
            <path d="M20 8L10 13V22C10 27.5 14.3 32.2 20 33.5C25.7 32.2 30 27.5 30 22V13L20 8Z"
              fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M14.5 21.5L18.5 25.5L26 17.5"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-lg font-bold text-white leading-tight">PayVision</p>
          <p className="text-xs text-slate-400">Merchant Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="py-3 flex-1 overflow-auto scrollbar-none">
        {mainMenu.map((item) => {
          const active = activePath(pathname, item.href);
          const showChildren = item.children && pathname.startsWith(item.href);

          return (
            <div key={`${item.label}:${item.href}`}>
              <Link href={item.href} onClick={() => setSidebarOpen(false)}
                className={`h-11 px-5 flex items-center justify-between border-l-4 text-sm font-medium transition-all ${
                  active
                    ? "bg-white/10 border-l-indigo-400 text-white"
                    : "border-l-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                }`}>
                <span>{item.label}</span>
                <span className={`text-xs transition-transform ${showChildren ? "rotate-180" : ""} ${active ? "text-indigo-300" : "text-slate-600"}`}>▾</span>
              </Link>

              {showChildren && (
                <div className="border-l border-indigo-600/30 ml-5 pl-0 mb-1">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link key={`${child.label}:${child.href}`} href={child.href} onClick={() => setSidebarOpen(false)}
                        className={`block pl-5 pr-4 py-2 text-xs border-l-2 transition-all ${
                          childActive
                            ? "border-l-indigo-400 text-white bg-white/8 font-semibold"
                            : "border-l-transparent text-slate-400 hover:text-white hover:border-l-indigo-500/50"
                        }`}>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <button type="button" onClick={onLogout}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-semibold transition-colors">
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col bg-[#0a1628] shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}/>
          <aside className="relative z-50 w-64 h-screen flex flex-col bg-[#0a1628] shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="h-16 px-4 md:px-8 bg-[#0a1628] text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <button type="button" onClick={() => setSidebarOpen(v => !v)}
            className="md:hidden h-9 w-9 rounded-lg border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="hidden md:block"/>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-sm text-slate-300 font-medium">
              {role === "CLIENT" ? "Merchant Portal" : "Admin Console"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <section className="flex-1 p-4 md:p-6 space-y-5 overflow-auto">
          {/* Page header card */}
          <div className="rounded-2xl bg-gradient-to-r from-[#0f1f3d] to-[#0d5c3a] text-white px-6 py-4 flex items-center justify-between shadow-lg">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-xs md:text-sm bg-white/15 rounded-full px-3 py-1 text-slate-200 border border-white/10">{breadcrumb}</p>
          </div>

          {children}
        </section>
      </main>
    </div>
  );
}
