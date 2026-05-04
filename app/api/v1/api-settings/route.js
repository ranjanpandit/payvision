import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

const getHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const merchantId = new URL(req.url).searchParams.get("merchantId");
    if (!merchantId) return NextResponse.json({ message: "merchantId required" }, { status: 400 });

    const merchant = await prisma.merchant.findUnique({
      where: { merchantId },
      select: { merchantId: true, apiKey: true, apiSecret: true, status: true },
    });
    if (!merchant) return NextResponse.json({ message: "Merchant not found" }, { status: 404 });

    const settings = await prisma.merchantApiCredential.findUnique({
      where: { merchantId },
      select: { pgCallbackUrl: true, payoutCallbackUrl: true, ipAddress: true, ipAddressStatus: true },
    });

    return NextResponse.json({ success: true, merchant, settings: settings || null });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to load settings" }, { status: 500 });
  }
};

const putHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const merchantId = String(body?.merchantId || "").trim();
    if (!merchantId) return NextResponse.json({ message: "merchantId required" }, { status: 400 });

    const merchant = await prisma.merchant.findUnique({ where: { merchantId }, select: { merchantId: true } });
    if (!merchant) return NextResponse.json({ message: "Merchant not found" }, { status: 404 });

    const data = {
      pgCallbackUrl: String(body?.pgCallbackUrl || "").trim(),
      payoutCallbackUrl: String(body?.payoutCallbackUrl || "").trim(),
      ipAddress: String(body?.ipAddress || "").trim(),
      ipAddressStatus: body?.ipAddressStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    };

    const settings = await prisma.merchantApiCredential.upsert({
      where: { merchantId },
      create: { merchantId, ...data },
      update: data,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to save settings" }, { status: 500 });
  }
};

export const GET = withApiLogging("api-settings:GET", getHandler);
export const PUT = withApiLogging("api-settings:PUT", putHandler);
