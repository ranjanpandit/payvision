import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies, verifyPassword, hashPassword } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const currentPassword = String(body?.currentPassword || "").trim();
    const newPassword = String(body?.newPassword || "").trim();

    if (!currentPassword) return NextResponse.json({ message: "Current password is required." }, { status: 400 });
    if (!newPassword) return NextResponse.json({ message: "New password is required." }, { status: 400 });
    if (newPassword.length < 8) return NextResponse.json({ message: "New password must be at least 8 characters." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, passwordHash: true } });
    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: sessionUser.id }, data: { passwordHash: newHash } });

    return NextResponse.json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to change password." }, { status: 500 });
  }
};

export const POST = withApiLogging("auth/change-password:POST", postHandler);
