import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiLogging } from "@/lib/api-logger";

function randomPart(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function two(n) {
  return String(n).padStart(2, "0");
}

function sanitize(v) {
  return String(v || "").trim();
}

function generateMerchantId() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  return `PV-MCH-${stamp}-${randomPart(6)}`;
}

const postHandler = async (req) => {
  try {
    const body = await req.json();
    const firstName = sanitize(body?.firstName);
    const lastName = sanitize(body?.lastName);
    const companyName = sanitize(body?.companyName);
    const email = sanitize(body?.email);
    const phone = sanitize(body?.phone);

    if (!firstName || !lastName || !companyName || !email || !phone) {
      return NextResponse.json(
        { message: "firstName, lastName, companyName, email and phone are required" },
        { status: 400 },
      );
    }

    let merchantId = "";
    for (let i = 0; i < 5; i += 1) {
      const candidate = generateMerchantId();
      const exists = await prisma.merchant.findUnique({ where: { merchantId: candidate } });
      if (!exists) {
        merchantId = candidate;
        break;
      }
    }

    if (!merchantId) {
      return NextResponse.json({ message: "Unable to generate unique merchantId" }, { status: 500 });
    }

    const merchant = await prisma.merchant.create({
      data: {
        merchantId,
        apiKey: `pv_pk_${randomPart(20)}`,
        apiSecret: `pv_sk_${randomPart(32)}`,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email,
        phone,
        callbackUrl: sanitize(body?.callbackUrl),
        aadhaar: sanitize(body?.aadhaar),
        pan: sanitize(body?.pan),
        pincode: sanitize(body?.pincode),
        city: sanitize(body?.city),
        state: sanitize(body?.state),
        personalAddress: sanitize(body?.personalAddress),
        companyName,
        gstNumber: sanitize(body?.gstNumber),
        companyType: sanitize(body?.companyType),
        companyWebsite: sanitize(body?.companyWebsite),
        officeAddress: sanitize(body?.officeAddress),
        status: "PENDING",
        payoutMode: "MANUAL",
      },
    });

    return NextResponse.json(
      {
        success: true,
        merchant: {
          merchantId: merchant.merchantId,
          status: merchant.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to submit merchant registration" },
      { status: 500 },
    );
  }
};

export const POST = withApiLogging("merchants/self-registration:POST", postHandler);
