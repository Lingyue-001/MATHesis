"use strict";

require("../scripts/load-local-env.cjs");

const http = require("http");
const { createCtextSearchMiddleware } = require("./ctextSearchMiddleware");

const PORT_RAW = Number(process.env.PORT || 8787);
const PORT = Number.isFinite(PORT_RAW) && PORT_RAW > 0 ? PORT_RAW : 8787;
const HOST = process.env.HOST || "0.0.0.0";
const ALLOW_ORIGIN = process.env.CTEXT_PROXY_ALLOW_ORIGIN || "*";

const middleware = createCtextSearchMiddleware();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };
}

function writeJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = String(req.url || "");

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end("");
      return;
    }

    if (url === "/healthz") {
      writeJson(res, 200, {
        ok: true,
        mode: String(process.env.CTEXT_FETCH_MODE || "browser"),
        ts: new Date().toISOString()
      });
      return;
    }

    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = (statusCode, headers = {}) => {
      return originalWriteHead(statusCode, {
        ...headers,
        ...corsHeaders()
      });
    };

    await middleware(req, res, () => {
      if (!res.writableEnded) {
        writeJson(res, 404, { error: "Not found" });
      }
    });
  } catch (err) {
    if (res.writableEnded) return;
    writeJson(res, 500, { error: err?.message || "Unhandled proxy server error" });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[ctext-proxy] listening on http://${HOST}:${PORT}`);
});
