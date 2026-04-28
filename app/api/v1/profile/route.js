import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

const defaultProfile = {
  firstName: "",
  lastName: "",
  dob: "",
  mobile: "",
  email: "",
  state: "",
  city: "",
  pinCode: "",
  address: "",
  landmark: "",
  aadhaar: "",
  pan: "",
  profilePhotoUrl: "",
};

async function getOrCreateProfile(sessionUser) {
  const existing = await prisma.profile.findFirst({
    where: { userId: sessionUser.id },
  });
  if (existing) return existing;

  let seed = { ...defaultProfile, email: sessionUser.email || "" };

  if (sessionUser.role === "CLIENT" && sessionUser.merchantId) {
    const merchant = await prisma.merchant.findUnique({
      where: { merchantId: sessionUser.merchantId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        state: true,
        city: true,
        pincode: true,
        personalAddress: true,
        aadhaar: true,
        pan: true,
      },
    });

    if (merchant) {
      seed = {
        ...seed,
        firstName: merchant.firstName || "",
        lastName: merchant.lastName || "",
        email: merchant.email || seed.email,
        mobile: merchant.phone || "",
        state: merchant.state || "",
        city: merchant.city || "",
        pinCode: merchant.pincode || "",
        address: merchant.personalAddress || "",
        aadhaar: merchant.aadhaar || "",
        pan: merchant.pan || "",
      };
    }
  }

  return prisma.profile.create({
    data: {
      ...seed,
      userId: sessionUser.id,
    },
  });
}

const getHandler = async () => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const profile = await getOrCreateProfile(sessionUser);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to fetch profile from database" },
      { status: 500 },
    );
  }
};

const putHandler = async (req) => {
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (!sessionUser) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const current = await getOrCreateProfile(sessionUser);
    const body = await req.json();
    const next = {
      ...defaultProfile,
      ...current,
      firstName: String(body?.firstName || "").trim(),
      lastName: String(body?.lastName || "").trim(),
      dob: String(body?.dob || "").trim(),
      mobile: String(body?.mobile || "").trim(),
      email: String(body?.email || "").trim(),
      state: String(body?.state || "").trim(),
      city: String(body?.city || "").trim(),
      pinCode: String(body?.pinCode || "").trim(),
      address: String(body?.address || "").trim(),
      landmark: String(body?.landmark || "").trim(),
      aadhaar: String(body?.aadhaar || "").trim(),
      pan: String(body?.pan || "").trim(),
      profilePhotoUrl: String(body?.profilePhotoUrl || "").trim(),
    };

    const profile = await prisma.profile.update({
      where: { id: current.id },
      data: {
        firstName: next.firstName,
        lastName: next.lastName,
        dob: next.dob,
        mobile: next.mobile,
        email: next.email,
        state: next.state,
        city: next.city,
        pinCode: next.pinCode,
        address: next.address,
        landmark: next.landmark,
        aadhaar: next.aadhaar,
        pan: next.pan,
        profilePhotoUrl: next.profilePhotoUrl,
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Invalid profile payload" },
      { status: 400 },
    );
  }
};

export const GET = withApiLogging("profile:GET", getHandler);
export const PUT = withApiLogging("profile:PUT", putHandler);
