"use strict";

// Netlify Functions run in serverless where browser automation is not expected.
if (!process.env.CTEXT_FETCH_MODE) {
  process.env.CTEXT_FETCH_MODE = "http";
}
if (!process.env.CTEXT_MAX_VARIANT_ATTEMPTS) {
  process.env.CTEXT_MAX_VARIANT_ATTEMPTS = "1";
}
if (!process.env.CTEXT_MAX_VARIANTS) {
  process.env.CTEXT_MAX_VARIANTS = "6";
}
if (!process.env.CTEXT_REQUEST_GAP_MS) {
  process.env.CTEXT_REQUEST_GAP_MS = "0";
}
if (!process.env.CTEXT_GLOBAL_GAP_MS) {
  process.env.CTEXT_GLOBAL_GAP_MS = "0";
}
if (!process.env.CTEXT_REQUEST_TIMEOUT_MS) {
  process.env.CTEXT_REQUEST_TIMEOUT_MS = "8000";
}
if (!process.env.CTEXT_SKIP_STATS) {
  process.env.CTEXT_SKIP_STATS = "1";
}
if (!process.env.CTEXT_INCLUDE_SINGLE_CHAR_VARIANTS) {
  process.env.CTEXT_INCLUDE_SINGLE_CHAR_VARIANTS = "0";
}

const { createCtextSearchMiddleware } = require("../../server/ctextSearchMiddleware");

const middleware = createCtextSearchMiddleware();

function normalizeHeaders(headers = {}) {
  const out = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (typeof key !== "string") return;
    if (typeof value === "undefined") return;
    out[key] = String(value);
  });
  return out;
}

exports.handler = async function handler(event) {
  try {
    const method = String(event?.httpMethod || "GET").toUpperCase();
    const rawQuery = String(event?.rawQuery || "");
    const queryFromMap = event?.queryStringParameters
      ? new URLSearchParams(event.queryStringParameters).toString()
      : "";
    const query = rawQuery || queryFromMap;
    const req = {
      method,
      url: `/api/ctext/search${query ? `?${query}` : ""}`
    };

    let statusCode = 200;
    let headers = {};
    let body = "";

    const res = {
      writeHead(code, nextHeaders) {
        statusCode = Number(code) || 200;
        headers = normalizeHeaders(nextHeaders || {});
      },
      end(chunk) {
        body = typeof chunk === "string" ? chunk : (chunk ? String(chunk) : "");
      }
    };

    await middleware(req, res, () => {});

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...headers
      },
      body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: err?.message || "Unhandled function error",
        source: "netlify-ctext-search"
      })
    };
  }
};
