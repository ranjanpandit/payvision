import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getProviderBalance } from "@/lib/zixpay";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function asNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

const getHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const isClient = sessionUser.role === "CLIENT";
    const merchantId = String(sessionUser.merchantId || "").trim();

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const payinWhere = isClient ? { merchantId } : {};
    const payoutWhere = isClient ? { merchantId } : {};

    // Last 7 days for sparkline
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), start, end };
    });

    const [
      payinTodayAll,
      payinTodaySuccess,
      payinTodayFailed,
      payoutTodayAll,
      payoutTodaySuccess,
      recentPayin,
      recentPayout,
      last7Data,
      walletTotals,
      merchantStats,
      myWallet,
    ] = await Promise.all([
      prisma.payInOrder.aggregate({ where: { ...payinWhere, createdAt: { gte: todayStart, lte: todayEnd } }, _count: true, _sum: { amount: true } }),
      prisma.payInOrder.aggregate({ where: { ...payinWhere, status: "SUCCESS", createdAt: { gte: todayStart, lte: todayEnd } }, _count: true, _sum: { amount: true } }),
      prisma.payInOrder.count({ where: { ...payinWhere, status: "FAILED", createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.payoutOrder.aggregate({ where: { ...payoutWhere, createdAt: { gte: todayStart, lte: todayEnd } }, _count: true, _sum: { amount: true } }),
      prisma.payoutOrder.count({ where: { ...payoutWhere, status: "SUCCESS", createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.payInOrder.findMany({ where: payinWhere, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, clientRefNo: true, merchantId: true, amount: true, status: true, createdAt: true, customerPhone: true, txnId: true } }),
      prisma.payoutOrder.findMany({ where: payoutWhere, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, clientRefNo: true, merchantId: true, amount: true, status: true, createdAt: true } }),
      Promise.all(last7.map(({ start, end }) =>
        prisma.payInOrder.aggregate({ where: { ...payinWhere, createdAt: { gte: start, lte: end } }, _count: true, _sum: { amount: true } })
          .then(r => ({ count: r._count, amount: asNum(r._sum?.amount) }))
      )),
      !isClient ? prisma.merchantWalletBalance.aggregate({ _sum: { payinBalance: true, payoutBalance: true } }) : Promise.resolve(null),
      !isClient ? prisma.merchant.aggregate({ _count: true, where: {} }).then(async (r) => {
        const active = await prisma.merchant.count({ where: { status: "ACTIVE" } });
        return { total: r._count, active };
      }) : Promise.resolve(null),
      isClient && merchantId ? prisma.merchantWalletBalance.findUnique({ where: { merchantId }, select: { payinBalance: true, payoutBalance: true } }) : Promise.resolve(null),
    ]);

    const providerBal = !isClient ? await getProviderBalance({ revalidateSeconds: 120 }).catch(() => null) : null;

    const payinCount = payinTodayAll._count || 0;
    const payinAmount = asNum(payinTodayAll._sum?.amount);
    const payinSuccessCount = payinTodaySuccess._count || 0;
    const payinSuccessAmount = asNum(payinTodaySuccess._sum?.amount);
    const payinPending = payinCount - payinSuccessCount - payinTodayFailed;
    const successRate = payinCount > 0 ? Math.round((payinSuccessCount / payinCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      today: {
        payinCount,
        payinAmount,
        payinSuccessCount,
        payinSuccessAmount,
        payinFailed: payinTodayFailed,
        payinPending: Math.max(0, payinPending),
        payoutCount: payoutTodayAll._count || 0,
        payoutAmount: asNum(payoutTodayAll._sum?.amount),
        payoutSuccess: payoutTodaySuccess,
        successRate,
      },
      balances: {
        adminPayout: providerBal?.ok ? asNum(providerBal.payoutTotal) : 0,
        totalMerchantPayout: asNum(walletTotals?._sum?.payoutBalance),
        totalMerchantPayin: asNum(walletTotals?._sum?.payinBalance),
        myPayin: asNum(myWallet?.payinBalance),
        myPayout: asNum(myWallet?.payoutBalance),
      },
      merchants: merchantStats || { total: 0, active: 0 },
      recentPayin: recentPayin.map(r => ({ ...r, amount: asNum(r.amount) })),
      recentPayout: recentPayout.map(r => ({ ...r, amount: asNum(r.amount) })),
      sparkline: last7.map((d, i) => ({ label: d.label, count: last7Data[i].count, amount: last7Data[i].amount })),
      isClient,
    });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Failed to load dashboard" }, { status: 500 });
  }
};

export const GET = withApiLogging("dashboard/stats:GET", getHandler);

