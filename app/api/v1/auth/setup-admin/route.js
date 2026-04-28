import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, sanitizeEmail, setSessionCookie } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const getHandler = async () => {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  return NextResponse.json({ success: true, adminExists: Boolean(admin) });
};

const postHandler = async (req) => {
  try {
    const body = await req.json();
    const email = sanitizeEmail(body?.email);
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ message: "email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: "password must be at least 6 characters" }, { status: 400 });
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      return NextResponse.json({ message: "admin account already exists" }, { status: 409 });
    }

    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) {
      return NextResponse.json({ message: "email already used" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await setSessionCookie({ userId: user.id, role: user.role, email: user.email });
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "setup-admin failed" }, { status: 500 });
  }
};

export const GET = withApiLogging("auth/setup-admin:GET", getHandler);
export const POST = withApiLogging("auth/setup-admin:POST", postHandler);
