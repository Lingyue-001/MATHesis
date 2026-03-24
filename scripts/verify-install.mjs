#!/usr/bin/env node

import "./load-local-env.cjs";

import fs from "fs";
import path from "path";
import process from "process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function commandFor(base) {
  if (process.platform === "win32" && (base === "npm" || base === "npx")) {
    return `${base}.cmd`;
  }
  return base;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandFor(command), args, {
      cwd: repoRoot,
      stdio: options.stdio || "pipe",
      env: process.env,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
        if (options.forwardOutput) process.stdout.write(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
        if (options.forwardOutput) process.stderr.write(chunk);
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr || stdout}`));
    });
  });
}

async function resolvePythonSpec() {
  const candidates = process.platform === "win32"
    ? [
        { cmd: "py", versionArgs: ["--version"], moduleArgs: ["-c", "import opencc; print(opencc.__file__)"] },
        { cmd: "python", versionArgs: ["--version"], moduleArgs: ["-c", "import opencc; print(opencc.__file__)"] }
      ]
    : [
        { cmd: "python3", versionArgs: ["--version"], moduleArgs: ["-c", "import opencc; print(opencc.__file__)"] },
        { cmd: "python", versionArgs: ["--version"], moduleArgs: ["-c", "import opencc; print(opencc.__file__)"] }
      ];

  for (const candidate of candidates) {
    try {
      const version = await run(candidate.cmd, candidate.versionArgs);
      const moduleImport = await run(candidate.cmd, candidate.moduleArgs);
      return {
        cmd: candidate.cmd,
        version: (version.stdout || version.stderr).trim(),
        openccModulePath: moduleImport.stdout.trim()
      };
    } catch {
      // continue
    }
  }

  throw new Error("Python with importable `opencc` module was not found.");
}

function assertFileExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Required file missing: ${relativePath}`);
  }
}

function readExpectedNodeVersion() {
  const nvmrcPath = path.join(repoRoot, ".nvmrc");
  const raw = fs.readFileSync(nvmrcPath, "utf8").trim();
  return raw;
}

async function main() {
  const checks = [];
  const expectedNodeVersion = readExpectedNodeVersion();
  const expectedNodeMajor = Number(String(expectedNodeVersion).split(".")[0]);
  const currentNodeMajor = Number(process.versions.node.split(".")[0]);

  if (currentNodeMajor !== expectedNodeMajor) {
    throw new Error(`Node major mismatch: expected ${expectedNodeVersion}, got ${process.version}`);
  }
  checks.push(`Node ${process.version} matches .nvmrc (${expectedNodeVersion})`);

  const npmVersion = await run(npmCommand(), ["-v"]);
  checks.push(`npm ${npmVersion.stdout.trim()}`);

  assertFileExists("package.json");
  assertFileExists("package-lock.json");
  assertFileExists(".nvmrc");
  assertFileExists(".env.example");
  assertFileExists("requirements.txt");
  assertFileExists("src/data.json");
  assertFileExists("simp_to_trad_map.json");
  assertFileExists("static/ctext-cache.json");
  checks.push("Required project files are present");

  const python = await resolvePythonSpec();
  checks.push(`${python.version}`);
  checks.push(`opencc import ok (${python.openccModulePath})`);

  const eleventyVersion = require(path.join(repoRoot, "node_modules", "@11ty", "eleventy", "package.json")).version;
  const playwrightVersion = require(path.join(repoRoot, "node_modules", "playwright", "package.json")).version;
  checks.push(`Eleventy ${eleventyVersion}`);
  checks.push(`Playwright package ${playwrightVersion}`);
  const { chromium } = require(path.join(repoRoot, "node_modules", "playwright"));
  const chromiumExecutable = chromium.executablePath();
  if (!fs.existsSync(chromiumExecutable)) {
    throw new Error(`Playwright Chromium executable not found at ${chromiumExecutable}`);
  }
  checks.push(`Playwright Chromium installed (${chromiumExecutable})`);

  let curlVersion = "";
  try {
    const curl = await run("curl", ["--version"]);
    curlVersion = curl.stdout.split(/\r?\n/)[0].trim();
    if (curlVersion) checks.push(curlVersion);
  } catch {
    checks.push("curl not found (static cache builder will fall back to fetch)");
  }

  console.log("[verify-install] Running parser test...");
  await run(npmCommand(), ["run", "test:ctext-stats-parser"], { forwardOutput: true });
  checks.push("Parser tests passed");

  console.log("[verify-install] Running production build...");
  await run(npmCommand(), ["run", "build"], { forwardOutput: true });
  checks.push("Production build passed");

  console.log("[verify-install] Summary");
  for (const line of checks) {
    console.log(`- ${line}`);
  }
}

main().catch((err) => {
  console.error("[verify-install] failed:", err?.message || err);
  process.exit(1);
});
