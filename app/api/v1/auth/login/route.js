import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const postHandler = async (req) => {
  try {
    const body = await req.json();
    const email = sanitizeEmail(body?.email);
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ message: "email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        merchantId: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: "invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ message: "invalid credentials" }, { status: 401 });
    }

    await setSessionCookie({ userId: user.id, role: user.role, email: user.email });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        merchantId: user.merchantId,
      },
    });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "login failed" }, { status: 500 });
  }
};

export const POST = withApiLogging("auth/login:POST", postHandler);
