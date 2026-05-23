import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getProviderConfig } from "@/lib/zixpay";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function sanitize(v) {
  return String(v || "").trim();
}

function resolveExpiryFromToken(token) {
  try {
    const decoded = decodeJwt(token);
    if (decoded?.exp) {
      return new Date(Number(decoded.exp) * 1000);
    }
  } catch {
  }
  return new Date(Date.now() + 30 * 60 * 1000);
}

function getMerchantApiTokenDelegate() {
  const delegate = prisma?.merchantApiToken;
  if (!delegate || typeof delegate.create !== "function") {
    return null;
  }
  return delegate;
}

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const requestedMerchantId = sanitize(body?.merchantId);
    const merchantId =
      sessionUser.role === "ADMIN"
        ? requestedMerchantId
        : sanitize(sessionUser.merchantId);

    if (!merchantId) {
      return NextResponse.json({ message: "merchantId is required" }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { merchantId },
      select: {
        merchantId: true,
        status: true,
      },
    });

    if (!merchant || String(merchant.status || "").toUpperCase() !== "ACTIVE") {
      return NextResponse.json({ message: "invalid merchant" }, { status: 401 });
    }

    const config = getProviderConfig();

    const upstream = await fetch(`${config.baseUrl}/api/Auth/generate-token`, {
      method: "POST",
      headers: {
        accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mid: config.mid,
        email: config.email,
        secretkey: config.secretKey,
      }),
      cache: "no-store",
    });

    const text = await upstream.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { message: "Non-JSON response from provider", raw: text },
        { status: 502 },
      );
    }

    const token = sanitize(data?.token || data?.accessToken || data?.access_token);
    if (!upstream.ok || !token) {
      return NextResponse.json(
        { message: data?.message || "Token generation failed" },
        { status: upstream.status || 502 },
      );
    }

    const tokenDelegate = getMerchantApiTokenDelegate();
    if (!tokenDelegate) {
      return NextResponse.json(
        { message: "Prisma client is stale. Please restart server and run prisma generate." },
        { status: 500 },
      );
    }

    const expiresAt = resolveExpiryFromToken(token);
    await tokenDelegate.create({
      data: {
        merchantId: merchant.merchantId,
        provider: "PRIMARY",
        token,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      merchantId: merchant.merchantId,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "client-token generation failed" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("provider/auth/client-token:POST", postHandler);


