const { handleCtextSearchRequest } = require("../../server/ctextSearchMiddleware");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

exports.handler = async function handler(event) {
  if ((event.httpMethod || "").toUpperCase() === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  const requestPath = event.path || "/.netlify/functions/ctext-search";
  const qs = event.rawQuery || "";
  const requestUrl = qs ? `${requestPath}?${qs}` : requestPath;

  const { statusCode, payload } = await handleCtextSearchRequest({
    method: event.httpMethod,
    url: requestUrl,
    baseUrl: "https://netlify.local",
    requestPathPrefix: "/.netlify/functions/ctext-search"
  });

  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  };
};
