import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const logPath = path.join(repoRoot, "LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md");
const outPath = path.join(repoRoot, "LOG_按标签视图_By_Tag.md");

const ALLOWED_TAGS = [
  "ctext",
  "transcriptions",
  "search",
  "data",
  "infra",
  "project-docs"
];

function parseEvents(markdown) {
  const headingRegex = /^##\s+\[(.*?)\]\s+(.*)$/gm;
  const matches = [...markdown.matchAll(headingRegex)];
  const events = [];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const next = matches[i + 1];
    const start = m.index ?? 0;
    const end = next?.index ?? markdown.length;
    const block = markdown.slice(start, end).trim();
    const date = String(m[1] || "").trim();
    const title = String(m[2] || "").trim();
    const tagLine = block.match(/^0\.\s*Tags\s*\/\s*标签\s*\n\s*-\s*(.+)$/m);
    const tagsRaw = tagLine ? tagLine[1] : "";
    const tags = tagsRaw
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)
      .filter(x => ALLOWED_TAGS.includes(x));

    events.push({ date, title, tags, block });
  }
  return events;
}

function buildGrouped(events) {
  const groups = new Map();
  ALLOWED_TAGS.forEach(tag => groups.set(tag, []));
  groups.set("untagged", []);

  for (const e of events) {
    if (!e.tags.length) {
      groups.get("untagged").push(e);
      continue;
    }
    e.tags.forEach(tag => groups.get(tag).push(e));
  }
  return groups;
}

function main() {
  const raw = fs.readFileSync(logPath, "utf8");
  const events = parseEvents(raw);
  const groups = buildGrouped(events);

  const lines = [];
  lines.push("# LOG by Tag");
  lines.push("");
  lines.push("Auto-generated from `LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md`.");
  lines.push("");
  lines.push("Tag set: `ctext`, `transcriptions`, `search`, `data`, `infra`, `project-docs`.");
  lines.push("");
  lines.push(`Total events: ${events.length}`);
  lines.push("");

  for (const [tag, items] of groups.entries()) {
    lines.push(`## ${tag}`);
    lines.push("");
    if (!items.length) {
      lines.push("- (none)");
      lines.push("");
      continue;
    }
    for (const item of items) {
      lines.push(`- [${item.date}] ${item.title}`);
    }
    lines.push("");
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Updated ${path.relative(repoRoot, outPath)}`);
}

main();
