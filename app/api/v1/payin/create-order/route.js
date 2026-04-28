import { NextResponse } from "next/server";
import { createProviderToken, getOpenMoneyConfig } from "@/lib/payvision";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

const postHandler = async (req) => {
  try {
    const body = await req.json();
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const amount = Number(body?.amount || 0);
    const clientRefNo = String(body?.clientRefNo || body?.RefID || "").trim();
    const customerPhone = String(body?.customer?.phone || "").replace(/\D/g, "").slice(-10);

    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "amount is required" }, { status: 400 });
    }
    if (!clientRefNo) {
      return NextResponse.json({ message: "clientRefNo is required" }, { status: 400 });
    }
    if (!customerPhone) {
      return NextResponse.json({ message: "customer phone is required" }, { status: 400 });
    }

    const token = await createProviderToken();
    const config = getOpenMoneyConfig();

    const providerPayload = {
      RefID: clientRefNo,
      Amount: Number.isInteger(amount) ? String(amount) : amount.toFixed(2),
      Customer_Name: body?.customer?.name || "Customer",
      Customer_Mobile: customerPhone,
      Customer_Email: body?.customer?.email || config.email,
    };

    const response = await fetch(`${config.baseUrl}/api/Payin/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(providerPayload),
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { message: data?.message || "Provider create-order failed" },
        { status: 502 }
      );
    }

    const resolvedMerchantId =
      String(body?.merchantId || "").trim() || sessionUser.merchantId || "";
    if (!resolvedMerchantId) {
      return NextResponse.json({ message: "merchantId is required" }, { status: 400 });
    }

    const paymentUrl = data?.paymentUrl || data?.payment_url || data?.qrString || "";
    const qrString = data?.qrString || data?.data?.qrString || "";
    const providerTxnId = String(data?.txnId || data?.txnid || data?.data?.txnId || "").trim();
    const providerRef = String(data?.refNo || data?.RefNo || data?.data?.refNo || clientRefNo).trim();
    const charge = Number(body?.charge || 0);
    const gst = Number(body?.gst || 0);
    const balance = Number((amount - charge - gst).toFixed(2));

    await prisma.payInOrder.upsert({
      where: { clientRefNo },
      create: {
        merchantId: resolvedMerchantId,
        clientRefNo,
        amount,
        charge,
        gst,
        balance,
        customerName: String(body?.customer?.name || "Customer"),
        customerPhone,
        customerEmail: String(body?.customer?.email || config.email),
        txnId: providerTxnId,
        provider: "OPENMONEY",
        providerRef,
        paymentUrl: String(paymentUrl),
        qrString: String(qrString),
        providerRaw: JSON.stringify(data),
        status: "PENDING",
      },
      update: {
        merchantId: resolvedMerchantId,
        amount,
        charge,
        gst,
        balance,
        customerName: String(body?.customer?.name || "Customer"),
        customerPhone,
        customerEmail: String(body?.customer?.email || config.email),
        txnId: providerTxnId,
        provider: "OPENMONEY",
        providerRef,
        paymentUrl: String(paymentUrl),
        qrString: String(qrString),
        providerRaw: JSON.stringify(data),
      },
    });

    return NextResponse.json({
      success: true,
      merchantId: resolvedMerchantId,
      refId: clientRefNo,
      qrString,
      paymentUrl,
      providerResponse: data,
    });
  } catch (error) {
    return NextResponse.json({ message: error?.message || "create-order failed" }, { status: 500 });
  }
};

export const POST = withApiLogging("payin/create-order:POST", postHandler);
