import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Number(n.toFixed(2));
}

function generateRef(prefix) {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `${prefix}_${ts}${rand}`;
}

async function generateUniqueRef(prefix) {
  for (let i = 0; i < 8; i += 1) {
    const candidate = generateRef(prefix);
    const existing = await prisma.payoutOrder.findUnique({
      where: { clientRefNo: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${generateRef(prefix)}_${Math.floor(Math.random() * 1000)}`;
}

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const merchantId = String(body?.merchantId || "").trim();
    const narration = String(body?.narration || "").trim();
    const transactionPin = String(body?.transactionPin || "").trim();
    const actionType = String(body?.actionType || "CREDIT").trim().toUpperCase() === "DEBIT" ? "DEBIT" : "CREDIT";
    const amount = toMoney(body?.amount);

    if (!merchantId) {
      return NextResponse.json({ message: "merchantId is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "amount must be greater than 0" }, { status: 400 });
    }
    if (!narration) {
      return NextResponse.json({ message: "narration is required" }, { status: 400 });
    }
    if (!transactionPin) {
      return NextResponse.json({ message: "transactionPin is required" }, { status: 400 });
    }

    const configuredPin = String(process.env.ADMIN_WALLET_TXN_PIN || process.env.WALLET_TXN_PIN || "").trim();
    if (configuredPin && transactionPin !== configuredPin) {
      return NextResponse.json({ message: "invalid transaction pin" }, { status: 403 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { merchantId },
      select: { merchantId: true },
    });
    if (!merchant) {
      return NextResponse.json({ message: "merchant not found" }, { status: 404 });
    }

    const refNo = await generateUniqueRef("PAYOUT_ADJ");

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.merchantWalletBalance.upsert({
        where: { merchantId },
        create: {
          merchantId,
          payinBalance: 0,
          payoutBalance: 0,
        },
        update: {},
      });

      const before = Number(wallet.payoutBalance || 0);
      const after = actionType === "CREDIT"
        ? Number((before + amount).toFixed(2))
        : Number((before - amount).toFixed(2));

      if (actionType === "DEBIT" && after < 0) {
        throw new Error("INSUFFICIENT_PAYOUT_BALANCE");
      }

      const updatedWallet = await tx.merchantWalletBalance.update({
        where: { merchantId },
        data: {
          payoutBalance: after,
        },
      });

      await tx.adminWalletActivityLog.create({
        data: {
          adminUserId: sessionUser.id,
          adminEmail: String(sessionUser.email || ""),
          merchantId,
          walletType: "PAYOUT",
          actionType,
          amount,
          balanceBefore: before,
          balanceAfter: after,
          narration: narration.slice(0, 500),
        },
      });

      await tx.payoutOrder.create({
        data: {
          merchantId,
          clientRefNo: refNo,
          amount,
          charge: 0,
          gst: 0,
          balance: amount,
          customerName: "ADMIN WALLET",
          customerPhone: "0000000000",
          customerEmail: String(sessionUser.email || ""),
          txnId: "",
          bankRrn: "",
          provider: "INTERNAL_ADMIN",
          providerRef: refNo,
          paymentUrl: "",
          qrString: "",
          providerRaw: JSON.stringify({
            type: "ADMIN_WALLET_ADJUSTMENT",
            walletType: "PAYOUT",
            actionType,
            narration,
            adminUserId: sessionUser.id,
            adminEmail: sessionUser.email,
            balanceBefore: before,
            balanceAfter: after,
          }),
          status: "SUCCESS",
        },
      });

      return {
        merchantId,
        actionType,
        amount,
        payoutBalance: Number(updatedWallet.payoutBalance || 0),
        referenceId: refNo,
      };
    });

    return NextResponse.json({ success: true, record: result }, { status: 201 });
  } catch (error) {
    if (String(error?.message || "") === "INSUFFICIENT_PAYOUT_BALANCE") {
      return NextResponse.json({ message: "Insufficient payout balance" }, { status: 400 });
    }
    return NextResponse.json(
      { message: error?.message || "Failed to adjust payout wallet" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("wallet/payout/adjust:POST", postHandler);
