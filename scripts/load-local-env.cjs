"use strict";

const fs = require("fs");
const path = require("path");

const GLOBAL_KEY = "__MATHESIS_LOCAL_ENV_STATE__";

function unquote(rawValue) {
  const value = String(rawValue ?? "");
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const body = value.slice(1, -1);
    if (value.startsWith("\"")) {
      return body
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    }
    return body.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }
  return value.trim();
}

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    entries.push([key, unquote(rawValue)]);
  }

  return entries;
}

function loadLocalEnv(options = {}) {
  if (global[GLOBAL_KEY]) return global[GLOBAL_KEY];

  const repoRoot = path.resolve(__dirname, "..");
  const originalKeys = new Set(Object.keys(process.env));
  const loadedFiles = [];
  const appliedKeys = [];
  const files = [".env", ".env.local"];

  for (const relativeName of files) {
    const absolutePath = path.join(repoRoot, relativeName);
    if (!fs.existsSync(absolutePath)) continue;

    const allowOverrideFromEarlierEnvFile = relativeName === ".env.local";
    const parsed = parseEnvFile(absolutePath);
    for (const [key, value] of parsed) {
      if (originalKeys.has(key)) continue;
      if (!allowOverrideFromEarlierEnvFile && Object.prototype.hasOwnProperty.call(process.env, key)) {
        continue;
      }
      process.env[key] = value;
      appliedKeys.push(key);
    }
    loadedFiles.push(relativeName);
  }

  const state = {
    repoRoot,
    loadedFiles,
    appliedKeys
  };

  global[GLOBAL_KEY] = state;
  if (options.verbose) {
    const filesSummary = loadedFiles.length ? loadedFiles.join(", ") : "(none)";
    // eslint-disable-next-line no-console
    console.log(`[local-env] loaded ${filesSummary}`);
  }
  return state;
}

loadLocalEnv();

module.exports = {
  loadLocalEnv
};
