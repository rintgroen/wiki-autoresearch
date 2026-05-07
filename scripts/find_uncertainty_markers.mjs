#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function usage() {
  console.error(
    "Usage: node scripts/find_uncertainty_markers.mjs <vault-path> [--limit N] [--json] [--include-raw]"
  );
  process.exit(2);
}

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
}

const vaultPath = path.resolve(args[0]);
let limit = 30;
let asJson = false;
let includeRaw = false;

for (let index = 1; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--json") {
    asJson = true;
  } else if (arg === "--include-raw") {
    includeRaw = true;
  } else if (arg === "--limit") {
    const value = Number.parseInt(args[index + 1] || "", 10);
    if (!Number.isFinite(value) || value <= 0) usage();
    limit = value;
    index += 1;
  } else {
    usage();
  }
}

if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
  console.error(`Not a directory: ${vaultPath}`);
  process.exit(1);
}

const ignoredDirs = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
  "_archives",
  "wiki-export",
]);

if (!includeRaw) {
  ignoredDirs.add("_raw");
}

const markerRules = [
  {
    kind: "conflict",
    score: 9,
    pattern:
      /\b(conflicts?|contradict(?:s|ion|ory)?|inconsistent|disputed|sources?\s+disagree|competing\s+claims?)\b/i,
  },
  {
    kind: "open_question",
    score: 8,
    pattern:
      /\b(open\s+questions?|unresolved|unknown|unclear|needs?\s+(?:verification|source|evidence)|citation\s+needed|source\s+needed|verify)\b/i,
  },
  {
    kind: "todo",
    score: 6,
    pattern: /\b(TODO|FIXME|VERIFY|TBD|UNCLEAR)\b/,
  },
  {
    kind: "question_heading",
    score: 7,
    pattern: /^#{1,6}\s+.*\b(questions?|open|unresolved|verify|verification|conflicts?|contradictions?)\b/i,
  },
  {
    kind: "question_line",
    score: 4,
    label: "question",
    pattern: /^\s*(?:[-*]\s*)?(?:Q:|Question:)\s+\S/i,
  },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...walk(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractMarker(rule, line) {
  const match = line.match(rule.pattern);
  if (!match) return null;
  if (rule.label) return rule.label;
  return match[0].trim();
}

const matches = [];

for (const filePath of walk(vaultPath)) {
  const relativePath = path.relative(vaultPath, filePath);
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.trim()) continue;

    for (const rule of markerRules) {
      const marker = extractMarker(rule, line);
      if (!marker) continue;

      const headingBoost = /^#{1,6}\s/.test(line) ? 2 : 0;
      matches.push({
        score: rule.score + headingBoost,
        kind: rule.kind,
        marker,
        file: relativePath,
        line: lineIndex + 1,
        text: line.trim().replace(/\s+/g, " "),
      });
      break;
    }
  }
}

matches.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return a.line - b.line;
});

const limited = matches.slice(0, limit);

if (asJson) {
  console.log(JSON.stringify({ vault: vaultPath, total: matches.length, matches: limited }, null, 2));
} else {
  console.log(`# Uncertainty Marker Candidates`);
  console.log("");
  console.log(`- Vault: ${vaultPath}`);
  console.log(`- Total matches: ${matches.length}`);
  console.log(`- Showing: ${limited.length}`);
  console.log("");
  console.log("| Score | Kind | Location | Marker | Text |");
  console.log("|---:|---|---|---|---|");

  for (const match of limited) {
    const location = `${match.file}:${match.line}`;
    const text = match.text.replaceAll("|", "\\|");
    const marker = match.marker.replaceAll("|", "\\|");
    console.log(`| ${match.score} | ${match.kind} | ${location} | ${marker} | ${text} |`);
  }
}
