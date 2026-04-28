"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  const [adminExists, setAdminExists] = useState(true);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNextPath(params.get("next") || "/");
    }
  }, []);

  useEffect(() => {
    async function loadSetupState() {
      try {
        const res = await fetch("/api/v1/auth/setup-admin", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setAdminExists(Boolean(data?.adminExists));
        }
      } finally {
        setLoadingSetup(false);
      }
    }
    loadSetupState();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setBusy(true);
    setMessage("");

    const endpoint = adminExists ? "/api/v1/auth/login" : "/api/v1/auth/setup-admin";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Authentication failed.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setMessage("Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-r from-blue-600 to-emerald-500 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">{loadingSetup ? "Loading..." : adminExists ? "Login" : "Create Admin Account"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {adminExists ? "Sign in to continue to PayVision." : "No admin found. Create your first admin account."}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="admin@payvision.com"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={busy || loadingSetup}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-2 text-white font-medium disabled:opacity-60"
          >
            {busy ? "Please wait..." : adminExists ? "Login" : "Create Admin"}
          </button>
        </form>

        {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
      </div>
    </main>
  );
}
