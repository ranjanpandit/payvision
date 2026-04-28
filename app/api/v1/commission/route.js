import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { withApiLogging } from "@/lib/api-logger";

export const runtime = "nodejs";

function hasCommissionDelegate(client) {
  return Boolean(
    client &&
      client.merchantCommissionSetting &&
      typeof client.merchantCommissionSetting.create === "function" &&
      typeof client.merchantCommissionSetting.findMany === "function" &&
      typeof client.merchantCommissionSetting.count === "function" &&
      typeof client.merchantCommissionSetting.findUnique === "function" &&
      typeof client.merchantCommissionSetting.update === "function" &&
      typeof client.merchantCommissionSetting.delete === "function",
  );
}

function createFreshPrismaClient() {
  const normalizedDatasourceUrl = String(process.env.DATABASE_URL || "").replace(/^"(.*)"$/, "$1");
  return new PrismaClient(normalizedDatasourceUrl ? { datasourceUrl: normalizedDatasourceUrl } : undefined);
}

function getCommissionPrisma() {
  if (hasCommissionDelegate(prisma)) return prisma;

  const globalForCommission = globalThis;
  if (hasCommissionDelegate(globalForCommission.__PAYVISION_COMMISSION_PRISMA__)) {
    return globalForCommission.__PAYVISION_COMMISSION_PRISMA__;
  }

  const fresh = createFreshPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForCommission.__PAYVISION_COMMISSION_PRISMA__ = fresh;
  }
  return fresh;
}

function normalizeType(value) {
  const raw = String(value || "").trim().toUpperCase();
  return raw === "PAYOUT" ? "PAYOUT" : "PAYIN";
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Number(n.toFixed(2));
}

async function requireAdmin() {
  const sessionUser = await getSessionUserFromCookies();
  if (!sessionUser) {
    return { ok: false, response: NextResponse.json({ message: "unauthorized" }, { status: 401 }) };
  }
  if (sessionUser.role !== "ADMIN") {
    return { ok: false, response: NextResponse.json({ message: "admin access required" }, { status: 403 }) };
  }
  return { ok: true, sessionUser };
}

const getHandler = async (req) => {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  try {
    const db = getCommissionPrisma();
    const url = new URL(req.url);
    const page = toPositiveInt(url.searchParams.get("page"), 1);
    const size = Math.min(toPositiveInt(url.searchParams.get("size"), 10), 100);
    const query = String(url.searchParams.get("q") || "").trim();
    const commissionType = normalizeType(url.searchParams.get("type"));

    const where = {
      commissionType,
      ...(query
        ? {
            OR: [
              { merchantId: { contains: query } },
              { provider: { contains: query } },
            ],
          }
        : {}),
    };

    const [total, rows] = await db.$transaction([
      db.merchantCommissionSetting.count({ where }),
      db.merchantCommissionSetting.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    const merchantIds = [...new Set(rows.map((row) => row.merchantId))];
    const merchants = merchantIds.length
      ? await db.merchant.findMany({
          where: { merchantId: { in: merchantIds } },
          select: {
            merchantId: true,
            companyName: true,
            email: true,
            phone: true,
          },
        })
      : [];
    const merchantMap = new Map(merchants.map((m) => [m.merchantId, m]));

    const records = rows.map((row) => {
      const merchant = merchantMap.get(row.merchantId);
      return {
        id: row.id,
        merchantId: row.merchantId,
        provider: row.provider,
        companyName: merchant?.companyName || "",
        emailId: merchant?.email || "",
        contactNumber: merchant?.phone || "",
        fromAmount: Number(row.fromAmount),
        toAmount: Number(row.toAmount),
        commission: Number(row.commission),
        gst: Number(row.gst),
        isSurcharge: Boolean(row.isSurcharge),
        commissionType: row.commissionType,
        createdAt: row.createdAt,
      };
    });

    return NextResponse.json({ success: true, page, size, total, records });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to fetch commission settings" },
      { status: 500 },
    );
  }
};

const postHandler = async (req) => {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  try {
    const db = getCommissionPrisma();
    const body = await req.json();
    const editingId = Number(body?.id || 0);
    const merchantId = String(body?.merchantId || "").trim();
    const provider = String(body?.provider || "OPENMONEY").trim().toUpperCase();
    const commissionType = normalizeType(body?.commissionType);
    const fromAmount = toMoney(body?.fromAmount);
    const toAmount = toMoney(body?.toAmount);
    const commission = toMoney(body?.commission);
    const gst = toMoney(body?.gst ?? 0);
    const isSurcharge = Boolean(body?.isSurcharge);

    if (!merchantId || !provider) {
      return NextResponse.json({ message: "merchantId and provider are required" }, { status: 400 });
    }
    if (!Number.isFinite(fromAmount) || !Number.isFinite(toAmount) || !Number.isFinite(commission) || !Number.isFinite(gst)) {
      return NextResponse.json({ message: "fromAmount, toAmount, commission and gst must be valid numbers" }, { status: 400 });
    }
    if (fromAmount < 0 || toAmount < 0 || commission < 0 || gst < 0) {
      return NextResponse.json({ message: "amount values cannot be negative" }, { status: 400 });
    }
    if (toAmount < fromAmount) {
      return NextResponse.json({ message: "toAmount must be greater than or equal to fromAmount" }, { status: 400 });
    }

    const merchant = await db.merchant.findUnique({
      where: { merchantId },
      select: { merchantId: true },
    });
    if (!merchant) {
      return NextResponse.json({ message: "merchant not found" }, { status: 404 });
    }

    if (editingId) {
      const existing = await db.merchantCommissionSetting.findUnique({ where: { id: editingId } });
      if (!existing) {
        return NextResponse.json({ message: "commission setting not found" }, { status: 404 });
      }
      const updated = await db.merchantCommissionSetting.update({
        where: { id: editingId },
        data: {
          merchantId,
          provider,
          commissionType,
          fromAmount,
          toAmount,
          commission,
          gst,
          isSurcharge,
        },
      });
      return NextResponse.json({ success: true, record: updated, mode: "updated" });
    }

    const created = await db.merchantCommissionSetting.create({
      data: {
        merchantId,
        provider,
        commissionType,
        fromAmount,
        toAmount,
        commission,
        gst,
        isSurcharge,
      },
    });
    return NextResponse.json({ success: true, record: created, mode: "created" }, { status: 201 });
  } catch (error) {
    if (String(error?.code || "") === "P2002") {
      return NextResponse.json(
        { message: "Same commission range already exists for this merchant/provider/type" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: error?.message || "Failed to save commission setting" },
      { status: 500 },
    );
  }
};

const deleteHandler = async (req) => {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  try {
    const db = getCommissionPrisma();
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id") || 0);
    if (!id) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }
    await db.merchantCommissionSetting.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error?.message || "Failed to delete commission setting" },
      { status: 500 },
    );
  }
};

export const GET = withApiLogging("commission:GET", getHandler);
export const POST = withApiLogging("commission:POST", postHandler);
export const DELETE = withApiLogging("commission:DELETE", deleteHandler);
