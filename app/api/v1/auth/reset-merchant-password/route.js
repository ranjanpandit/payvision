import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies, hashPassword } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const merchantId = String(body?.merchantId || "").trim();
    if (!merchantId) {
      return NextResponse.json({ message: "merchantId is required" }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { merchantId },
      select: { merchantId: true, companyName: true },
    });
    if (!merchant) {
      return NextResponse.json({ message: "merchant not found" }, { status: 404 });
    }

    const user = await prisma.user.findFirst({
      where: { role: "CLIENT", merchantId },
      select: { id: true, email: true, role: true, merchantId: true },
    });
    if (!user) {
      return NextResponse.json({ message: "merchant client user not found" }, { status: 404 });
    }

    const newPassword = randomPassword(10);
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      merchant: {
        merchantId: merchant.merchantId,
        companyName: merchant.companyName,
      },
      clientCredentials: {
        email: user.email,
        password: newPassword,
        role: user.role,
        merchantId: user.merchantId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "reset merchant password failed" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("auth/reset-merchant-password:POST", postHandler);
