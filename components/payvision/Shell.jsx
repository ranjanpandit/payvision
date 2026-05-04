"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

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
      <div className="h-20 px-6 flex items-center border-b border-slate-200">
        <div className="h-11 w-11 rounded-full bg-emerald-500 text-white grid place-items-center font-bold text-xl">PV</div>
        <div className="ml-3">
          <p className="text-4xl leading-none font-bold text-emerald-500">PayVision</p>
          <p className="text-xs text-slate-500">Merchant Platform</p>
        </div>
      </div>

      <nav className="py-2 flex-1 overflow-auto">
        {mainMenu.map((item) => {
          const active = activePath(pathname, item.href);
          const showChildren = item.children && pathname.startsWith(item.href);

          return (
            <div key={`${item.label}:${item.href}`}>
              <Link href={item.href} onClick={() => setSidebarOpen(false)}
                className={`h-12 px-6 flex items-center justify-between border-l-4 text-sm ${
                  active
                    ? "bg-gradient-to-r from-cyan-600 to-emerald-500 text-white border-l-cyan-800"
                    : "border-l-transparent text-slate-600 hover:bg-[#dcedea]"
                }`}>
                <span>{item.label}</span>
                <span>{item.children ? "^" : "v"}</span>
              </Link>

              {showChildren && (
                <div className="bg-white/50">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link key={`${child.label}:${child.href}`} href={child.href} onClick={() => setSidebarOpen(false)}
                        className={`block px-8 py-2 text-sm border-l-4 ${
                          childActive
                            ? "bg-gradient-to-r from-cyan-700 to-emerald-600 text-white border-l-cyan-900"
                            : "border-l-transparent text-slate-700 hover:bg-[#dcedea]"
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

      <div className="p-4 border-t border-slate-200">
        <button type="button" onClick={onLogout} className="w-full rounded-xl bg-cyan-600 text-white py-2 font-medium hover:bg-cyan-700">
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 bg-[#e9f3f1]">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)}/>
          <aside className="relative z-50 w-72 flex flex-col border-r border-slate-200 bg-[#e9f3f1] h-full">
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <header className="h-20 px-4 md:px-8 bg-gradient-to-r from-blue-600 to-emerald-500 text-white flex items-center justify-between">
          <button type="button" onClick={() => setSidebarOpen(v => !v)}
            className="md:hidden h-10 w-10 rounded-lg border border-white/30 grid place-items-center">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="hidden md:block"/>
          <p className="text-sm font-medium">{role === "CLIENT" ? "PayVision Merchant" : "PayVision Admin"}</p>
        </header>

        <section className="p-4 md:p-7 space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white px-5 py-4 flex items-center justify-between">
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-xs md:text-sm bg-white/20 rounded-full px-3 py-1">{breadcrumb}</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
