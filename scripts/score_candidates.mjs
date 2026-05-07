#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function usage() {
  console.error(
    "Usage: node scripts/score_candidates.mjs <vault-path> [--limit N] [--json] [--include-raw] [--user-topic TEXT]"
  );
  process.exit(2);
}

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
}

const vaultPath = path.resolve(args[0]);
let limit = 20;
let asJson = false;
let includeRaw = false;
let userTopic = "";

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
  } else if (arg === "--user-topic") {
    userTopic = args[index + 1] || "";
    if (!userTopic) usage();
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
  "_system",
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
    pattern: /^\s*(?:[-*]\s*)?(?:Q:|Question:)\s+\S/i,
  },
];

function walk(dir, options = {}) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!options.ignore || !options.ignore.has(entry.name)) {
        files.push(...walk(fullPath, options));
      }
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return readText(filePath)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end === -1) return {};
  const frontmatter = {};
  const lines = text.slice(4, end).split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) frontmatter[match[1]] = match[2];
  }
  return frontmatter;
}

function titleFor(filePath, text) {
  const heading = text.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return path.basename(filePath, ".md").replace(/[-_]+/g, " ");
}

function wordCount(text) {
  return (text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu) || []).length;
}

function markdownLinks(text) {
  const links = [];
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(text))) links.push(match[1].trim());
  return links;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsTopic(text, topic) {
  if (!text || !topic) return false;
  return normalizeName(text).includes(normalizeName(topic));
}

function addSignal(signals, label, weight, detail = "") {
  signals.push({ label, weight, detail });
}

function bestUncertainty(text) {
  const lines = text.split(/\r?\n/);
  let best = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.trim()) continue;
    for (const rule of markerRules) {
      const match = line.match(rule.pattern);
      if (!match) continue;
      const score = rule.score + (/^#{1,6}\s/.test(line) ? 2 : 0);
      if (!best || score > best.score) {
        best = {
          score,
          kind: rule.kind,
          line: lineIndex + 1,
          marker: match[0].trim(),
          text: line.trim().replace(/\s+/g, " "),
        };
      }
      break;
    }
  }

  return best;
}

