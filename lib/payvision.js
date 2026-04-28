export function getOpenMoneyConfig() {
  const baseUrl = process.env.PAYVISION_OPENMONEY_BASE_URL || "";
  const mid = process.env.PAYVISION_OPENMONEY_MID || "";
  const email = process.env.PAYVISION_OPENMONEY_EMAIL || "";
  const secretKey = process.env.PAYVISION_OPENMONEY_SECRET_KEY || "";

  if (!baseUrl || !mid || !email || !secretKey) {
    throw new Error("Missing PayVision provider config");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), mid, email, secretKey };
}

export function getProviderBalanceUrl() {
  const config = getOpenMoneyConfig();
  return (
    process.env.PAYVISION_BALANCE_CHECK_URL ||
    `${config.baseUrl}/api/check/balance?mid=${encodeURIComponent(config.mid)}&Emailid=${encodeURIComponent(config.email)}`
  );
}

export async function getProviderBalance({ revalidateSeconds = 60 } = {}) {
  const response = await fetch(getProviderBalanceUrl(), {
    method: "GET",
    headers: { accept: "*/*" },
    next: { revalidate: revalidateSeconds },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  const payoutTotal = Number(data?.payoutTotal);
  const payinTotal = Number(data?.payinTotal);

  return {
    ok: response.ok,
    status: response.status,
    data,
    payoutTotal: Number.isFinite(payoutTotal) ? payoutTotal : 0,
    payinTotal: Number.isFinite(payinTotal) ? payinTotal : 0,
  };
}

export async function createProviderToken() {
  const config = getOpenMoneyConfig();
  const res = await fetch(`${config.baseUrl}/api/Auth/generate-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "*/*" },
    body: JSON.stringify({ mid: config.mid, email: config.email, secretkey: config.secretKey }),
    cache: "no-store",
  });

  const data = await res.json();
  const token = data?.token || data?.accessToken || data?.access_token || "";
  if (!res.ok || !token) throw new Error(data?.message || "Token generation failed");
  return token;
}

export function getProviderStatusCheckUrl() {
  const config = getOpenMoneyConfig();
  return process.env.PAYVISION_STATUS_CHECK_URL || `${config.baseUrl}/api/payout/v1/status-check`;
}

export async function checkProviderStatus({ RefId, Service_Id = "1" }) {
  const refId = String(RefId || "").trim();
  const serviceId = String(Service_Id || "1").trim();

  if (!refId) {
    throw new Error("RefId is required");
  }
  const response = await fetch(getProviderStatusCheckUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ RefId: refId, Service_Id: serviceId }),
    cache: "no-store",
  });
  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {
      message: "Non-JSON response from provider",
      raw: rawText,
    };
  }

  return { ok: response.ok, status: response.status, data };
}

export function getProviderPayoutPayOrderUrl() {
  const config = getOpenMoneyConfig();
  return process.env.PAYVISION_PAYOUT_PAY_ORDER_URL || `${config.baseUrl}/api/OrderPayment/pay-order`;
}

export async function createProviderPayoutOrder(payload) {
  const token = await createProviderToken();
  const response = await fetch(getProviderPayoutPayOrderUrl(), {
    method: "POST",
    headers: {
      accept: "*/*",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload || {}),
    cache: "no-store",
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json",
    text,
    data,
  };
}
