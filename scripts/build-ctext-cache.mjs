#!/usr/bin/env node

import "./load-local-env.cjs";

import fs from "fs/promises";
import path from "path";
import process from "process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const cwd = process.cwd();
const execFileAsync = promisify(execFile);

const DEFAULT_CANDIDATE_OUT = process.env.CTEXT_CACHE_OUT || "tmp/ctext-static-build/ctext-cache.candidate.json";
const DEFAULT_REPORT_OUT = process.env.CTEXT_CACHE_REPORT || "tmp/ctext-static-build/ctext-cache.report.json";
const DEFAULT_PUBLISH_OUT = process.env.CTEXT_CACHE_PUBLISH_OUT || "static/ctext-cache.json";
const CANDIDATE_SCHEMA_VERSION = 2;
const REPORT_SCHEMA_VERSION = 1;

function parseArgs(argv) {
  const out = {
    base: process.env.CTEXT_CACHE_BASE || "http://127.0.0.1:8080",
    outFile: DEFAULT_CANDIDATE_OUT,
    reportFile: DEFAULT_REPORT_OUT,
    publishFile: DEFAULT_PUBLISH_OUT,
    delayMs: Number(process.env.CTEXT_CACHE_DELAY_MS || 220),
    timeoutMs: Number(process.env.CTEXT_CACHE_TIMEOUT_MS || 30000),
    includeNonCjk: ["1", "true", "yes"].includes(String(process.env.CTEXT_CACHE_INCLUDE_NON_CJK || "").toLowerCase()),
    mappedTextFiles: String(process.env.CTEXT_CACHE_MAPPED_TEXT || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    termsOverride: [],
    limit: null,
    mergeExisting: false,
    forceRefresh: !["0", "false", "no"].includes(String(process.env.CTEXT_CACHE_FORCE_REFRESH || "1").toLowerCase()),
    transport: ["fetch"].includes(String(process.env.CTEXT_CACHE_TRANSPORT || "").toLowerCase()) ? "fetch" : "curl",
    publish: false,
    promoteFrom: ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--base" && argv[i + 1]) {
      out.base = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--out" && argv[i + 1]) {
      out.outFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--report" && argv[i + 1]) {
      out.reportFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--publish-file" && argv[i + 1]) {
      out.publishFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--delay" && argv[i + 1]) {
      out.delayMs = Number(argv[i + 1]) || out.delayMs;
      i += 1;
      continue;
    }
    if (token === "--timeout" && argv[i + 1]) {
      out.timeoutMs = Number(argv[i + 1]) || out.timeoutMs;
      i += 1;
      continue;
    }
    if (token === "--terms" && argv[i + 1]) {
      out.termsOverride = String(argv[i + 1])
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (token === "--include-non-cjk") {
      out.includeNonCjk = true;
      continue;
    }
    if (token === "--mapped-text" && argv[i + 1]) {
      out.mappedTextFiles = String(argv[i + 1])
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (token === "--limit" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
      i += 1;
      continue;
    }
    if (token === "--merge-existing") {
      out.mergeExisting = true;
      continue;
    }
    if (token === "--transport" && argv[i + 1]) {
      const transport = String(argv[i + 1] || "").toLowerCase();
      out.transport = transport === "fetch" ? "fetch" : "curl";
      i += 1;
      continue;
    }
    if (token === "--publish") {
      out.publish = true;
      continue;
    }
    if (token === "--promote" && argv[i + 1]) {
      out.promoteFrom = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--no-refresh") {
      out.forceRefresh = false;
      continue;
    }
    if (token === "--refresh-all") {
      out.forceRefresh = true;
      continue;
    }
  }

  return out;
}

async function readJson(file) {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitCandidateParts(value) {
  const splitRegex = /[，,、；;：:。.\s/|()（）\[\]{}'"“”‘’]+/;
  if (!splitRegex.test(value)) return [value];
  return value.split(splitRegex).filter(Boolean);
}

function toTradToSimpMap(simpToTrad) {
  const out = {};
  Object.entries(simpToTrad || {}).forEach(([simp, trad]) => {
    if (typeof trad === "string" && trad && typeof simp === "string" && simp) {
      out[trad] = simp;
    }
  });
  return out;
}

function normalizeLookupKey(input, tradToSimp) {
  const text = String(input || "").trim().replace(/\s+/g, "");
  if (!text) return "";
  return Array.from(text).map(ch => tradToSimp[ch] || ch).join("");
}

async function readMappedCorpusNormalized(files, tradToSimp) {
  const paths = (Array.isArray(files) ? files : []).map(s => String(s || "").trim()).filter(Boolean);
  if (!paths.length) return "";

  const chunks = [];
  for (const onePath of paths) {
    const abs = path.resolve(cwd, onePath);
    const raw = await fs.readFile(abs, "utf8");
    chunks.push(normalizeLookupKey(raw, tradToSimp));
  }
  return chunks.join("");
}

function collectQueryTerms(nodes, tradToSimp, options = {}) {
  const includeNonCjk = Boolean(options.includeNonCjk);
  const mappedCorpusNormalized = String(options.mappedCorpusNormalized || "");
  const terms = new Set();
  const numericMap = {
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
    "7": "七",
    "8": "八",
    "9": "九",
    "10": "十"
  };

  const addNormalized = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    if (mappedCorpusNormalized && !mappedCorpusNormalized.includes(normalized)) return;
    terms.add(normalized);
  };

  const add = (raw) => {
    if (typeof raw !== "string") return;
    const term = raw.trim().replace(/\s+/g, " ");
    if (!term) return;

    if (/^\d+$/.test(term)) {
      const mapped = numericMap[term];
      if (mapped) addNormalized(normalizeLookupKey(mapped, tradToSimp));
      return;
    }

    const hasCjk = /[\u3400-\u9fff]/u.test(term);
    if (!hasCjk && !includeNonCjk) return;
    if (!hasCjk && term.length < 3) return;

    const normalized = normalizeLookupKey(term, tradToSimp);
    if (!normalized) return;
    addNormalized(normalized);

    if (hasCjk && normalized.length >= 3) {
      addNormalized(normalized.slice(0, 2));
      addNormalized(normalized.slice(0, 3));
    }
  };

  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const p = node?.properties || node || {};
    const candidates = [p.name, p.name_zh, p.name_zh_simple, p.name_en, p.name_sa, p.transliteration];
    candidates.forEach((value) => {
      if (typeof value !== "string") return;
      splitCandidateParts(value).forEach(add);
    });
  });

  return Array.from(terms)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "zh-Hans-CN"));
}