function loadBenchmarkBank() {
  const filePath = path.join(vaultPath, "_system", "autoresearch", "benchmark-questions.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readText(filePath));
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch {
    return [];
  }
}

function loadLedger() {
  const filePath = path.join(vaultPath, "_system", "autoresearch", "cycles.jsonl");
  return parseJsonLines(filePath);
}

function loadClaims() {
  const filePath = path.join(vaultPath, "_system", "autoresearch", "source-claims.jsonl");
  return parseJsonLines(filePath);
}

function scoreRawBacklog() {
  const roots = ["_raw", "Inbox", "Clippings"];
  const files = [];
  for (const root of roots) {
    const rootPath = path.join(vaultPath, root);
    files.push(
      ...walk(rootPath).filter((filePath) => /\.(md|txt|html|json|csv)$/i.test(filePath))
    );
  }

  if (files.length === 0) return null;

  const samples = files
    .slice(0, 8)
    .map((filePath) => path.relative(vaultPath, filePath))
    .join(", ");

  return {
    score: Math.min(10, 4 + Math.ceil(files.length / 5)),
    topic: "Raw source backlog",
    cycleType: "backlog_distillation",
    file: null,
    line: null,
    reason: `${files.length} raw source files are available for distillation`,
    signals: [
      {
        label: "raw backlog",
        weight: Math.min(10, 4 + Math.ceil(files.length / 5)),
        detail: samples,
      },
    ],
  };
}

const markdownFiles = walk(vaultPath, { ignore: ignoredDirs }).filter((filePath) =>
  filePath.endsWith(".md")
);

const pages = markdownFiles.map((filePath) => {
  const text = readText(filePath);
  return {
    filePath,
    relativePath: path.relative(vaultPath, filePath),
    text,
    frontmatter: parseFrontmatter(text),
    title: titleFor(filePath, text),
    words: wordCount(text),
    links: markdownLinks(text),
    uncertainty: bestUncertainty(text),
  };
});

const basenameToPath = new Map();
for (const page of pages) {
  basenameToPath.set(normalizeName(path.basename(page.relativePath, ".md")), page.relativePath);
  basenameToPath.set(normalizeName(page.title), page.relativePath);
}

const inbound = new Map(pages.map((page) => [page.relativePath, 0]));
for (const page of pages) {
  for (const link of page.links) {
    const target = basenameToPath.get(normalizeName(link));
    if (target && target !== page.relativePath) {
      inbound.set(target, (inbound.get(target) || 0) + 1);
    }
  }
}

const hotText = readText(path.join(vaultPath, "hot.md"));
const logText = readText(path.join(vaultPath, "log.md"));
const agendaText = readText(path.join(vaultPath, "_system", "autoresearch", "agenda.md"));
const benchmarks = loadBenchmarkBank();
const ledger = loadLedger();
const claims = loadClaims();

const recentDecisions = new Map();
for (const record of ledger.slice(-40)) {
  const keys = [
    normalizeName(record.topic),
    normalizeName(record.candidate?.file),
    normalizeName(record.candidate?.topic),
  ].filter(Boolean);
  for (const key of keys) {
    recentDecisions.set(key, record);
  }
}

const claimSignals = new Map();
for (const claim of claims) {
  const status = String(claim.status || "").toLowerCase();
  if (!["conflict", "disputed", "unverified", "stale", "needs_source"].includes(status)) continue;
  const keys = new Set([claim.page, claim.topic].filter(Boolean).map(normalizeName));
  for (const key of keys) {
    if (!claimSignals.has(key)) claimSignals.set(key, []);
    claimSignals.get(key).push(claim);
  }
}

const benchmarkSignals = new Map();
for (const question of benchmarks) {
  const keys = new Set([question.page, question.topic].filter(Boolean).map(normalizeName));
  for (const key of keys) {
    if (!benchmarkSignals.has(key)) benchmarkSignals.set(key, []);
    benchmarkSignals.get(key).push(question);
  }
}

const candidates = [];

for (const page of pages) {
  if (["index.md", "hot.md", "log.md"].includes(page.relativePath)) continue;

  const signals = [];
  const frontmatter = page.frontmatter;
  const hasSummary = Boolean(frontmatter.summary) || /^##\s+Summary\b/im.test(page.text);
  const hasSources =
    Boolean(frontmatter.source || frontmatter.sources) ||
    /^##\s+(Sources|References)\b/im.test(page.text);
  const inboundCount = inbound.get(page.relativePath) || 0;
  const pageKey = normalizeName(page.relativePath);
  const titleKey = normalizeName(page.title);
  const baseKey = normalizeName(path.basename(page.relativePath, ".md"));

  if (userTopic && (containsTopic(page.title, userTopic) || containsTopic(page.relativePath, userTopic))) {
    addSignal(signals, "user topic", 8, userTopic);
  }

  if (page.uncertainty) {
    const weight = page.uncertainty.kind === "conflict" ? 7 : page.uncertainty.score >= 8 ? 7 : 5;
    addSignal(
      signals,
      page.uncertainty.kind,
      weight,
      `${page.relativePath}:${page.uncertainty.line} ${page.uncertainty.text}`
    );
  }

  if (!hasSummary) addSignal(signals, "missing summary", 4);
  if (!hasSources && page.words > 150) addSignal(signals, "weak provenance", 4);
  if (page.words > 40 && page.words < 250) addSignal(signals, "thin page", 3, `${page.words} words`);
  if (inboundCount === 0 && !["index.md", "hot.md", "log.md"].includes(page.relativePath)) {
    addSignal(signals, "orphan page", 4);
  }

  if (containsTopic(hotText, page.title) || containsTopic(logText, page.title)) {
    addSignal(signals, "hot or recent", 3);
  }

  if (containsTopic(agendaText, page.title) || containsTopic(agendaText, page.relativePath)) {
    addSignal(signals, "research agenda", 4);
  }

  const pageAliases = new Set([pageKey, titleKey, baseKey]);
  const benchmarkIds = new Set();
  for (const alias of pageAliases) {
    for (const question of benchmarkSignals.get(alias) || []) {
      benchmarkIds.add(question.id || question.question);
    }
  }
  const benchmarkCount = benchmarkIds.size;
  if (benchmarkCount > 0) {
    addSignal(signals, "benchmark coverage", Math.min(3, benchmarkCount), `${benchmarkCount} questions`);
  }

  const unresolvedById = new Map();
  for (const alias of pageAliases) {
    for (const claim of claimSignals.get(alias) || []) {
      const id = `${claim.cycleId || ""}:${claim.page || ""}:${claim.claim || ""}`;
      unresolvedById.set(id, claim);
    }
  }
  const unresolvedClaims = Array.from(unresolvedById.values());
  if (unresolvedClaims.length > 0) {
    addSignal(
      signals,
      "claim map issue",
      Math.min(7, 3 + unresolvedClaims.length),
      `${unresolvedClaims.length} unresolved claims`
    );
  }

  const recent =
    recentDecisions.get(pageKey) || recentDecisions.get(titleKey) || recentDecisions.get(baseKey);
  if (recent?.decision === "discard" || recent?.decision === "quarantine") {
    const lessonText = [
      recent.rationale,
      ...(Array.isArray(recent.lessons) ? recent.lessons : []),
      ...(Array.isArray(recent.blocked) ? recent.blocked : []),
    ].join(" ");
    const hardBlock = /\b(do not retry|blocked|no source|no evidence|permission|wait|defer)\b/i.test(
      lessonText
    );
    addSignal(signals, "recently failed", hardBlock ? -22 : -8, recent.rationale || recent.cycleId);
  } else if (recent?.decision === "keep") {
    addSignal(signals, "recently improved", -2, recent.cycleId);
  }

  const score = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (score <= 0) continue;

  const primary = [...signals].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0];
  let cycleType = "maintenance";
  if (signals.some((signal) => ["conflict", "open_question", "question_heading"].includes(signal.label))) {
    cycleType = "research";
  } else if (signals.some((signal) => signal.label === "orphan page")) {
    cycleType = "connection";
  } else if (signals.some((signal) => signal.label === "claim map issue")) {
    cycleType = "research";
  }

  candidates.push({
    score,
    topic: page.title,
    cycleType,
    file: page.relativePath,
    line: page.uncertainty?.line || null,
    reason: primary ? `${primary.label}${primary.detail ? `: ${primary.detail}` : ""}` : "",
    signals,
  });
}

