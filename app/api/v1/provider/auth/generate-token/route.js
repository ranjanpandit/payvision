import { NextResponse } from "next/server";
import { getProviderConfig } from "@/lib/zixpay";
import { prisma } from "@/lib/prisma";
import { decodeJwt } from "jose";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function sanitize(v) {
  return String(v || "").trim();
}

function getMerchantApiTokenDelegate() {
  const delegate = prisma?.merchantApiToken;
  if (!delegate || typeof delegate.create !== "function") {
    return null;
  }
  return delegate;
}

function resolveExpiryFromToken(token) {
  try {
    const decoded = decodeJwt(token);
    if (decoded?.exp) {
      return new Date(Number(decoded.exp) * 1000);
    }
  } catch {
    // If provider token is not a JWT, fallback to a short-lived validity window.
  }

  return new Date(Date.now() + 30 * 60 * 1000);
}

const postHandler = async (req) => {
  try {
    const body = await req.json();
    const config = getProviderConfig();

    const payload = {
      mid: sanitize(body?.mid),
      email: sanitize(body?.email),
      secretkey: sanitize(body?.secretkey),
    };

    if (!payload.mid || !payload.email || !payload.secretkey) {
      return NextResponse.json(
        { message: "mid, email and secretkey are required" },
        { status: 400 },
      );
    }

    const merchant = await prisma.merchant.findUnique({
      where: { merchantId: payload.mid },
      select: {
        merchantId: true,
        email: true,
        apiSecret: true,
        status: true,
      },
    });

    if (!merchant || String(merchant.status || "").toUpperCase() !== "ACTIVE") {
      return NextResponse.json({ message: "invalid merchant" }, { status: 401 });
    }

    if (sanitize(merchant.email).toLowerCase() !== payload.email.toLowerCase()) {
      return NextResponse.json({ message: "invalid credentials" }, { status: 401 });
    }

    if (sanitize(merchant.apiSecret) !== payload.secretkey) {
      return NextResponse.json({ message: "invalid credentials" }, { status: 401 });
    }

    const upstream = await fetch(`${config.baseUrl}/api/Auth/generate-token`, {
      method: "POST",
      headers: {
        accept: "*/*",
        "Content-Type": "application/json",
      },
      // Always use ZIXPAY provider credentials for Provider integration.
      body: JSON.stringify({
        mid: config.mid,
        email: config.email,
        secretkey: config.secretKey,
      }),
      cache: "no-store",
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    if (upstream.ok) {
      try {
        const data = JSON.parse(text);
        const token = String(data?.token || data?.accessToken || data?.access_token || "").trim();

        if (token) {
          const tokenDelegate = getMerchantApiTokenDelegate();
          if (!tokenDelegate) {
            return NextResponse.json(
              { message: "Prisma client is stale. Please restart server and run prisma generate." },
              { status: 500 },
            );
          }

          await tokenDelegate.create({
            data: {
              merchantId: merchant.merchantId,
              provider: "PRIMARY",
              token,
              expiresAt: resolveExpiryFromToken(token),
            },
          });
        }
      } catch {
        // Upstream may respond with non-JSON in edge cases; passthrough should still continue.
      }
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "generate-token proxy failed" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("provider/auth/generate-token:POST", postHandler);


