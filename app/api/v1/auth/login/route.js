import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

// In-memory rate limiting (resets on server restart — acceptable for single-instance)
const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes
const REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_SECONDS = 60 * 60 * 24 * 7;       // 7 days

function getRateLimit(email) {
  const now = Date.now();
  const rec = failedAttempts.get(email);
  if (!rec) return { ok: true };
  if (rec.lockedUntil && rec.lockedUntil > now) {
    const mins = Math.ceil((rec.lockedUntil - now) / 60000);
    return { ok: false, lockedUntil: rec.lockedUntil, message: `Too many failed attempts. Account locked for ${mins} more minute(s).` };
  }
  if (rec.lockedUntil && rec.lockedUntil <= now) failedAttempts.delete(email);
  return { ok: true };
}

function recordFailure(email) {
  const rec = failedAttempts.get(email) || { count: 0 };
  rec.count = (rec.count || 0) + 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCK_MS;
  failedAttempts.set(email, rec);
  return rec.count;
}

function clearFailures(email) {
  failedAttempts.delete(email);
}

const postHandler = async (req) => {
  try {
    const body = await req.json();
    const email = sanitizeEmail(body?.email);
    const password = String(body?.password || "");
    const rememberMe = Boolean(body?.rememberMe);

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    // Rate limit check
    const limit = getRateLimit(email);
    if (!limit.ok) {
      return NextResponse.json({ message: limit.message, lockedUntil: limit.lockedUntil }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, merchantId: true, isActive: true, passwordHash: true },
    });

    if (!user || !user.isActive) {
      recordFailure(email);
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const count = recordFailure(email);
      const remaining = MAX_ATTEMPTS - count;
      const msg = remaining > 0
        ? `Invalid email or password. ${remaining} attempt(s) remaining.`
        : "Too many failed attempts. Account locked for 15 minutes.";
      const extra = count >= MAX_ATTEMPTS ? { lockedUntil: Date.now() + LOCK_MS } : {};
      return NextResponse.json({ message: msg, ...extra }, { status: 401 });
    }

    clearFailures(email);

    const maxAge = rememberMe ? REMEMBER_ME_SECONDS : DEFAULT_SECONDS;
    await setSessionCookie({ userId: user.id, role: user.role, email: user.email }, maxAge);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, merchantId: user.merchantId },
    });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Login failed." }, { status: 500 });
  }
};

export const POST = withApiLogging("auth/login:POST", postHandler);
