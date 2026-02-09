const https = require("https");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const C_TEXT_RESULT_ENDPOINT = "https://ctext.org/mathematics/zh?if=gb&searchu=";
const REQUEST_GAP_MS = 120;
const MAX_VARIANTS = 12;
const MAX_REDIRECTS = 5;
const MAX_VARIANT_ATTEMPTS = 2;
const STOP_CHARS = new Set([
  "之", "其", "而", "以", "于", "於", "也", "者", "焉", "乎", "矣",
  "曰", "云", "所", "不", "無", "无", "有", "為", "为", "與", "与"
]);

let simpToTradMap = {};
let tradToSimpMap = {};
try {
  const mapPath = path.resolve(process.cwd(), "simp_to_trad_map.json");
  const raw = fs.readFileSync(mapPath, "utf8");
  simpToTradMap = JSON.parse(raw);
  tradToSimpMap = Object.fromEntries(
    Object.entries(simpToTradMap).map(([simp, trad]) => [trad, simp])
  );
} catch {
  simpToTradMap = {};
  tradToSimpMap = {};
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toSimp(input) {
  return Array.from(input || "").map(ch => tradToSimpMap[ch] || ch).join("");
}

function toTrad(input) {
  return Array.from(input || "").map(ch => simpToTradMap[ch] || ch).join("");
}

function buildQueryCandidates(variant) {
  const base = (variant || "").trim();
  if (!base) return [];
  const simp = toSimp(base);
  const trad = toTrad(base);
  return Array.from(new Set([base, simp, trad].filter(Boolean)));
}

function decodeHtmlEntities(input) {
  if (!input) return "";
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripHtml(html) {
  if (!html) return "";
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(p|div|li|tr|h\d|section)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

function decodeBody(buffer, encoding = "") {
  if (!buffer || buffer.length === 0) return "";
  const enc = String(encoding || "").toLowerCase();
  if (enc.includes("gzip")) return zlib.gunzipSync(buffer).toString("utf8");
  if (enc.includes("deflate")) return zlib.inflateSync(buffer).toString("utf8");
  if (enc.includes("br")) return zlib.brotliDecompressSync(buffer).toString("utf8");
  return buffer.toString("utf8");
}

function fetchText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "MATHesis-Codex-Prototype/1.0",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Referer": "https://ctext.org/mathematics/zh?if=gb"
        },
        timeout: 15000
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        const location = res.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location) {
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error(`Too many redirects for ${url}`));
            res.resume();
            return;
          }
          const nextUrl = new URL(location, url).toString();
          res.resume();
          fetchText(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", chunk => { chunks.push(chunk); });
        res.on("end", () => {
          try {
            const compressed = Buffer.concat(chunks);
            const body = decodeBody(compressed, res.headers["content-encoding"]);
            resolve({
              url,
              finalUrl: url,
              statusCode,
              body
            });
          } catch (err) {
            reject(new Error(`Decode failed for ${url}: ${err.message}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${url}`)));
    req.end();
  });
}

function buildVariants(term) {
  const base = (term || "").trim();
  if (!base) return [];
  const variants = new Set([base]);
  const chars = Array.from(base);

  if (chars.length >= 2) {
    for (let i = 0; i < chars.length - 1; i += 1) {
      const bi = chars.slice(i, i + 2).join("");
      if (bi.length > 1) variants.add(bi);
    }
  }

  for (const ch of chars) {
    if (STOP_CHARS.has(ch)) continue;
    if (/\s/.test(ch)) continue;
    variants.add(ch);
  }

  const sorted = Array.from(variants)
    .filter(v => v.length > 0)
    .sort((a, b) => b.length - a.length);

  return sorted.slice(0, MAX_VARIANTS);
}

function extractLines(text) {
  return text.split("\n").map(s => s.trim()).filter(Boolean);
}

function stripTrailingPunctuation(input) {
  return String(input || "").replace(/[\s·,，.。;；:：]+$/g, "").trim();
}

