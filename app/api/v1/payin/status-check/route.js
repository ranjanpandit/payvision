import { NextResponse } from "next/server";
import { checkProviderStatus } from "@/lib/payvision";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

const globalForPayvision = globalThis;
const statusSignatureCache =
  globalForPayvision.__PAYVISION_STATUS_SIGNATURE_CACHE__ ||
  new Map();
globalForPayvision.__PAYVISION_STATUS_SIGNATURE_CACHE__ = statusSignatureCache;
const MAX_CACHE_ITEMS = 5000;

function rememberWithLimit(map, key, value) {
  map.set(key, value);
  if (map.size <= MAX_CACHE_ITEMS) return;
  const firstKey = map.keys().next()?.value;
  if (firstKey) map.delete(firstKey);
}

function toStatusSignature({ status, txnId, bankRrn }) {
  return `${String(status || "").toUpperCase()}|${String(txnId || "")}|${String(bankRrn || "")}`;
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

function calculatePayinSettlement({ amount, commissionPercent, gstPercent }) {
  const grossAmount = round2(amount);
  const commissionAmount = round2((grossAmount * commissionPercent) / 100);
  const gstAmount = round2((commissionAmount * gstPercent) / 100);
  const netAmount = round2(grossAmount - commissionAmount - gstAmount);
  return {
    grossAmount,
    commissionAmount,
    gstAmount,
    netAmount,
  };
}

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const rawBody = await req.text();
    let body = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON body. Send valid JSON with RefId and Service_Id." },
        { status: 400 },
      );
    }
    const RefId = String(
      body?.RefId ||
        body?.RefID ||
        body?.refId ||
        body?.receipt ||
        body?.receiptId ||
        body?.clientRefNo ||
        "",
    ).trim();
    const Service_Id = String(body?.Service_Id || body?.serviceId || "1").trim();

    if (!RefId) {
      return NextResponse.json({ message: "RefId is required" }, { status: 400 });
    }

    const result = await checkProviderStatus({ RefId, Service_Id });
    const data = result.data;

    const upstreamStatus = String(
      data?.status || data?.Status || data?.data?.status || data?.data?.Status || "PENDING",
    ).toUpperCase();
    const normalizedStatus = upstreamStatus.includes("SUCCESS")
      ? "SUCCESS"
      : upstreamStatus.includes("FAIL")
        ? "FAILED"
        : "PENDING";

    const txnId = String(data?.txnId || data?.txnid || data?.data?.txnId || "").trim();
    const bankRrn = String(data?.bankRRN || data?.rrn || data?.data?.bankRRN || "").trim();
    const cacheKey = String(RefId);
    const nextSignature = toStatusSignature({
      status: normalizedStatus,
      txnId,
      bankRrn,
    });
    const prevSignature = statusSignatureCache.get(cacheKey);
    let dbUpdated = false;

    if (prevSignature !== nextSignature) {
      const txResult = await prisma.$transaction(async (tx) => {
        const order = await tx.payInOrder.findUnique({
          where: { clientRefNo: RefId },
          select: {
            id: true,
            merchantId: true,
            amount: true,
            status: true,
            providerRaw: true,
          },
        });

        if (!order) {
          return { updated: 0 };
        }

        const nextProviderRaw = JSON.stringify({
          ...(order.providerRaw ? (() => {
            try {
              return JSON.parse(order.providerRaw);
            } catch {
              return {};
            }
          })() : {}),
          statusCheckResponse: data,
        });

        if (normalizedStatus !== "SUCCESS") {
          const updated = await tx.payInOrder.updateMany({
            where: { clientRefNo: RefId },
            data: {
              status: normalizedStatus,
              txnId: txnId || undefined,
              bankRrn: bankRrn || undefined,
              providerRaw: nextProviderRaw,
            },
          });
          return { updated: updated.count };
        }

        if (order.status === "SUCCESS") {
          const updated = await tx.payInOrder.updateMany({
            where: { clientRefNo: RefId },
            data: {
              txnId: txnId || undefined,
              bankRrn: bankRrn || undefined,
              providerRaw: nextProviderRaw,
            },
          });
          return { updated: updated.count };
        }

        const grossAmount = round2(order.amount || 0);
        const commissionRule = await tx.merchantCommissionSetting.findFirst({
          where: {
            merchantId: order.merchantId,
            provider: "OPENMONEY",
            commissionType: "PAYIN",
            fromAmount: { lte: grossAmount },
            toAmount: { gte: grossAmount },
          },
          orderBy: [{ fromAmount: "desc" }, { id: "desc" }],
          select: {
            commission: true,
            gst: true,
          },
        });

        const commissionPercent = round2(commissionRule?.commission || 0);
        const gstPercent = round2(commissionRule?.gst || 0);
        const settlement = calculatePayinSettlement({
          amount: grossAmount,
          commissionPercent,
          gstPercent,
        });

        await tx.merchantWalletBalance.upsert({
          where: { merchantId: order.merchantId },
          create: {
            merchantId: order.merchantId,
            payinBalance: settlement.netAmount,
            payoutBalance: 0,
          },
          update: {
            payinBalance: { increment: settlement.netAmount },
          },
        });

        const updated = await tx.payInOrder.updateMany({
          where: {
            clientRefNo: RefId,
            status: { not: "SUCCESS" },
          },
          data: {
            status: "SUCCESS",
            txnId: txnId || undefined,
            bankRrn: bankRrn || undefined,
            charge: settlement.commissionAmount,
            gst: settlement.gstAmount,
            balance: settlement.netAmount,
            providerRaw: JSON.stringify({
              ...(order.providerRaw ? (() => {
                try {
                  return JSON.parse(order.providerRaw);
                } catch {
                  return {};
                }
              })() : {}),
              statusCheckResponse: data,
              commission: {
                commissionPercent,
                gstPercent,
                commissionAmount: settlement.commissionAmount,
                gstAmount: settlement.gstAmount,
                netSettlementAmount: settlement.netAmount,
              },
            }),
          },
        });

        return { updated: updated.count };
      });

      dbUpdated = txResult.updated > 0;
      rememberWithLimit(statusSignatureCache, cacheKey, nextSignature);
    }

    return NextResponse.json(
      { success: result.ok, upstreamStatus: result.status, dbUpdated, data },
      { status: result.ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json({ message: error?.message || "status-check failed" }, { status: 500 });
  }
};

export const POST = withApiLogging("payin/status-check:POST", postHandler);
