const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "passwordhash",
  "secret",
  "secretkey",
  "apisecret",
  "token",
  "accesstoken",
]);

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key || "").toLowerCase());
}

function maskValue(value) {
  const text = String(value || "");
  if (!text) return text;
  if (text.length <= 8) return "***";
  return `${text.slice(0, 4)}***${text.slice(-4)}`;
}

function redact(value, keyHint = "") {
  if (value === null || value === undefined) return value;

  if (isSensitiveKey(keyHint)) {
    return maskValue(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, keyHint));
  }

  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redact(v, k);
    }
    return out;
  }

  return value;
}

function headersToObject(headers) {
  const out = {};
  for (const [k, v] of headers.entries()) {
    out[k] = isSensitiveKey(k) ? maskValue(v) : v;
  }
  return out;
}

function clampText(text, max = 2000) {
  const raw = String(text || "");
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}...<trimmed:${raw.length - max}>`;
}

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function parseRequestBody(req) {
  try {
    const cloned = req.clone();
    const contentType = cloned.headers.get("content-type") || "";
    const text = await cloned.text();
    if (!text) return null;
    if (contentType.toLowerCase().includes("application/json")) {
      return redact(JSON.parse(text));
    }
    return clampText(text);
  } catch {
    return "[unavailable]";
  }
}

async function parseResponseBody(res) {
  try {
    const cloned = res.clone();
    const contentType = cloned.headers.get("content-type") || "";
    const text = await cloned.text();
    if (!text) return null;
    if (contentType.toLowerCase().includes("application/json")) {
      return redact(JSON.parse(text));
    }
    return clampText(text);
  } catch {
    return "[unavailable]";
  }
}

export function withApiLogging(name, handler) {
  return async function wrappedHandler(req, ctx) {
    const startedAt = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = req?.url ? new URL(req.url) : null;

    const requestMeta = {
      id: requestId,
      name,
      method: req?.method || "UNKNOWN",
      path: url?.pathname || "",
      query: url ? Object.fromEntries(url.searchParams.entries()) : {},
      headers: req?.headers ? headersToObject(req.headers) : {},
      body: req ? await parseRequestBody(req) : null,
    };

    console.log(
      [
        "",
        "================ API REQUEST ================",
        pretty(requestMeta),
        "=============================================",
      ].join("\n"),
    );

    try {
      const response = await handler(req, ctx);
      const durationMs = Date.now() - startedAt;

      const responseMeta = {
        id: requestId,
        name,
        status: response?.status ?? 200,
        durationMs,
        headers: response?.headers ? headersToObject(response.headers) : {},
        body: response ? await parseResponseBody(response) : null,
      };

      console.log(
        [
          "",
          "=============== API RESPONSE ================",
          pretty(responseMeta),
          "=============================================",
        ].join("\n"),
      );
      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      console.error([
        "",
        "================= API ERROR =================",
        pretty({
          id: requestId,
          name,
          durationMs,
          message: error?.message || "unknown error",
        }),
        "=============================================",
      ].join("\n"));
      throw error;
    }
  };
}