function parseLinks(html) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1] || m[2] || m[3] || "";
    const label = stripHtml(m[4] || "").trim();
    if (!label) continue;
    const absolute = href.startsWith("http")
      ? href
      : `https://ctext.org${href.startsWith("/") ? href : `/${href}`}`;
    const key = `${label}|${absolute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, url: absolute });
  }
  return out;
}

function parseStructured(rawHtml, variant, searchUrl) {
  const text = stripHtml(rawHtml);
  const lines = extractLines(text);
  const compactText = text.replace(/\s+/g, " ").trim();

  const scopeLine = lines.find(l => /(?:檢索範圍|搜索範圍|搜尋範圍|检索范围|搜索范围)\s*[:：]/.test(l))
    || ((text.match(/(?:檢索範圍|搜索範圍|搜尋範圍|检索范围|搜索范围)\s*[:：][^\n]+/) || [])[0] || "");
  const scopeMatch = scopeLine.match(
    /(?:檢索範圍|搜索範圍|搜尋範圍|检索范围|搜索范围)\s*[:：]\s*(.+?)(?=\s*(?:檢索類型|搜索類型|搜尋類型|检索类型|搜索类型)\s*[:：]|$)/
  );
  const typeMatch =
    scopeLine.match(/(?:檢索類型|搜索類型|搜尋類型|检索类型|搜索类型)\s*[:：]\s*([^\n。；;]+)/)
    || text.match(/(?:檢索類型|搜索類型|搜尋類型|检索类型|搜索类型)\s*[:：]\s*([^\n。；;]+)/);
  const scope = stripTrailingPunctuation(scopeMatch ? scopeMatch[1].trim() : "");
  const searchType = stripTrailingPunctuation(typeMatch ? typeMatch[1].trim() : "");

  const conditionLine = lines.find(l => /(條件\d+|条件\d+).*(包含|包括|包含字詞|包含字词)/.test(l))
    || lines.find(l => /(條件\d+|条件\d+)/.test(l))
    || ((text.match(/(?:條件\s*\d+|条件\s*\d+)\s*[:：]?[^\n]+/) || [])[0] || "")
    || "";
  const conditionMatch = conditionLine.match(
    /(?:條件\s*\d+|条件\s*\d+)\s*[:：]?\s*(.+?)(?=\s*(?:符合次數|符合次数)\s*[:：]|$)/
  );
  const condition = stripTrailingPunctuation(conditionMatch ? conditionMatch[1].trim() : "");

  const countMatch =
    conditionLine.match(/(?:符合次數|符合次数)\s*[:：]\s*(\d+)/)
    || text.match(/(?:符合次數|符合次数)\s*[:：]\s*(\d+)/);
  const hitCount = countMatch ? Number(countMatch[1]) : null;

  // Fallback parse pass over compact text to reduce line-break sensitivity.
  const compactScopeMatch = compactText.match(
    /(?:檢索範圍|搜索範圍|搜尋範圍|检索范围|搜索范围)\s*[:：]\s*(.+?)(?=\s*(?:檢索類型|搜索類型|搜尋類型|检索类型|搜索类型)\s*[:：]|$)/
  );
  const compactTypeMatch = compactText.match(
    /(?:檢索類型|搜索類型|搜尋類型|检索类型|搜索类型)\s*[:：]\s*([^\n。；;]+)/);
  const compactConditionMatch = compactText.match(
    /(?:條件\s*\d+|条件\s*\d+)\s*[:：]?\s*(.+?)(?=\s*(?:符合次數|符合次数)\s*[:：]|$)/
  );
  const compactCountMatch = compactText.match(/(?:符合次數|符合次数)\s*[:：]\s*(\d+)/);

  const finalScope = scope || stripTrailingPunctuation(compactScopeMatch ? compactScopeMatch[1].trim() : "");
  const finalSearchType = searchType || stripTrailingPunctuation(compactTypeMatch ? compactTypeMatch[1].trim() : "");
  const finalCondition = condition || stripTrailingPunctuation(compactConditionMatch ? compactConditionMatch[1].trim() : "");
  const finalHitCount = typeof hitCount === "number"
    ? hitCount
    : (compactCountMatch ? Number(compactCountMatch[1]) : null);

  const rawRangeLine = lines.find(l => /共\s*\d+\s*段落.*共\s*\d+\s*頁|共\s*\d+\s*段落.*共\s*\d+\s*页/.test(l))
    || lines.find(l => /共\s*\d+\s*段落/.test(l))
    || "";
  const rangeTail = rawRangeLine.includes("：")
    ? rawRangeLine.split("：").slice(1).join("：").trim()
    : (rawRangeLine.includes(":") ? rawRangeLine.split(":").slice(1).join(":").trim() : rawRangeLine);
  const rangeLine = (rangeTail.split(/[。.;；]/)[0] || "").trim();

  const allLinks = parseLinks(rawHtml);
  const titleLinks = allLinks.filter(x => /^《[^》]+》$/.test(x.label));
  const corpusLink = titleLinks.find(x => /《.*算[書书术學学].*》/.test(x.label)) || null;
  const corpusIndex = corpusLink ? titleLinks.findIndex(x => x.url === corpusLink.url) : -1;
  const ordered = corpusIndex >= 0 ? titleLinks.slice(corpusIndex + 1) : titleLinks;
  const textLink = ordered.find(x => !/《卷/.test(x.label)) || null;
  const chapterLink = ordered.find(x => /《卷/.test(x.label)) || null;

  const debug = {
    rawLength: rawHtml.length,
    scopeLine,
    conditionLine,
    firstLines: lines.slice(0, 16),
    extracted: {
      scope: finalScope,
      searchType: finalSearchType,
      condition: finalCondition,
      hitCount: finalHitCount
    },
    markers: {
      hasSearchContent: /(?:檢索內容|检索内容|搜尋內容|搜索内容)/.test(rawHtml) || /(?:檢索內容|检索内容|搜尋內容|搜索内容)/.test(compactText),
      hasScopeKeyword: /(?:檢索範圍|搜索範圍|搜尋範圍|检索范围|搜索范围)/.test(rawHtml) || /(?:檢索範圍|搜索範圍|搜尋範圍|检索范围|搜索范围)/.test(compactText),
      hasConditionKeyword: /(?:條件\s*\d+|条件\s*\d+)/.test(rawHtml) || /(?:條件\s*\d+|条件\s*\d+)/.test(compactText),
      hasHitCountKeyword: /(?:符合次數|符合次数)/.test(rawHtml) || /(?:符合次數|符合次数)/.test(compactText)
    }
  };

  return {
    variant,
    searchUrl,
    scope: finalScope,
    searchType: finalSearchType,
    condition: finalCondition,
    hitCount: finalHitCount,
    rangeLine,
    structured: {
      corpus: corpusLink,
      text: textLink,
      chapter: chapterLink
    },
    links: allLinks.slice(0, 40),
    debug
  };
}

function hasParsedResultSignals(parsed) {
  if (!parsed) return false;
  const hasStatsLine = Boolean(parsed?.debug?.scopeLine || parsed?.debug?.conditionLine);
  const hasCount = typeof parsed.hitCount === "number";
  const hasRange = Boolean(parsed.rangeLine);
  const hasCoreFields = Boolean(parsed.scope || parsed.condition || parsed.searchType);
  return hasStatsLine || hasCount || hasRange || hasCoreFields;
}

function classifyParseStatus(parsed) {
  if (!parsed) return "parse_empty";
  if (hasParsedResultSignals(parsed)) return "ok";
  const markers = parsed?.debug?.markers || {};
  if (markers.hasConditionKeyword || markers.hasHitCountKeyword || markers.hasScopeKeyword) {
    return "parser_miss_with_markers";
  }
  return "upstream_template_without_result_block";
}

async function fetchVariantWithRetries(variant) {
  const queryCandidates = buildQueryCandidates(variant);
  let lastParsed = null;
  let lastFinalUrl = `${C_TEXT_RESULT_ENDPOINT}${encodeURIComponent(variant)}`;
  let lastStatusCode = 200;
  let lastError = null;
  let globalAttempt = 0;

  for (const queryUsed of queryCandidates) {
    const searchUrl = `${C_TEXT_RESULT_ENDPOINT}${encodeURIComponent(queryUsed)}`;
    for (let localAttempt = 1; localAttempt <= MAX_VARIANT_ATTEMPTS; localAttempt += 1) {
      globalAttempt += 1;
      if (globalAttempt > 1) await delay(REQUEST_GAP_MS * Math.min(globalAttempt, 3));
      try {
        const fetched = await fetchText(searchUrl);
        const parsed = parseStructured(fetched.body, variant, searchUrl);
        const status = classifyParseStatus(parsed);
        const parseOk = hasParsedResultSignals(parsed);
        parsed.debug = {
          ...(parsed.debug || {}),
          attempt: globalAttempt,
          localAttempt,
          queryUsed,
          parseOk,
          parseStatus: parseOk
            ? (queryUsed === variant ? "ok" : "ok_via_query_normalization")
            : status
        };
        lastParsed = parsed;
        lastFinalUrl = fetched.finalUrl;
        lastStatusCode = fetched.statusCode;
        if (parseOk) {
          return {
            parsed,
            finalUrl: fetched.finalUrl,
            statusCode: fetched.statusCode,
            attempts: globalAttempt,
            queryUsed
          };
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  if (lastParsed) {
    lastParsed.debug = {
      ...(lastParsed.debug || {}),
      attempt: globalAttempt || MAX_VARIANT_ATTEMPTS,
      queryUsed: lastParsed.debug?.queryUsed || variant,
      triedQueries: queryCandidates,
      parseOk: false,
      parseStatus: "missing_result_header_after_retries"
    };
    return {
      parsed: lastParsed,
      finalUrl: lastFinalUrl,
      statusCode: lastStatusCode,
      attempts: globalAttempt || MAX_VARIANT_ATTEMPTS,
      queryUsed: lastParsed.debug?.queryUsed || variant
    };
  }

  throw (lastError || new Error(`Failed to fetch variant: ${variant}`));
}

async function searchAcrossVariants(query) {
  const variants = buildVariants(query);
  const searches = [];

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    if (i > 0) await delay(REQUEST_GAP_MS);
    try {
      const { parsed, finalUrl, statusCode, attempts, queryUsed } = await fetchVariantWithRetries(variant);

      searches.push({
        ...parsed,
        sourceEndpoint: attempts > 1 ? "mathematics-retry" : "mathematics",
        finalUrl,
        statusCode,
        attempts,
        queryUsed
      });
    } catch (err) {
      searches.push({
        variant,
        searchUrl: `${C_TEXT_RESULT_ENDPOINT}${encodeURIComponent(variant)}`,
        scope: "",
        condition: "",
        hitCount: null,
        rangeLine: "",
        structured: { corpus: null, text: null, chapter: null },
        links: [],
        attempts: MAX_VARIANT_ATTEMPTS,
        sourceEndpoint: "mathematics",
        queryUsed: variant,
        debug: {
          attempt: MAX_VARIANT_ATTEMPTS,
          queryUsed: variant,
          parseOk: false,
          parseStatus: "request_error"
        },
        error: err.message
      });
    }
  }

  return {
    query,
    endpoint: C_TEXT_RESULT_ENDPOINT,
    variants,
    variantsSearched: searches.length,
    generatedAt: new Date().toISOString(),
    searches
  };
}

function createCtextSearchMiddleware() {
  return async function ctextSearchMiddleware(req, res, next) {
    if (!req.url || !req.url.startsWith("/api/ctext/search")) {
      next();
      return;
    }
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const fullUrl = new URL(req.url, "http://localhost");
    const q = (fullUrl.searchParams.get("q") || "").trim();
    const debug = fullUrl.searchParams.get("debug") === "1";
    if (!q) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Missing query parameter q" }));
      return;
    }

    try {
      const payload = await searchAcrossVariants(q);
      const responsePayload = debug ? payload : {
        ...payload,
        searches: (payload.searches || []).map(({ debug: _dbg, ...rest }) => rest)
      };
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ...responsePayload, cached: false }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message || "Unknown ctext search error" }));
    }
  };
}

module.exports = {
  createCtextSearchMiddleware
};
