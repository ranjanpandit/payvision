import { NextResponse } from "next/server";
import { createProviderPayoutOrder, getProviderConfig } from "@/lib/zixpay";
import { withApiLogging } from "@/lib/api-logger";
import { decodeJwt } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function extractBearerToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return String(match?.[1] || "").trim();
}

function isLikelyValidClientToken(token, config) {
  try {
    const payload = decodeJwt(token);
    const exp = Number(payload?.exp || 0);
    if (!exp || exp * 1000 <= Date.now()) {
      return { ok: false, message: "token expired" };
    }

    const tokenEmail = String(payload?.email || "").trim().toLowerCase();
    const tokenMid = String(payload?.sub || payload?.mid || "").trim();
    const expectedEmail = String(config.email || "").trim().toLowerCase();
    const expectedMid = String(config.mid || "").trim();

    if (tokenEmail && expectedEmail && tokenEmail !== expectedEmail) {
      return { ok: false, message: "invalid token email" };
    }
    if (tokenMid && expectedMid && tokenMid !== expectedMid) {
      return { ok: false, message: "invalid token mid" };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: "invalid token" };
  }
}

function resolveMerchantApiTokenDelegate() {
  const delegate = prisma?.merchantApiToken;
  if (!delegate || typeof delegate.findFirst !== "function") {
    return null;
  }
  return delegate;
}

function resolvePayoutOrderDelegate() {
  const delegate = prisma?.payoutOrder;
  if (!delegate || typeof delegate.findUnique !== "function" || typeof delegate.upsert !== "function") {
    return null;
  }
  return delegate;
}

function resolveMerchantWalletBalanceDelegate() {
  const delegate = prisma?.merchantWalletBalance;
  if (!delegate || typeof delegate.findUnique !== "function" || typeof delegate.updateMany !== "function") {
    return null;
  }
  return delegate;
}

function resolveMerchantCommissionSettingDelegate() {
  const delegate = prisma?.merchantCommissionSetting;
  if (!delegate || typeof delegate.findFirst !== "function") {
    return null;
  }
  return delegate;
}

function asPositiveAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

function calculatePayoutDeduction({ amount, commissionPercent, gstPercent }) {
  const baseAmount = round2(amount);
  const commissionAmount = round2((baseAmount * commissionPercent) / 100);
  const gstAmount = round2((commissionAmount * gstPercent) / 100);
  const totalDeduction = round2(baseAmount + commissionAmount + gstAmount);
  return {
    amount: baseAmount,
    commissionAmount,
    gstAmount,
    totalDeduction,
  };
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

function generateBaseRefId() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `rcpt_${ts}${rand}`;
}