function hasPositiveHits(item) {
  return typeof item?.hitCount === "number" && Number.isFinite(item.hitCount) && item.hitCount > 0;
}

function getTextGroups(item) {
  return Array.isArray(item?.structured?.textGroups) ? item.structured.textGroups : [];
}

function isParseOk(item) {
  const debug = item?.debug || {};
  const parseStatus = String(debug.parseStatus || "");
  return debug.parseOk === true || /^ok/.test(parseStatus);
}

function validateSearchItemForStaticCache(item) {
  const variant = String(item?.variant || item?.queryUsed || "unknown");
  const debug = item?.debug || {};
  const parseStatus = String(debug.parseStatus || "");
  const groups = getTextGroups(item);

  if (debug.gated === true) {
    return { ok: false, reason: `${variant}:gated` };
  }
  if (!isParseOk(item)) {
    return { ok: false, reason: `${variant}:parse=${parseStatus || "unknown"}` };
  }
  if (hasPositiveHits(item) && groups.length <= 0) {
    return { ok: false, reason: `${variant}:positive_hits_without_text_groups` };
  }
  const invalidGroup = groups.find(group => !String(group?.text?.label || "").trim());
  if (invalidGroup) {
    return { ok: false, reason: `${variant}:group_missing_text_label` };
  }
  return { ok: true, reason: "" };
}

