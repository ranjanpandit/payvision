import { NextResponse } from "next/server";
import { checkProviderStatus, getOpenMoneyConfig } from "@/lib/payvision";
import { withApiLogging } from "@/lib/api-logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
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

function parseProviderRaw(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function normalizePayoutStatus(raw) {
  const source = String(raw || "").toUpperCase();
  if (source.includes("SUCCESS") || source.includes("COMPLETED")) return "SUCCESS";
  if (source.includes("FAIL") || source.includes("REJECT") || source.includes("ERROR")) return "FAILED";
  return "PENDING";
}

function resolvePayoutOrderDelegate() {
  const delegate = prisma?.payoutOrder;
  if (!delegate || typeof delegate.updateMany !== "function" || typeof delegate.findUnique !== "function") {
    return null;
  }
  return delegate;
}

const postHandler = async (req) => {
  try {
    getOpenMoneyConfig();
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
        body?.client_RefNo ||
        body?.receipt ||
        body?.receiptId ||
        body?.txnID ||
        body?.txnId ||
        body?.clientRefNo ||
        "",
    ).trim();
    const Service_Id = String(body?.Service_Id || body?.serviceId || "2").trim();

    if (!RefId) {
      return NextResponse.json({ message: "RefId is required" }, { status: 400 });
    }

    const payoutOrder = resolvePayoutOrderDelegate();
    if (!payoutOrder) {
      return NextResponse.json(
        { message: "Prisma client is stale. Please restart server and run prisma generate." },
        { status: 500 },
      );
    }

    const result = await checkProviderStatus({ RefId, Service_Id });

    const statusSource = firstNonEmpty(
      result.data?.apI_status,
      result.data?.status,
      result.data?.Status,
      result.data?.message,
      result.data?.data?.apI_status,
      result.data?.data?.status,
      result.data?.data?.Status,
      result.data?.data?.message,
    );
    const normalizedStatus = normalizePayoutStatus(statusSource);

    const txnId = firstNonEmpty(
      result.data?.txn_id,
      result.data?.txnID,
      result.data?.txnId,
      result.data?.txnid,
      result.data?.data?.txn_id,
      result.data?.data?.txnID,
      result.data?.data?.txnId,
    );
    const bankRrn = firstNonEmpty(
      result.data?.banK_refno,
      result.data?.utR_RRN,
      result.data?.bankRRN,
      result.data?.rrn,
      result.data?.data?.banK_refno,
      result.data?.data?.utR_RRN,
      result.data?.data?.bankRRN,
      result.data?.data?.rrn,
    );

    const statusKey = String(RefId);
    const nextSignature = toStatusSignature({
      status: normalizedStatus,
      txnId,
      bankRrn,
    });
    const prevSignature = statusSignatureCache.get(statusKey);
    if (prevSignature !== nextSignature) {
      const order = await payoutOrder.findUnique({
        where: { clientRefNo: RefId },
        select: {
          merchantId: true,
          status: true,
          balance: true,
          providerRaw: true,
        },
      });

      if (order) {
        const providerRaw = parseProviderRaw(order.providerRaw);
        const reversalMeta = providerRaw?.reversal || {};
        const alreadyReverted = Boolean(reversalMeta?.reverted);
        const deductionAmount = round2(
          providerRaw?.commission?.totalDeduction ??
            order.balance ??
            0,
        );

        if (normalizedStatus === "FAILED") {
          const failedUpdate = await prisma.$transaction(async (tx) => {
            const statusUpdate = await tx.payoutOrder.updateMany({
              where: {
                clientRefNo: RefId,
                status: { not: "FAILED" },
              },
              data: {
                status: "FAILED",
                txnId: txnId || undefined,
                bankRrn: bankRrn || undefined,
                providerRaw: JSON.stringify({
                  ...providerRaw,
                  statusCheckResponse: result.data,
                  reversal: {
                    ...reversalMeta,
                    reverted: alreadyReverted,
                    deductionAmount,
                    checkedAt: new Date().toISOString(),
                  },
                }),
              },
            });

            if (!statusUpdate.count || alreadyReverted || deductionAmount <= 0) {
              return statusUpdate.count;
            }

            await tx.merchantWalletBalance.upsert({
              where: { merchantId: order.merchantId },
              create: {
                merchantId: order.merchantId,
                payinBalance: 0,
                payoutBalance: deductionAmount,
              },
              update: {
                payoutBalance: { increment: deductionAmount },
              },
            });

            await tx.payoutOrder.updateMany({
              where: { clientRefNo: RefId },
              data: {
                providerRaw: JSON.stringify({
                  ...providerRaw,
                  statusCheckResponse: result.data,
                  reversal: {
                    ...reversalMeta,
                    reverted: true,
                    deductionAmount,
                    revertedAt: new Date().toISOString(),
                    checkedAt: new Date().toISOString(),
                  },
                }),
              },
            });

            return statusUpdate.count;
          });

          if (!failedUpdate) {
            // Keep txnId/bankRrn fresh for already-failed records without reopening status.
            await payoutOrder.updateMany({
              where: { clientRefNo: RefId, status: "FAILED" },
              data: {
                txnId: txnId || undefined,
                bankRrn: bankRrn || undefined,
              },
            });
          }
        } else {
          // Do not reopen terminal failed orders; that could cause double-reversal scenarios.
          await payoutOrder.updateMany({
            where: {
              clientRefNo: RefId,
              status: { not: "FAILED" },
            },
            data: {
              status: normalizedStatus,
              txnId: txnId || undefined,
              bankRrn: bankRrn || undefined,
              providerRaw: JSON.stringify({
                ...providerRaw,
                statusCheckResponse: result.data,
              }),
            },
          });
        }
      }

      rememberWithLimit(statusSignatureCache, statusKey, nextSignature);
    }

    return NextResponse.json(result.data, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "status-check proxy failed" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("openmoney/payout/status-check:POST", postHandler);
