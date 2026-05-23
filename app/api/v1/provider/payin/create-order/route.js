import { NextResponse } from "next/server";
import { createProviderToken, getProviderConfig } from "@/lib/zixpay";
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

function asPositiveAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolveMerchantApiTokenDelegate() {
  const delegate = prisma?.merchantApiToken;
  if (!delegate || typeof delegate.findFirst !== "function") {
    return null;
  }
  return delegate;
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

    if (!tokenRow?.merchantId) {
      return NextResponse.json({ message: "invalid token mapping" }, { status: 401 });
    }

    const upstreamToken = await createProviderToken();

    const upstream = await fetch(`${config.baseUrl}/api/Payin/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstreamToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    let upstreamData = {};
    try {
      upstreamData = text ? JSON.parse(text) : {};
    } catch {
      upstreamData = { raw: text };
    }

    if (upstream.ok) {
      const amount = asPositiveAmount(body?.amount ?? body?.Amount);
      const clientRefNo = String(
        body?.clientRefNo ||
          body?.RefID ||
          body?.RefId ||
          body?.refId ||
          body?.receipt ||
          body?.receiptId ||
          "",
      ).trim();
      const customerName = String(
        body?.customer?.name ||
          body?.Customer_Name ||
          body?.customerName ||
          "Customer",
      ).trim();
      const customerPhone = String(
        body?.customer?.phone ||
          body?.Customer_Mobile ||
          body?.customerPhone ||
          "",
      )
        .replace(/\D/g, "")
        .slice(-10);
      const customerEmail = String(
        body?.customer?.email ||
          body?.Customer_Email ||
          body?.customerEmail ||
          config.email,
      ).trim();

      if (amount > 0 && clientRefNo) {
        const charge = Number(body?.charge || 0) || 0;
        const gst = Number(body?.gst || 0) || 0;
        const balance = Number((amount - charge - gst).toFixed(2));

        const paymentUrl =
          upstreamData?.paymentUrl || upstreamData?.payment_url || upstreamData?.qrString || "";
        const qrString = upstreamData?.qrString || upstreamData?.data?.qrString || "";
        const providerTxnId = String(
          upstreamData?.txnId || upstreamData?.txnid || upstreamData?.data?.txnId || "",
        ).trim();
        const providerRef = String(
          upstreamData?.refNo || upstreamData?.RefNo || upstreamData?.data?.refNo || clientRefNo,
        ).trim();

        await prisma.payInOrder.upsert({
          where: { clientRefNo },
          create: {
            merchantId: tokenRow.merchantId,
            clientRefNo,
            amount,
            charge,
            gst,
            balance,
            customerName,
            customerPhone,
            customerEmail,
            txnId: providerTxnId,
            provider: "PRIMARY",
            providerRef,
            paymentUrl: String(paymentUrl),
            qrString: String(qrString),
            providerRaw: JSON.stringify({
              createOrderRequest: body,
              createOrderResponse: upstreamData,
            }),
            status: "PENDING",
          },
          update: {
            merchantId: tokenRow.merchantId,
            amount,
            charge,
            gst,
            balance,
            customerName,
            customerPhone,
            customerEmail,
            txnId: providerTxnId,
            provider: "PRIMARY",
            providerRef,
            paymentUrl: String(paymentUrl),
            qrString: String(qrString),
            providerRaw: JSON.stringify({
              createOrderRequest: body,
              createOrderResponse: upstreamData,
            }),
          },
        });
      }
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "create-order proxy failed" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("provider/payin/create-order:POST", postHandler);


