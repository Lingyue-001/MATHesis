#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import process from "process";

const cwd = process.cwd();

function parseArgs(argv) {
  const out = {
    base: process.env.CTEXT_CACHE_BASE || "http://localhost:8080",
    outFile: process.env.CTEXT_CACHE_OUT || "static/ctext-cache.json",
    delayMs: Number(process.env.CTEXT_CACHE_DELAY_MS || 220),
    timeoutMs: Number(process.env.CTEXT_CACHE_TIMEOUT_MS || 30000),
    includeNonCjk: ["1", "true", "yes"].includes(String(process.env.CTEXT_CACHE_INCLUDE_NON_CJK || "").toLowerCase()),
    mappedTextFiles: String(process.env.CTEXT_CACHE_MAPPED_TEXT || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    termsOverride: [],
    limit: null,
    refreshAll: false
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
    if (token === "--refresh-all") {
      out.refreshAll = true;
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

function buildCandidateBases(base) {
  const normalized = String(base || "").replace(/\/+$/, "");
  if (!normalized) return [];
  const out = [normalized];
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      out.push(parsed.toString().replace(/\/+$/, ""));
    }
  } catch {
    // ignore invalid URL here; fetch layer will report concrete errors
  }
  return Array.from(new Set(out));
}

function splitCandidateParts(value) {
  const splitRegex = /[，,、；;：:。.\s\/|()（）\[\]{}'"“”‘’]+/;
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

  const add = (raw) => {
    if (typeof raw !== "string") return;
    const term = raw.trim().replace(/\s+/g, " ");
    if (!term) return;

    const addNormalized = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return;
      if (mappedCorpusNormalized && !mappedCorpusNormalized.includes(normalized)) return;
      terms.add(normalized);
    };

    if (/^\d+$/.test(term)) {
      const mapped = numericMap[term];
      if (mapped) addNormalized(normalizeLookupKey(mapped, tradToSimp));
      return;
    }

    const hasCJK = /[\u3400-\u9fff]/u.test(term);
    if (!hasCJK && !includeNonCjk) return;
    if (hasCJK && term.length < 1) return;
    if (!hasCJK && term.length < 3) return;

    const normalized = normalizeLookupKey(term, tradToSimp);
    if (!normalized) return;
    addNormalized(normalized);

    // Keep this aligned with 1a.html prototype fuzzy aliases.
    if (hasCJK && normalized.length >= 3) {
      addNormalized(normalized.slice(0, 2));
      addNormalized(normalized.slice(0, 3));
    }
  };

  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const p = node?.properties || node || {};
    const candidates = [
      p.name,
      p.name_zh,
      p.name_zh_simple,
      p.name_en,
      p.name_sa,
      p.transliteration
    ];
    candidates.forEach((value) => {
      if (typeof value !== "string") return;
      splitCandidateParts(value).forEach(add);
    });
  });

  return Array.from(terms)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "zh-Hans-CN"));
}

function isValidPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.error) return false;
  if (!Array.isArray(payload.searches)) return false;
  return true;
}

async function fetchSearchPayloadWithTimeout(base, term, timeoutMs, forceRefresh) {
  const bases = buildCandidateBases(base);
  const errors = [];

  for (const oneBase of bases) {
    const refreshParam = forceRefresh ? "&refresh=1" : "";
    const url = `${oneBase}/api/ctext/search?q=${encodeURIComponent(term)}&debug=1${refreshParam}`;
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
        payload = { error: `Invalid JSON response: ${text.slice(0, 120)}` };
      }
      if (!res.ok) {
        errors.push(`${oneBase}: HTTP ${res.status}`);
        continue;
      }
      if (!isValidPayload(payload)) {
        errors.push(`${oneBase}: ${String(payload?.error || "Invalid payload shape")}`);
        continue;
      }
      return { ok: true, payload };
    } catch (err) {
      const isTimeout = err?.name === "AbortError";
      errors.push(`${oneBase}: ${isTimeout ? `timeout(${timeoutMs}ms)` : (err?.message || "fetch failed")}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    ok: false,
    error: errors.length ? errors.join(" | ") : "fetch failed",
    payload: null
  };
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dataPath = path.resolve(cwd, "src/data.json");
  const simpMapPath = path.resolve(cwd, "simp_to_trad_map.json");
  const outPath = path.resolve(cwd, opts.outFile);

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

  let oldEntries = {};
  try {
    const old = await readJson(outPath);
    oldEntries = old && typeof old.entries === "object" ? old.entries : {};
  } catch {
    oldEntries = {};
  }

  const entries = { ...oldEntries };
  const failures = {};
  let fetched = 0;
  let skipped = 0;

  // eslint-disable-next-line no-console
  console.log(`[ctext-cache] terms=${terms.length} base=${opts.base} out=${opts.outFile} timeoutMs=${opts.timeoutMs} includeNonCjk=${opts.includeNonCjk ? 1 : 0} mappedText=${opts.mappedTextFiles.length}`);
  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    // eslint-disable-next-line no-console
    console.log(`[ctext-cache] fetch ${i + 1}/${terms.length}: ${term}`);
    if (!opts.refreshAll && entries[term]) {
      skipped += 1;
      continue;
    }
    const result = await fetchSearchPayloadWithTimeout(opts.base, term, opts.timeoutMs, opts.refreshAll);
    if (result.ok) {
      entries[term] = result.payload;
      // eslint-disable-next-line no-console
      console.log(`[ctext-cache] ok   ${term}`);
    } else {
      failures[term] = result.error;
      // eslint-disable-next-line no-console
      console.log(`[ctext-cache] fail ${term}: ${result.error}`);
    }
    fetched += 1;
    if (opts.delayMs > 0) await delay(opts.delayMs);
    if ((i + 1) % 20 === 0 || i === terms.length - 1) {
      // eslint-disable-next-line no-console
      console.log(`[ctext-cache] progress ${i + 1}/${terms.length} fetched=${fetched} skipped=${skipped} failures=${Object.keys(failures).length}`);
    }
  }

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceBase: opts.base,
    totalTerms: terms.length,
    fetched,
    skipped,
    failureCount: Object.keys(failures).length,
    entries,
    failures
  };

  await ensureParentDir(outPath);
  await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`[ctext-cache] wrote ${opts.outFile} entries=${Object.keys(entries).length}`);
  if (output.failureCount > 0) {
    // eslint-disable-next-line no-console
    console.log("[ctext-cache] sample failures:");
    Object.entries(failures).slice(0, 8).forEach(([term, message]) => {
      // eslint-disable-next-line no-console
      console.log(`  - ${term}: ${message}`);
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[ctext-cache] failed:", err?.message || err);
  process.exit(1);
});
