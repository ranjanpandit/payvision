import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

// Force local query engine mode so Prisma uses DATABASE_URL (mysql://...) instead of Data Proxy semantics.
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
delete process.env.PRISMA_GENERATE_NO_ENGINE;
delete process.env.PRISMA_GENERATE_DATAPROXY;
delete process.env.PRISMA_ACCELERATE_URL;
delete process.env.PRISMA_DATA_PROXY_URL;

function hasMerchantApiTokenDelegate(client) {
  return Boolean(client && client.merchantApiToken && typeof client.merchantApiToken.findFirst === "function");
}

function hasPayoutOrderDelegate(client) {
  return Boolean(
    client &&
      client.payoutOrder &&
      typeof client.payoutOrder.findUnique === "function" &&
      typeof client.payoutOrder.upsert === "function" &&
      typeof client.payoutOrder.updateMany === "function",
  );
}

function hasRequiredDelegates(client) {
  return (
    hasMerchantApiTokenDelegate(client) &&
    hasPayoutOrderDelegate(client) &&
    Boolean(client?.merchantWalletBalance) &&
    Boolean(client?.merchantCommissionSetting)
  );
}

const cachedClient = globalForPrisma.__PAYVISION_PRISMA__;
const normalizedDatasourceUrl = String(process.env.DATABASE_URL || "").replace(/^"(.*)"$/, "$1");
const prismaClient = hasRequiredDelegates(cachedClient)
  ? cachedClient
  : new PrismaClient(
      normalizedDatasourceUrl
        ? { datasourceUrl: normalizedDatasourceUrl }
        : undefined,
    );

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__PAYVISION_PRISMA__ = prisma;
}