function sanitizePayloadForStaticCache(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "invalid payload", payload: null, rejected: [] };
  }
  if (payload.error) {
    return { ok: false, reason: String(payload.error), payload: null, rejected: [] };
  }
  if (!Array.isArray(payload.searches) || payload.searches.length <= 0) {
    return { ok: false, reason: "empty searches", payload: null, rejected: [] };
  }

  const safeSearches = [];
  const rejected = [];
  for (const item of payload.searches) {
    const checked = validateSearchItemForStaticCache(item);
    if (!checked.ok) {
      rejected.push(checked.reason);
      continue;
    }
    safeSearches.push(item);
  }

  if (safeSearches.length <= 0) {
    return {
      ok: false,
      reason: `no publishable searches${rejected.length ? ` (${rejected.slice(0, 3).join(";")})` : ""}`,
      payload: null,
      rejected
    };
  }

  const variants = Array.from(new Set(
    safeSearches
      .map(item => String(item?.variant || "").trim())
      .filter(Boolean)
  ));

  return {
    ok: true,
    reason: "",
    rejected,
    payload: {
      query: payload.query,
      endpoint: payload.endpoint,
      variants,
      variantsSearched: safeSearches.length,
      generatedAt: payload.generatedAt || new Date().toISOString(),
      searches: safeSearches,
      cached: false,
      sourceMode: "static-cache"
    }
  };
}

async function fetchSearchPayloadWithTimeout(base, term, timeoutMs, forceRefresh) {
  const refreshParam = forceRefresh ? "&refresh=1" : "";
  const url = `${String(base || "").replace(/\/+$/, "")}/api/ctext/search?q=${encodeURIComponent(term)}&debug=1${refreshParam}`;
  return fetchSearchPayloadByTransport(url, timeoutMs, "curl");
}

