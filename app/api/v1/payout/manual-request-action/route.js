import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";
import { createProviderPayoutOrder } from "@/lib/payvision";

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function normalizePayoutStatus({ apiStatus, message, upstreamOk }) {
  const source = `${String(apiStatus || "")} ${String(message || "")}`.toUpperCase();
  if (source.includes("SUCCESS") || source.includes("COMPLETED")) return "SUCCESS";
  if (source.includes("FAIL") || source.includes("REJECT") || source.includes("ERROR")) return "FAILED";
  if (source.includes("PENDING") || source.includes("PROCESS")) return "PENDING";
  return upstreamOk ? "PENDING" : "FAILED";
}

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const refId = String(body?.refId || "").trim();
    const action = String(body?.action || "").trim().toUpperCase();
    if (!refId || (action !== "APPROVE" && action !== "REJECT")) {
      return NextResponse.json({ message: "refId and valid action are required" }, { status: 400 });
    }

    const order = await prisma.payoutOrder.findUnique({
      where: { clientRefNo: refId },
      select: {
        id: true,
        merchantId: true,
        clientRefNo: true,
        amount: true,
        charge: true,
        gst: true,
        balance: true,
        status: true,
        providerRaw: true,
      },
    });
    if (!order) return NextResponse.json({ message: "manual request not found" }, { status: 404 });
    if (String(order.status || "") !== "MANUAL_PENDING") {
      return NextResponse.json({ message: "request is not pending for manual approval" }, { status: 400 });
    }

    if (action === "REJECT") {
      await prisma.payoutOrder.update({
        where: { clientRefNo: refId },
        data: { status: "MANUAL_REJECTED" },
      });
      return NextResponse.json({ success: true, message: "Manual payout request rejected." });
    }

    let parsed = {};
    try {
      parsed = order.providerRaw ? JSON.parse(order.providerRaw) : {};
    } catch {
      parsed = {};
    }
    const providerPayload = parsed?.payOrderRequest || {};
    if (!providerPayload || !providerPayload.AccountNo || !providerPayload.IFSC) {
      return NextResponse.json({ message: "Stored payout request payload is invalid" }, { status: 400 });
    }

    const totalDeduction = round2(order.balance || (Number(order.amount || 0) + Number(order.charge || 0) + Number(order.gst || 0)));
    const debitResult = await prisma.merchantWalletBalance.updateMany({
      where: {
        merchantId: order.merchantId,
        payoutBalance: { gte: totalDeduction },
      },
      data: {
        payoutBalance: { decrement: totalDeduction },
      },
    });
    if (!debitResult.count) {
      return NextResponse.json({ message: "Insufficient payout balance at approval time." }, { status: 400 });
    }

    try {
      const upstream = await createProviderPayoutOrder(providerPayload);
      const openMoneyStatus = Number(firstNonEmpty(upstream.data?.status, upstream.data?.data?.status));
      if (openMoneyStatus !== 1) {
        throw new Error(firstNonEmpty(upstream.data?.message, upstream.data?.data?.message, "Payout request rejected by OpenMoney"));
      }

      const providerTxnId = firstNonEmpty(
        upstream.data?.txn_id,
        upstream.data?.txnID,
        upstream.data?.txnId,
        upstream.data?.txnid,
        upstream.data?.data?.txn_id,
        upstream.data?.data?.txnID,
        upstream.data?.data?.txnId,
      );
      const providerRef = firstNonEmpty(
        upstream.data?.ref_id,
        upstream.data?.RefID,
        upstream.data?.client_RefNo,
        upstream.data?.clientRefNo,
        upstream.data?.data?.ref_id,
        upstream.data?.data?.RefID,
        refId,
      );
      const bankRrn = firstNonEmpty(
        upstream.data?.banK_refno,
        upstream.data?.bankRRN,
        upstream.data?.utR_RRN,
        upstream.data?.utr,
        upstream.data?.data?.banK_refno,
        upstream.data?.data?.bankRRN,
        upstream.data?.data?.utR_RRN,
      );
      const status = normalizePayoutStatus({
        apiStatus: firstNonEmpty(upstream.data?.apI_status, upstream.data?.data?.apI_status, upstream.data?.status),
        message: firstNonEmpty(upstream.data?.message, upstream.data?.data?.message),
        upstreamOk: upstream.ok,
      });

      await prisma.payoutOrder.update({
        where: { clientRefNo: refId },
        data: {
          txnId: providerTxnId || undefined,
          bankRrn: bankRrn || undefined,
          providerRef: providerRef || refId,
          status,
          providerRaw: JSON.stringify({
            ...(parsed || {}),
            approvedBy: sessionUser.email,
            approvedAt: new Date().toISOString(),
            payOrderResponse: upstream.data,
          }),
        },
      });

      return NextResponse.json({ success: true, message: "Manual payout request approved and sent to gateway." });
    } catch (error) {
      await prisma.$transaction([
        prisma.merchantWalletBalance.update({
          where: { merchantId: order.merchantId },
          data: { payoutBalance: { increment: totalDeduction } },
        }),
        prisma.payoutOrder.update({
          where: { clientRefNo: refId },
          data: {
            status: "FAILED",
            providerRaw: JSON.stringify({
              ...(parsed || {}),
              approvedBy: sessionUser.email,
              approvedAt: new Date().toISOString(),
              approvalError: error?.message || "Gateway call failed",
            }),
          },
        }),
      ]);
      return NextResponse.json({ message: error?.message || "Approval failed while sending payout" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: error?.message || "Manual payout action failed" }, { status: 500 });
  }
};

export const POST = withApiLogging("payout/manual-request-action:POST", postHandler);

