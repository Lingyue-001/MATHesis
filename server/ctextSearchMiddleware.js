const https = require("https");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const C_TEXT_RESULT_ENDPOINT = "https://ctext.org/mathematics/zh?if=gb&searchu=";
const REQUEST_GAP_MS = 120;
const MAX_VARIANTS = 12;
const MAX_REDIRECTS = 5;
const MAX_VARIANT_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_DIR = path.resolve(process.cwd(), "tmp", "ctext_cache");
const CACHE_SCHEMA_VERSION = 7;
const CACHE_TTL_MS_RAW = Number(process.env.CTEXT_CACHE_TTL_MS || 24 * 60 * 60 * 1000);
const CACHE_TTL_MS = Number.isFinite(CACHE_TTL_MS_RAW) && CACHE_TTL_MS_RAW > 0
  ? CACHE_TTL_MS_RAW
  : 6 * 60 * 60 * 1000;
const FETCH_MODE = String(process.env.CTEXT_FETCH_MODE || "browser").toLowerCase();
const CTEXT_SESSION_DIR = path.resolve(process.cwd(), "tmp", "ctext_session");
const GLOBAL_GAP_MS_RAW = Number(process.env.CTEXT_GLOBAL_GAP_MS || 1200);
const GLOBAL_GAP_MS = Number.isFinite(GLOBAL_GAP_MS_RAW) && GLOBAL_GAP_MS_RAW >= 0
  ? GLOBAL_GAP_MS_RAW
  : 1200;
const LOGIN_GATE_PATTERNS = [
  /請\s*<a[^>]+account\.pl[^>]*>\s*登入帳戶/i,
  /请\s*<a[^>]+account\.pl[^>]*>\s*登入账户/i,
  /嚴禁使用自動下載軟体/i,
  /严禁使用自动下载/i
];
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

let globalFetchQueue = Promise.resolve();
let lastGlobalFetchAt = 0;

