import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const flagsModuleUrl = pathToFileURL(path.join(repoRoot, "src", "js", "debugFlags.mjs")).href;
const { DEBUG_FLAG_SPECS } = await import(flagsModuleUrl);

const lines = [];
lines.push("# Debug Query Flags");
lines.push("");
lines.push("This file is auto-generated from `src/js/debugFlags.mjs`. Do not edit manually.");
lines.push("");
lines.push("## Supported Flags");
lines.push("");
lines.push("| Flag | Type | Values | Default | Scope | Description |");
lines.push("| --- | --- | --- | --- | --- | --- |");

for (const flag of DEBUG_FLAG_SPECS) {
  const values = (flag.values || []).map(v => `\`${v}\``).join(", ");
  lines.push(`| \`${flag.key}\` | ${flag.type} | ${values} | \`${String(flag.defaultValue)}\` | ${flag.scope} | ${flag.description} |`);
}

lines.push("");
lines.push("## Examples");
lines.push("");
lines.push("- `?ctextDebug=1`");
lines.push("- `?ctextDebug=1&ctextSource=json`");
lines.push("- `?ctextDebug=1&ctextSource=middleware&ctextRefresh=1`");
lines.push("- `?ctextDebug=1&ctextSource=middleware&ctextProxy=https://mathesis.netlify.app`");

const outPath = path.join(repoRoot, "DEBUG_FLAGS_REFERENCE.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Updated ${path.relative(repoRoot, outPath)}`);
