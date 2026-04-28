import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies, hashPassword, sanitizeEmail } from "@/lib/auth";
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

function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeStatus(v) {
  const status = sanitize(v).toUpperCase();
  if (status === "ACTIVE" || status === "INACTIVE" || status === "PENDING") return status;
  return "ACTIVE";
}

function generateMerchantId() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  return `PV-MCH-${stamp}-${randomPart(6)}`;
}

const getHandler = async () => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const where = sessionUser.role === "ADMIN" ? {} : { merchantId: sessionUser.merchantId || "__none__" };
    const merchants = await prisma.merchant.findMany({ where, orderBy: { createdAt: "desc" } });

    return NextResponse.json({ success: true, merchants });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to fetch merchants from database" },
      { status: 500 },
    );
  }
};

const postHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "admin access required" }, { status: 403 });
    }

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

    const loginEmail = sanitizeEmail(email);
    const existingUser = await prisma.user.findUnique({ where: { email: loginEmail } });
    if (existingUser) {
      return NextResponse.json({ message: "merchant email already used as login" }, { status: 409 });
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

    const clientPassword = randomPassword(10);
    const clientPasswordHash = await hashPassword(clientPassword);

    const merchant = await prisma.$transaction(async (tx) => {
      const created = await tx.merchant.create({
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
          status: "ACTIVE",
        },
      });

      await tx.user.create({
        data: {
          email: loginEmail,
          passwordHash: clientPasswordHash,
          role: "CLIENT",
          merchantId: created.merchantId,
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        merchant,
        clientCredentials: {
          email: loginEmail,
          password: clientPassword,
          role: "CLIENT",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to create merchant in database" },
      { status: 500 },
    );
  }
};

const putHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return NextResponse.json({ message: "admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const merchantId = sanitize(body?.merchantId);

    if (!merchantId) {
      return NextResponse.json({ message: "merchantId is required" }, { status: 400 });
    }

    const existing = await prisma.merchant.findUnique({ where: { merchantId } });
    if (!existing) {
      return NextResponse.json({ message: "merchant not found" }, { status: 404 });
    }

    const nextFirstName = sanitize(body?.firstName) || existing.firstName;
    const nextLastName = sanitize(body?.lastName) || existing.lastName;
    const nextCompanyName = sanitize(body?.companyName) || existing.companyName;
    const nextEmail = sanitize(body?.email) || existing.email;
    const nextPhone = sanitize(body?.phone) || existing.phone;

    if (!nextFirstName || !nextLastName || !nextCompanyName || !nextEmail || !nextPhone) {
      return NextResponse.json(
        { message: "firstName, lastName, companyName, email and phone are required" },
        { status: 400 },
      );
    }

    const updatedMerchant = await prisma.merchant.update({
      where: { merchantId },
      data: {
        firstName: nextFirstName,
        lastName: nextLastName,
        name: `${nextFirstName} ${nextLastName}`.trim(),
        companyName: nextCompanyName,
        email: nextEmail,
        phone: nextPhone,
        callbackUrl: body?.callbackUrl !== undefined ? sanitize(body?.callbackUrl) : undefined,
        aadhaar: body?.aadhaar !== undefined ? sanitize(body?.aadhaar) : undefined,
        pan: body?.pan !== undefined ? sanitize(body?.pan) : undefined,
        pincode: body?.pincode !== undefined ? sanitize(body?.pincode) : undefined,
        city: body?.city !== undefined ? sanitize(body?.city) : undefined,
        state: body?.state !== undefined ? sanitize(body?.state) : undefined,
        personalAddress: body?.personalAddress !== undefined ? sanitize(body?.personalAddress) : undefined,
        gstNumber: body?.gstNumber !== undefined ? sanitize(body?.gstNumber) : undefined,
        companyType: body?.companyType !== undefined ? sanitize(body?.companyType) : undefined,
        companyWebsite: body?.companyWebsite !== undefined ? sanitize(body?.companyWebsite) : undefined,
        officeAddress: body?.officeAddress !== undefined ? sanitize(body?.officeAddress) : undefined,
        status: body?.status !== undefined ? normalizeStatus(body?.status) : undefined,
      },
    });

    return NextResponse.json({ success: true, merchant: updatedMerchant });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to update merchant in database" },
      { status: 500 },
    );
  }
};

export const GET = withApiLogging("merchants:GET", getHandler);
export const POST = withApiLogging("merchants:POST", postHandler);
export const PUT = withApiLogging("merchants:PUT", putHandler);
