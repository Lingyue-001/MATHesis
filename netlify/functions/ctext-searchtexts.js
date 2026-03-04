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

  const upstreamCandidates = [];
  const upstreamPath = new URL("https://api.ctext.org/searchtexts");
  upstreamPath.searchParams.set("if", ifParam);
  upstreamPath.searchParams.set("searchTerms", searchTerms);
  upstreamPath.searchParams.set("json", "1");
  upstreamCandidates.push(upstreamPath.toString());

  const upstreamFunc = new URL("https://api.ctext.org/");
  upstreamFunc.searchParams.set("func", "searchtexts");
  upstreamFunc.searchParams.set("if", ifParam);
  upstreamFunc.searchParams.set("searchTerms", searchTerms);
  upstreamFunc.searchParams.set("json", "1");
  upstreamCandidates.push(upstreamFunc.toString());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    let lastErr = null;
    for (let i = 0; i < upstreamCandidates.length; i += 1) {
      const target = upstreamCandidates[i];
      try {
        const res = await fetch(target, {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: controller.signal
        });
        const text = await res.text();
        const trimmed = String(text || "").trim();
        const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!looksJson) throw new Error("upstream did not return JSON");

        clearTimeout(timer);
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300"
          },
          body: trimmed
        };
      } catch (err) {
        lastErr = new Error(`${target} -> ${err?.message || "request failed"}`);
      }
    }
    clearTimeout(timer);
    return json(502, { error: `Upstream request failed: ${lastErr?.message || "unknown error"}` }, corsHeaders);
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
