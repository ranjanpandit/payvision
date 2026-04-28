import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function toNumberSafe(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const getHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const page = toPositiveInt(url.searchParams.get("page"), 1);
    const size = Math.min(toPositiveInt(url.searchParams.get("size"), 10), 100);
    const query = String(url.searchParams.get("q") || "").trim();

    const where = query
      ? {
          OR: [
            { merchantId: { contains: query } },
            { companyName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
        }
      : {};

    const [total, merchants] = await prisma.$transaction([
      prisma.merchant.count({ where }),
      prisma.merchant.findMany({
        where,
        select: {
          merchantId: true,
          companyName: true,
          email: true,
          phone: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    const merchantIds = merchants.map((m) => m.merchantId);
    const balances = merchantIds.length
      ? await prisma.merchantWalletBalance.findMany({
          where: { merchantId: { in: merchantIds } },
          select: {
            merchantId: true,
            payinBalance: true,
            payoutBalance: true,
          },
        })
      : [];

    const balanceByMerchant = new Map(
      balances.map((row) => [
        row.merchantId,
        {
          payinBalance: toNumberSafe(row.payinBalance),
          payoutBalance: toNumberSafe(row.payoutBalance),
        },
      ]),
    );

    const records = merchants.map((m) => {
      const row = balanceByMerchant.get(m.merchantId) || { payinBalance: 0, payoutBalance: 0 };
      return {
        merchantId: m.merchantId,
        companyName: m.companyName || "",
        contactNumber: m.phone || "",
        emailId: m.email || "",
        pgBalance: row.payinBalance,
        payoutBalance: row.payoutBalance,
      };
    });

    return NextResponse.json({
      success: true,
      page,
      size,
      total,
      records,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to fetch payin wallet balances" },
      { status: 500 },
    );
  }
};

export const GET = withApiLogging("wallet/payin:GET", getHandler);