function runWithGlobalThrottle(task) {
  const run = async () => {
    const elapsed = Date.now() - lastGlobalFetchAt;
    const waitMs = GLOBAL_GAP_MS - elapsed;
    if (waitMs > 0) await delay(waitMs);
    try {
      return await task();
    } finally {
      lastGlobalFetchAt = Date.now();
    }
  };
  const next = globalFetchQueue.then(run, run);
  globalFetchQueue = next.then(() => undefined, () => undefined);
  return next;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function hashKey(input) {
  return crypto.createHash("sha1").update(String(input || "")).digest("hex");
}

function readCache(cacheKey) {
  try {
    const file = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.schemaVersion !== CACHE_SCHEMA_VERSION) return null;
    if (typeof parsed.cachedAt !== "string") return null;
    const age = Date.now() - new Date(parsed.cachedAt).getTime();
    if (Number.isNaN(age) || age > CACHE_TTL_MS) return null;
    return parsed.payload || null;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, payload) {
  try {
    ensureDir(CACHE_DIR);
    const file = path.join(CACHE_DIR, `${cacheKey}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({
        schemaVersion: CACHE_SCHEMA_VERSION,
        cachedAt: new Date().toISOString(),
        payload
      }, null, 2),
      "utf8"
    );
  } catch {
    // cache write failure should never fail request path
  }
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

function isLoginGatedPage(rawHtml) {
  const html = String(rawHtml || "");
  return LOGIN_GATE_PATTERNS.some(re => re.test(html));
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
        timeout: REQUEST_TIMEOUT_MS
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

let playwrightContextPromise = null;

async function getPlaywrightContext() {
  if (playwrightContextPromise) return playwrightContextPromise;
  playwrightContextPromise = (async () => {
    let playwright;
    try {
      playwright = require("playwright");
    } catch {
      throw new Error("Playwright is not installed. Run: npm i -D playwright");
    }
    ensureDir(CTEXT_SESSION_DIR);
    const context = await playwright.chromium.launchPersistentContext(CTEXT_SESSION_DIR, {
      headless: true,
      viewport: { width: 1440, height: 900 },
      locale: "zh-CN",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });
    return context;
  })();
  return playwrightContextPromise;
}

async function fetchTextWithBrowser(url) {
  const context = await getPlaywrightContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: REQUEST_TIMEOUT_MS
    });
    await page.waitForTimeout(700);
    const body = await page.content();
    const finalUrl = page.url();
    const statusCode = response ? response.status() : 200;
    return { url, finalUrl, statusCode, body };
  } finally {
    await page.close();
  }
}

async function fetchTextByMode(url) {
  if (FETCH_MODE === "http") {
    return fetchText(url);
  }

  if (FETCH_MODE === "browser") {
    try {
      return await fetchTextWithBrowser(url);
    } catch (err) {
      // browser mode is preferred, but network path keeps API usable
      const fallback = await fetchText(url);
      return { ...fallback, fallbackFromBrowserError: err.message || "unknown browser fetch error" };
    }
  }

  return fetchText(url);
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

function stripTrailingPunctuation(input, options = {}) {
  const { keepQuotes = false } = options;
  const suffixPattern = keepQuotes
    ? /[\s·•,，.。;；:：!！?？]+$/g
    : /[\s·•,，.。;；:：!！?？"“”'‘’]+$/g;
  return String(input || "").replace(suffixPattern, "").trim();
}

function normalizeScopeValue(input) {
  const raw = stripTrailingPunctuation(input || "");
  if (!raw) return "";
  const cjk = raw.match(/[\u3400-\u9fff]+/u);
  if (cjk && cjk[0]) return cjk[0];
  return raw.split(/[\s·•,，.。;；:：!！?？()[\]{}"“”'‘’<>《》]/).filter(Boolean)[0] || raw;
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

function toAbsoluteCtextUrl(href) {
  if (!href) return "";
  const decodedHref = decodeHtmlEntities(String(href || "").trim());
  return decodedHref.startsWith("http")
    ? decodedHref
    : `https://ctext.org${decodedHref.startsWith("/") ? decodedHref : `/${decodedHref}`}`;
}

function normalizeBookLabel(input) {
  const raw = String(input || "").trim().replace(/^《\s*|\s*》$/g, "");
  return raw ? `《${raw}》` : "";
}

function parseStatsCountCell(cellHtml) {
  const cell = String(cellHtml || "");
  const linkMatch = cell.match(
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i
  );
  const linkedRaw = linkMatch ? stripHtml(linkMatch[4] || "") : "";
  const plainRaw = stripHtml(cell);
  const countText = (linkedRaw || plainRaw || "").trim();
  const count = /^\d+$/.test(countText) ? Number(countText) : null;
  const countHref = linkMatch ? (linkMatch[1] || linkMatch[2] || linkMatch[3] || "") : "";
  return {
    count,
    countUrl: countHref ? toAbsoluteCtextUrl(countHref) : ""
  };
}

function parseStatsTextGroups(rawHtml) {
  const html = String(rawHtml || "");
  const tableBlocks = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) || [];
  const statsTable = tableBlocks.find(block => {
    const txt = stripHtml(block || "").replace(/\s+/g, " ").trim();
    return /(?:範圍|范围)\s+[^\s]+/.test(txt);
  }) || "";

  if (!statsTable) return [];

  const rows = statsTable.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const groups = [];
  let currentGroup = null;
  const seenTextKeys = new Set();

  for (const row of rows) {
    const cells = row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 2) continue;
    const leftCell = cells[0];
    const rightCell = cells[1];

    const leftTextRaw = stripHtml(leftCell || "").replace(/\r?\n/g, " ");
    const leftTextTrimmed = leftTextRaw.trim();
    if (!leftTextTrimmed || /^(?:範圍|范围)$/.test(leftTextTrimmed)) continue;

    const leftLinkMatch = leftCell.match(
      /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i
    );
    const leftHref = leftLinkMatch ? (leftLinkMatch[1] || leftLinkMatch[2] || leftLinkMatch[3] || "") : "";
    const leftLabelRaw = leftLinkMatch ? stripHtml(leftLinkMatch[4] || "") : leftTextTrimmed;
    const label = normalizeBookLabel(leftLabelRaw);
    if (!label) continue;

    const { count, countUrl } = parseStatsCountCell(rightCell);
    const hasIndent = /^[\s　]/.test(leftTextRaw)
      || /(?:&nbsp;|&#160;|　)/.test(leftCell);

    if (!hasIndent) {
      const textUrl = leftHref ? toAbsoluteCtextUrl(leftHref) : "";
      const textKey = `${label}|${textUrl}`;
      if (seenTextKeys.has(textKey)) {
        currentGroup = groups.find(g => `${g.text.label}|${g.text.url}` === textKey) || null;
        continue;
      }
      currentGroup = {
        text: {
          label,
          url: textUrl,
          count,
          countUrl
        },
        chapters: []
      };
      groups.push(currentGroup);
      seenTextKeys.add(textKey);
      continue;
    }

    if (!currentGroup) continue;
    const chapterUrl = leftHref ? toAbsoluteCtextUrl(leftHref) : "";
    const chapterKey = `${label}|${chapterUrl}`;
    const exists = currentGroup.chapters.some(c => `${c.label}|${c.url}` === chapterKey);
    if (exists) continue;
    currentGroup.chapters.push({
      label,
      url: chapterUrl,
      count,
      countUrl
    });
  }

  return groups;
}

function buildStatsUrl(baseUrl) {
  const u = new URL(baseUrl);
  u.searchParams.set("reqtype", "stats");
  return u.toString();
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
  const condition = stripTrailingPunctuation(conditionMatch ? conditionMatch[1].trim() : "", { keepQuotes: true });

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

  const finalScopeRaw = scope || stripTrailingPunctuation(compactScopeMatch ? compactScopeMatch[1].trim() : "");
  const finalScope = normalizeScopeValue(finalScopeRaw);
  const finalSearchType = searchType || stripTrailingPunctuation(compactTypeMatch ? compactTypeMatch[1].trim() : "");
  const finalCondition = condition || stripTrailingPunctuation(compactConditionMatch ? compactConditionMatch[1].trim() : "", { keepQuotes: true });
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
  const textGroups = [];

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
      hasHitCountKeyword: /(?:符合次數|符合次数)/.test(rawHtml) || /(?:符合次數|符合次数)/.test(compactText),
      hasLoginGate: isLoginGatedPage(rawHtml)
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
      chapter: chapterLink,
      textGroups
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
  if (markers.hasLoginGate) return "upstream_login_required_or_rate_limited";
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
        const fetched = await runWithGlobalThrottle(() => fetchTextByMode(searchUrl));
        const parsed = parseStructured(fetched.body, variant, searchUrl);
        let statsUrl = "";
        let statsFetchError = "";
        let statsGroupCount = 0;

        try {
          statsUrl = buildStatsUrl(fetched.finalUrl || searchUrl);
          const statsFetched = await runWithGlobalThrottle(() => fetchTextByMode(statsUrl));
          const statsGroups = parseStatsTextGroups(statsFetched.body);
          parsed.structured.textGroups = statsGroups;
          statsGroupCount = statsGroups.length;
        } catch (err) {
          parsed.structured.textGroups = [];
          statsFetchError = err?.message || "stats page fetch failed";
        }

        const status = classifyParseStatus(parsed);
        const parseOk = hasParsedResultSignals(parsed);
        parsed.debug = {
          ...(parsed.debug || {}),
          attempt: globalAttempt,
          localAttempt,
          queryUsed,
          fetchMode: FETCH_MODE,
          browserFallbackError: fetched.fallbackFromBrowserError || "",
          statsUrl,
          statsGroupCount,
          statsFetchError,
          gated: Boolean(parsed?.debug?.markers?.hasLoginGate),
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
        structured: { corpus: null, text: null, chapter: null, textGroups: [] },
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
    const refresh = fullUrl.searchParams.get("refresh") === "1";
    if (!q) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Missing query parameter q" }));
      return;
    }

    try {
      const cacheKey = hashKey(`q=${q}|mode=${FETCH_MODE}|schema=${CACHE_SCHEMA_VERSION}`);
      if (!refresh) {
        const cachedPayload = readCache(cacheKey);
        if (cachedPayload) {
          const responsePayload = debug ? cachedPayload : {
            ...cachedPayload,
            searches: (cachedPayload.searches || []).map(({ debug: _dbg, ...rest }) => rest)
          };
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ...responsePayload, cached: true }));
          return;
        }
      }

      const payload = await searchAcrossVariants(q);
      writeCache(cacheKey, payload);
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