async function generateUniqueRefId(payoutOrder) {
  for (let i = 0; i < 10; i += 1) {
    const candidate = generateBaseRefId();
    const existing = await payoutOrder.findUnique({
      where: { clientRefNo: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${generateBaseRefId()}_${Math.floor(Math.random() * 10000)}`;
}

const postHandler = async (req) => {
  try {
    const config = getProviderConfig();
    const rawBody = await req.text();
    let body = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const incomingToken = extractBearerToken(authHeader);

    if (!incomingToken) {
      return NextResponse.json(
        { message: "Authorization Bearer token is required" },
        { status: 401 },
      );
    }

    const tokenCheck = isLikelyValidClientToken(incomingToken, config);
    if (!tokenCheck.ok) {
      return NextResponse.json({ message: tokenCheck.message || "invalid or expired token" }, { status: 401 });
    }

    const merchantApiToken = resolveMerchantApiTokenDelegate();
    if (!merchantApiToken) {
      return NextResponse.json(
        { message: "Prisma client is stale. Please restart server and run prisma generate." },
        { status: 500 },
      );
    }

    const tokenRow = await merchantApiToken.findFirst({
      where: {
        token: incomingToken,
        provider: "PRIMARY",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { merchantId: true },
    });

    const merchantId = String(tokenRow?.merchantId || "").trim();
    if (!merchantId) {
      return NextResponse.json({ message: "invalid token mapping" }, { status: 401 });
    }

    const payoutOrder = resolvePayoutOrderDelegate();
    if (!payoutOrder) {
      return NextResponse.json(
        { message: "Prisma client is stale. Please restart server and run prisma generate." },
        { status: 500 },
      );
    }

    const merchantWalletBalance = resolveMerchantWalletBalanceDelegate();
    if (!merchantWalletBalance) {
      return NextResponse.json(
        { message: "Prisma client is stale. Please restart server and run prisma generate." },
        { status: 500 },
      );
    }

    const merchantCommissionSetting = resolveMerchantCommissionSettingDelegate();
    if (!merchantCommissionSetting) {
      return NextResponse.json(
        { message: "Prisma client is stale. Please restart server and run prisma generate." },
        { status: 500 },
      );
    }

    const RefID = await generateUniqueRefId(payoutOrder);
    const amount = asPositiveAmount(body?.Amount ?? body?.amount);
    const mobile = String(body?.MobileNumber || body?.mobile || "").replace(/\D/g, "").slice(-10);

    if (!amount) {
      return NextResponse.json({ message: "Amount is required" }, { status: 400 });
    }

    const commissionRule = await merchantCommissionSetting.findFirst({
      where: {
        merchantId,
        provider: "PRIMARY",
        commissionType: "PAYOUT",
        fromAmount: { lte: amount },
        toAmount: { gte: amount },
      },
      orderBy: [{ fromAmount: "desc" }, { id: "desc" }],
      select: {
        commission: true,
        gst: true,
      },
    });

    const commissionPercent = round2(commissionRule?.commission || 0);
    const gstPercent = round2(commissionRule?.gst || 0);
    const deduction = calculatePayoutDeduction({
      amount,
      commissionPercent,
      gstPercent,
    });

    const wallet = await merchantWalletBalance.findUnique({
      where: { merchantId },
      select: { payoutBalance: true },
    });
    const availablePayoutBalance = round2(wallet?.payoutBalance || 0);
    if (availablePayoutBalance < deduction.totalDeduction) {
      return NextResponse.json(
        {
          message: "Insufficient payout balance",
          details: {
            merchantId,
            amount: deduction.amount,
            commissionPercent,
            gstPercent,
            commissionAmount: deduction.commissionAmount,
            gstAmount: deduction.gstAmount,
            totalDeduction: deduction.totalDeduction,
            availablePayoutBalance,
          },
        },
        { status: 400 },
      );
    }

    const providerPayload = {
      RefID,
      AccountNo: String(body?.AccountNo || "").trim(),
      MobileNumber: mobile,
      PaymentMode: Number(body?.PaymentMode || 1),
      Amount: amount,
      HolderName: String(body?.HolderName || "").trim(),
      IFSC: String(body?.IFSC || "").trim(),
      latlong: String(body?.latlong || "0,0").trim(),
      AccountType: String(body?.AccountType || "savings").trim(),
      BankName: String(body?.BankName || "").trim(),
    };

    const upstream = await createProviderPayoutOrder(providerPayload);

    const openMoneyStatus = Number(
      firstNonEmpty(
        upstream.data?.status,
        upstream.data?.data?.status,
      ),
    );
    const isAccepted = openMoneyStatus === 1;
    if (!isAccepted) {
      return NextResponse.json(
        {
          message: firstNonEmpty(
            upstream.data?.message,
            upstream.data?.data?.message,
            "Payout request rejected by Provider",
          ),
          providerResponse: upstream.data,
        },
        {
          status: 400,
          headers: { "x-zixpay-refid": RefID },
        },
      );
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
      RefID,
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

    const saveResult = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.merchantWalletBalance.updateMany({
        where: {
          merchantId,
          payoutBalance: { gte: deduction.totalDeduction },
        },
        data: {
          payoutBalance: { decrement: deduction.totalDeduction },
        },
      });

      if (!updateResult.count) {
        throw new Error("INSUFFICIENT_PAYOUT_BALANCE");
      }

      await tx.payoutOrder.upsert({
        where: { clientRefNo: RefID },
        create: {
          merchantId,
          clientRefNo: RefID,
          amount: deduction.amount,
          charge: deduction.commissionAmount,
          gst: deduction.gstAmount,
          balance: deduction.totalDeduction,
          customerName: String(providerPayload.HolderName || "Beneficiary"),
          customerPhone: mobile || "0000000000",
          customerEmail: config.email,
          txnId: providerTxnId || "",
          bankRrn: bankRrn || "",
          provider: "PRIMARY",
          providerRef: providerRef || RefID,
          paymentUrl: "",
          qrString: "",
          providerRaw: JSON.stringify({
            type: "PAYOUT",
            payOrderRequest: providerPayload,
            payOrderResponse: upstream.data,
            commission: {
              commissionPercent,
              gstPercent,
              commissionAmount: deduction.commissionAmount,
              gstAmount: deduction.gstAmount,
              totalDeduction: deduction.totalDeduction,
            },
          }),
          status,
        },
        update: {
          merchantId,
          amount: deduction.amount,
          charge: deduction.commissionAmount,
          gst: deduction.gstAmount,
          balance: deduction.totalDeduction,
          customerName: String(providerPayload.HolderName || "Beneficiary"),
          customerPhone: mobile || "0000000000",
          txnId: providerTxnId || undefined,
          bankRrn: bankRrn || undefined,
          provider: "PRIMARY",
          providerRef: providerRef || RefID,
          status,
          providerRaw: JSON.stringify({
            type: "PAYOUT",
            payOrderRequest: providerPayload,
            payOrderResponse: upstream.data,
            commission: {
              commissionPercent,
              gstPercent,
              commissionAmount: deduction.commissionAmount,
              gstAmount: deduction.gstAmount,
              totalDeduction: deduction.totalDeduction,
            },
          }),
        },
      });

      const finalWallet = await tx.merchantWalletBalance.findUnique({
        where: { merchantId },
        select: { payoutBalance: true },
      });

      return {
        payoutBalance: round2(finalWallet?.payoutBalance || 0),
      };
    });

    return new NextResponse(upstream.text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.contentType,
        "x-zixpay-refid": RefID,
        "x-zixpay-total-deduction": String(deduction.totalDeduction),
        "x-zixpay-payout-balance": String(saveResult.payoutBalance),
      },
    });
  } catch (error) {
    if (String(error?.message || "") === "INSUFFICIENT_PAYOUT_BALANCE") {
      return NextResponse.json(
        { message: "Insufficient payout balance" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: error?.message || "pay-order proxy failed" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("provider/payout/pay-order:POST", postHandler);


