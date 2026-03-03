// Minimal CText proxy for static-site frontend usage.
// Deploy as a Cloudflare Worker and use:
//   ?ctextSource=json&ctextProxy=https://<your-worker-domain>
//
// Endpoint:
//   GET /searchtexts?if=gb&searchTerms=<term>&json=1

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname !== "/searchtexts") {
      return json({ error: "Not found" }, 404);
    }

    const upstream = new URL("https://api.ctext.org/");
    upstream.searchParams.set("func", "searchtexts");
    upstream.searchParams.set("if", url.searchParams.get("if") || "gb");
    upstream.searchParams.set("searchTerms", url.searchParams.get("searchTerms") || "");
    upstream.searchParams.set("json", "1");

    try {
      const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        cf: {
          cacheTtl: 300,
          cacheEverything: true
        }
      });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    } catch (err) {
      return json({ error: String(err?.message || "upstream fetch failed") }, 502);
    }
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
