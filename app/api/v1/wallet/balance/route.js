import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const getHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const merchantId = sessionUser.role === "CLIENT"
      ? sessionUser.merchantId
      : new URL(req.url).searchParams.get("merchantId");

    if (!merchantId) return NextResponse.json({ payinBalance: 0, payoutBalance: 0 });

    const wallet = await prisma.merchantWalletBalance.findUnique({
      where: { merchantId },
      select: { payinBalance: true, payoutBalance: true },
    });

    return NextResponse.json({
      success: true,
      merchantId,
      payinBalance: Number(wallet?.payinBalance || 0),
      payoutBalance: Number(wallet?.payoutBalance || 0),
    });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to fetch balance" }, { status: 500 });
  }
};

export const GET = withApiLogging("wallet/balance:GET", getHandler);
