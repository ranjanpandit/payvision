import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies, hashPassword } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function genPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$";
  const all = upper + lower + digits + special;
  const rand = (set) => set[Math.floor(Math.random() * set.length)];
  const base = Array.from({ length: 6 }, () => rand(all)).join("");
  return rand(upper) + rand(digits) + rand(special) + base;
}

const getHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const employees = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, employees });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to load employees" }, { status: 500 });
  }
};

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Valid email address is required." }, { status: 400 });
    }
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) return NextResponse.json({ message: "This email is already registered." }, { status: 400 });

    const password = genPassword();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: "ADMIN", isActive: true },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ success: true, employee: user, credentials: { email, password } });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to create employee" }, { status: 500 });
  }
};

const putHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const id = Number(body?.id);
    const action = String(body?.action || "");
    if (!id) return NextResponse.json({ message: "Employee ID required." }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
    if (!target || target.role !== "ADMIN") return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    if (id === sessionUser.id) return NextResponse.json({ message: "Cannot modify your own account from here." }, { status: 400 });

    if (action === "toggleActive") {
      const updated = await prisma.user.update({ where: { id }, data: { isActive: !target.isActive }, select: { isActive: true } });
      return NextResponse.json({ success: true, isActive: updated.isActive });
    }
    if (action === "resetPassword") {
      const password = genPassword();
      const passwordHash = await hashPassword(password);
      await prisma.user.update({ where: { id }, data: { passwordHash } });
      return NextResponse.json({ success: true, credentials: { password } });
    }
    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to update employee" }, { status: 500 });
  }
};

export const GET = withApiLogging("employees:GET", getHandler);
export const POST = withApiLogging("employees:POST", postHandler);
export const PUT = withApiLogging("employees:PUT", putHandler);
