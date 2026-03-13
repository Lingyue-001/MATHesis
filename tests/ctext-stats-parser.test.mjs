import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseStatsTextGroupsDetailed } = require("../server/ctextSearchMiddleware.js");

const fixturesDir = path.resolve(process.cwd(), "tests", "fixtures", "ctext-stats");

async function readFixture(name) {
  return fs.readFile(path.join(fixturesDir, name), "utf8");
}

test("parseStatsTextGroupsDetailed parses normal stats table", async () => {
  const html = await readFixture("normal.html");
  const parsed = parseStatsTextGroupsDetailed(html);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.gated, false);
  assert.equal(parsed.groups.length, 2);
  assert.equal(parsed.groups[0]?.text?.label, "《九章算術》");
  assert.equal(parsed.groups[0]?.chapters?.length, 1);
  assert.equal(parsed.groups[0]?.text?.count, 120);
});

test("parseStatsTextGroupsDetailed parses high-frequency variant table shape", async () => {
  const html = await readFixture("highfreq.html");
  const parsed = parseStatsTextGroupsDetailed(html);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.gated, false);
  assert.equal(parsed.groups.length, 2);
  assert.equal(parsed.groups[0]?.text?.label, "《九章算術細草圖說》");
  assert.ok((parsed.groups[0]?.chapters?.length || 0) >= 1);
  const labels = parsed.groups.map(g => g?.text?.label).filter(Boolean);
  assert.equal(labels.some(label => /顯示原文|检索范围|檢索範圍|條件1|条件1/.test(label)), false);
});

test("parseStatsTextGroupsDetailed parses current ctext statstable shape", async () => {
  const html = await readFixture("current-statstable.html");
  const parsed = parseStatsTextGroupsDetailed(html);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.gated, false);
  assert.equal(parsed.groups.length, 2);
  assert.equal(parsed.groups[0]?.text?.label, "《九章算術》");
  assert.equal(parsed.groups[0]?.chapters?.[0]?.label, "方田");
  assert.match(String(parsed.groups[0]?.chapters?.[0]?.url || ""), /nine-chapters\/fang-tian\/zh/);
  assert.equal(parsed.groups[1]?.text?.label, "《孫子算經》");
  assert.equal(parsed.groups[1]?.chapters?.[0]?.label, "《卷上》");
});

test("parseStatsTextGroupsDetailed marks gated pages", async () => {
  const html = await readFixture("gated.html");
  const parsed = parseStatsTextGroupsDetailed(html);
  assert.equal(parsed.status, "stats_login_gate_or_rate_limited");
  assert.equal(parsed.gated, true);
  assert.equal(parsed.groups.length, 0);
});
