import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const getHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromDate = String(searchParams.get("fromDate") || "").trim();
    const toDate = String(searchParams.get("toDate") || "").trim();
    const merchantId = String(searchParams.get("merchantId") || "").trim();
    const status = String(searchParams.get("status") || "").trim().toUpperCase();
    const provider = String(searchParams.get("provider") || "").trim().toUpperCase();
    const query = String(searchParams.get("query") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const size = Math.min(100, Math.max(1, Number(searchParams.get("size") || 50)));

    const where = {};

    if (sessionUser.role === "CLIENT") {
      where.merchantId = sessionUser.merchantId || "__none__";
    } else if (merchantId) {
      where.merchantId = merchantId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }
    if (provider && provider !== "ALL") {
      where.provider = provider;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) where.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
    }

    if (query) {
      where.OR = [
        { txnId: { contains: query } },
        { bankRrn: { contains: query } },
        { clientRefNo: { contains: query } },
        { providerRef: { contains: query } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.payInOrder.count({ where }),
      prisma.payInOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    const records = rows.map((r) => ({
      ...r,
      amount: asNumber(r.amount),
      charge: asNumber(r.charge),
      gst: asNumber(r.gst),
      balance: asNumber(r.balance),
    }));

    return NextResponse.json({
      success: true,
      records,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "failed to fetch transaction report" },
      { status: 500 },
    );
  }
};

export const GET = withApiLogging("reports/transactions:GET", getHandler);