const rawBacklog = scoreRawBacklog();
if (rawBacklog) candidates.push(rawBacklog);

candidates.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.file !== b.file) return String(a.file || "").localeCompare(String(b.file || ""));
  return a.topic.localeCompare(b.topic);
});

const limited = candidates.slice(0, limit);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        vault: vaultPath,
        totalCandidates: candidates.length,
        candidates: limited,
      },
      null,
      2
    )
  );
} else {
  console.log("# Wiki Autoresearch Candidate Scores");
  console.log("");
  console.log(`- Vault: ${vaultPath}`);
  console.log(`- Total candidates: ${candidates.length}`);
  console.log(`- Showing: ${limited.length}`);
  if (userTopic) console.log(`- User topic boost: ${userTopic}`);
  console.log("");
  console.log("| Score | Cycle | Location | Topic | Reason |");
  console.log("|---:|---|---|---|---|");
  for (const candidate of limited) {
    const location = candidate.file
      ? `${candidate.file}${candidate.line ? `:${candidate.line}` : ""}`
      : "-";
    const cells = [
      String(candidate.score),
      candidate.cycleType,
      location,
      candidate.topic,
      candidate.reason,
    ].map((value) => String(value || "").replaceAll("|", "\\|"));
    console.log(`| ${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]} | ${cells[4]} |`);
  }
}
