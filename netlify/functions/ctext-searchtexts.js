// Netlify Function: CText searchtexts proxy
// Endpoint: /.netlify/functions/ctext-searchtexts?searchTerms=<term>&if=gb&json=1

exports.handler = async function handler(event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" }, corsHeaders);
  }

  const qs = event.queryStringParameters || {};
  const searchTerms = String(qs.searchTerms || "").trim();
  const ifParam = String(qs.if || "gb").trim() || "gb";

  if (!searchTerms) {
    return json(400, { error: "Missing required query parameter: searchTerms" }, corsHeaders);
  }

  const upstream = new URL("https://api.ctext.org/");
  upstream.searchParams.set("func", "searchtexts");
  upstream.searchParams.set("if", ifParam);
  upstream.searchParams.set("searchTerms", searchTerms);
  upstream.searchParams.set("json", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(upstream.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    clearTimeout(timer);

    const text = await res.text();
    return {
      statusCode: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      },
      body: text
    };
  } catch (err) {
    clearTimeout(timer);
    return json(502, { error: `Upstream request failed: ${err?.message || "unknown error"}` }, corsHeaders);
  }
};

function json(statusCode, payload, baseHeaders) {
  return {
    statusCode,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(payload)
  };
}