async function fetchTextViaNodeFetch(url, timeoutMs) {
  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 30000));
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, error: `invalid JSON response: ${text.slice(0, 160)}` };
    }
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const sanitized = sanitizePayloadForStaticCache(payload);
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.reason };
    }
    return { ok: true, payload: sanitized.payload, rejected: sanitized.rejected };
  } catch (err) {
    const isTimeout = err?.name === "AbortError";
    const cause = err?.cause?.message ? `; cause=${err.cause.message}` : "";
    return { ok: false, error: isTimeout ? `timeout(${timeoutMs}ms)` : `${err?.message || "fetch failed"}${cause}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchTextViaCurl(url, timeoutMs) {
  const maxTimeSec = Math.max(1, Math.ceil((Number(timeoutMs) || 30000) / 1000));
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-sS", "--max-time", String(maxTimeSec), "-H", "Accept: application/json", url],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    const text = String(stdout || "");
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, error: `invalid JSON response: ${text.slice(0, 160)}` };
    }
    const sanitized = sanitizePayloadForStaticCache(payload);
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.reason };
    }
    return { ok: true, payload: sanitized.payload, rejected: sanitized.rejected };
  } catch (err) {
    const stderr = String(err?.stderr || "").trim();
    const stdout = String(err?.stdout || "").trim();
    const exitCode = Number.isFinite(Number(err?.code)) ? `exit=${String(err.code)}` : "";
    const detail = stderr || stdout || err?.message || "curl failed";
    return { ok: false, error: [exitCode, detail].filter(Boolean).join(" ") };
  }
}

async function fetchSearchPayloadByTransport(url, timeoutMs, transport) {
  if (transport === "fetch") {
    return fetchTextViaNodeFetch(url, timeoutMs);
  }
  const curlResult = await fetchTextViaCurl(url, timeoutMs);
  if (curlResult.ok) return curlResult;
  if (/spawn .*ENOENT|not found/i.test(String(curlResult.error || ""))) {
    return fetchTextViaNodeFetch(url, timeoutMs);
  }
  return curlResult;
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJsonAtomic(filePath, data) {
  await ensureParentDir(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readEntriesFromCacheFile(filePath) {
  try {
    const old = await readJson(filePath);
    return old && typeof old.entries === "object" ? old.entries : {};
  } catch {
    return {};
  }
}

function buildPublishedCache(candidate) {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    generatedAt: candidate.generatedAt,
    sourceBase: candidate.sourceBase,
    entryCount: Object.keys(candidate.entries || {}).length,
    entries: candidate.entries || {}
  };
}

function validateCandidateFile(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, reason: "invalid candidate payload", normalized: null };
  }

  const entriesIn = candidate && typeof candidate.entries === "object" ? candidate.entries : null;
  if (!entriesIn) {
    return { ok: false, reason: "candidate missing entries", normalized: null };
  }

  const normalizedEntries = {};
  const invalidTerms = [];
  for (const [term, payload] of Object.entries(entriesIn)) {
    const sanitized = sanitizePayloadForStaticCache(payload);
    if (!sanitized.ok) {
      invalidTerms.push(`${term}:${sanitized.reason}`);
      continue;
    }
    normalizedEntries[term] = sanitized.payload;
  }

  if (invalidTerms.length > 0) {
    return {
      ok: false,
      reason: `candidate contains invalid entries (${invalidTerms.slice(0, 5).join(";")})`,
      normalized: null
    };
  }

  return {
    ok: true,
    reason: "",
    normalized: {
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      generatedAt: candidate.generatedAt || new Date().toISOString(),
      sourceBase: candidate.sourceBase || "",
      buildMode: "candidate",
      options: candidate.options || {},
      totals: candidate.totals || {
        requestedTerms: Object.keys(normalizedEntries).length,
        entryCount: Object.keys(normalizedEntries).length,
        failureCount: 0
      },
      entries: normalizedEntries,
      failures: candidate.failures || {},
      pruned: candidate.pruned || {}
    }
  };
}

async function promoteCandidateFile(candidatePath, publishPath) {
  const candidate = await readJson(candidatePath);
  const validated = validateCandidateFile(candidate);
  if (!validated.ok) {
    throw new Error(validated.reason);
  }

  const published = buildPublishedCache(validated.normalized);
  await writeJsonAtomic(publishPath, published);
  return {
    publishPath,
    entryCount: Object.keys(published.entries || {}).length
  };
}

async function buildCandidate(opts) {
  const dataPath = path.resolve(cwd, "src/data.json");
  const simpMapPath = path.resolve(cwd, "simp_to_trad_map.json");
  const outPath = path.resolve(cwd, opts.outFile);
  const reportPath = path.resolve(cwd, opts.reportFile);

  const data = await readJson(dataPath);
  const simpToTrad = await readJson(simpMapPath);
  const tradToSimp = toTradToSimpMap(simpToTrad);

  const mappedCorpusNormalized = await readMappedCorpusNormalized(opts.mappedTextFiles, tradToSimp);
  const allTerms = collectQueryTerms(data?.nodes, tradToSimp, {
    includeNonCjk: opts.includeNonCjk,
    mappedCorpusNormalized
  });
  const manualTerms = (Array.isArray(opts.termsOverride) ? opts.termsOverride : [])
    .map(item => normalizeLookupKey(item, tradToSimp))
    .filter(Boolean);
  const termsPool = manualTerms.length > 0 ? manualTerms : allTerms;
  const terms = opts.limit ? termsPool.slice(0, opts.limit) : termsPool;

  const entries = opts.mergeExisting ? await readEntriesFromCacheFile(outPath) : {};
  const failures = {};
  const pruned = {};
  let fetched = 0;
  let skipped = 0;
  let succeeded = 0;

  console.log(
    `[ctext-cache] terms=${terms.length} base=${opts.base} candidate=${opts.outFile} publish=${opts.publishFile} timeoutMs=${opts.timeoutMs} refresh=${opts.forceRefresh ? 1 : 0} merge=${opts.mergeExisting ? 1 : 0} transport=${opts.transport} mappedText=${opts.mappedTextFiles.length}`
  );

  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    console.log(`[ctext-cache] fetch ${i + 1}/${terms.length}: ${term}`);
    if (opts.mergeExisting && entries[term]) {
      skipped += 1;
      continue;
    }

    const refreshParam = opts.forceRefresh ? "&refresh=1" : "";
    const url = `${String(opts.base || "").replace(/\/+$/, "")}/api/ctext/search?q=${encodeURIComponent(term)}&debug=1${refreshParam}`;
    const result = await fetchSearchPayloadByTransport(url, opts.timeoutMs, opts.transport);
    if (result.ok) {
      entries[term] = result.payload;
      if (Array.isArray(result.rejected) && result.rejected.length > 0) {
        pruned[term] = result.rejected;
      }
      succeeded += 1;
      console.log(`[ctext-cache] ok   ${term}`);
    } else {
      failures[term] = result.error;
      console.log(`[ctext-cache] fail ${term}: ${result.error}`);
    }

    fetched += 1;
    if (opts.delayMs > 0) await delay(opts.delayMs);
    if ((i + 1) % 20 === 0 || i === terms.length - 1) {
      console.log(
        `[ctext-cache] progress ${i + 1}/${terms.length} fetched=${fetched} skipped=${skipped} success=${succeeded} failures=${Object.keys(failures).length}`
      );
    }
  }

  const candidate = {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceBase: opts.base,
    buildMode: "candidate",
    options: {
      delayMs: opts.delayMs,
      timeoutMs: opts.timeoutMs,
      includeNonCjk: opts.includeNonCjk,
      mappedTextFiles: opts.mappedTextFiles,
      mergeExisting: opts.mergeExisting,
      forceRefresh: opts.forceRefresh,
      transport: opts.transport
    },
    totals: {
      requestedTerms: terms.length,
      fetched,
      skipped,
      successCount: succeeded,
      failureCount: Object.keys(failures).length,
      entryCount: Object.keys(entries).length
    },
    entries,
    failures,
    pruned
  };

  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: candidate.generatedAt,
    sourceBase: opts.base,
    candidateFile: opts.outFile,
    publishFile: opts.publishFile,
    totals: candidate.totals,
    options: candidate.options,
    failures,
    pruned
  };

  await writeJsonAtomic(outPath, candidate);
  await writeJsonAtomic(reportPath, report);

  console.log(`[ctext-cache] wrote candidate ${opts.outFile} entries=${candidate.totals.entryCount}`);
  console.log(`[ctext-cache] wrote report ${opts.reportFile}`);
  if (report.totals.failureCount > 0) {
    console.log("[ctext-cache] sample failures:");
    Object.entries(failures).slice(0, 8).forEach(([term, message]) => {
      console.log(`  - ${term}: ${message}`);
    });
  }
  if (Object.keys(pruned).length > 0) {
    console.log("[ctext-cache] sample pruned variants:");
    Object.entries(pruned).slice(0, 5).forEach(([term, reasons]) => {
      console.log(`  - ${term}: ${(Array.isArray(reasons) ? reasons : []).join(";")}`);
    });
  }

  return {
    candidate,
    outPath,
    reportPath
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const publishPath = path.resolve(cwd, opts.publishFile);

  if (opts.promoteFrom) {
    const promotePath = path.resolve(cwd, opts.promoteFrom);
    const promoted = await promoteCandidateFile(promotePath, publishPath);
    console.log(`[ctext-cache] promoted ${opts.promoteFrom} -> ${opts.publishFile} entries=${promoted.entryCount}`);
    return;
  }

  const built = await buildCandidate(opts);
  if (opts.publish) {
    const promoted = await promoteCandidateFile(built.outPath, publishPath);
    console.log(`[ctext-cache] published ${opts.publishFile} entries=${promoted.entryCount}`);
  } else {
    console.log("[ctext-cache] candidate ready; inspect it before publishing.");
    console.log(`[ctext-cache] promote command: node scripts/build-ctext-cache.mjs --promote ${opts.outFile}`);
  }
}

main().catch((err) => {
  console.error("[ctext-cache] failed:", err?.message || err);
  process.exit(1);
});
