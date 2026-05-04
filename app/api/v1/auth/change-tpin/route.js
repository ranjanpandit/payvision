import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies, verifyPassword, hashPassword } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";
import { compare, hash } from "bcryptjs";

export const runtime = "nodejs";

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const currentTpin = body?.currentTpin ? String(body.currentTpin).trim() : null;
    const newTpin = String(body?.newTpin || "").trim();

    if (!newTpin || !/^\d{6}$/.test(newTpin))
      return NextResponse.json({ message: "New TPIN must be exactly 6 digits." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, tpin: true } });
    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    // If tpin is already set, verify current tpin
    if (user.tpin) {
      if (!currentTpin) return NextResponse.json({ message: "Current TPIN is required.", code: "TPIN_REQUIRED" }, { status: 400 });
      const valid = await compare(currentTpin, user.tpin);
      if (!valid) return NextResponse.json({ message: "Current TPIN is incorrect." }, { status: 400 });
    } else {
      if (currentTpin) return NextResponse.json({ message: "No TPIN is set yet. Leave current TPIN blank.", code: "NO_TPIN_SET" }, { status: 400 });
    }

    const newHash = await hash(newTpin, 10);
    await prisma.user.update({ where: { id: sessionUser.id }, data: { tpin: newHash } });

    return NextResponse.json({ success: true, message: user.tpin ? "TPIN changed successfully." : "TPIN set successfully." });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to change TPIN." }, { status: 500 });
  }
};

export const POST = withApiLogging("auth/change-tpin:POST", postHandler);
