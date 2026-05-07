#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/record_cycle.mjs <vault-path> --cycle <cycle.json> [--dry-run]",
      "  node scripts/record_cycle.mjs <vault-path> --init [--dry-run]",
      "",
      "Cycle JSON fields are intentionally permissive. Recommended fields:",
      "  runTag, cycleNumber, topic, candidate, cycleType, decision, rationale,",
      "  pagesCreated, pagesUpdated, sourcesAdded, healthDelta, benchmarkQuestions,",
      "  claims, lessons, nextCandidates, blocked",
    ].join("\n")
  );
  process.exit(2);
}

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
}

const vaultPath = path.resolve(args[0]);
let cyclePath = null;
let initOnly = false;
let dryRun = false;

for (let index = 1; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--cycle") {
    cyclePath = args[index + 1] ? path.resolve(args[index + 1]) : null;
    if (!cyclePath) usage();
    index += 1;
  } else if (arg === "--init") {
    initOnly = true;
  } else if (arg === "--dry-run") {
    dryRun = true;
  } else {
    usage();
  }
}

if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
  console.error(`Not a directory: ${vaultPath}`);
  process.exit(1);
}

if (!initOnly && !cyclePath) {
  usage();
}

const systemDir = path.join(vaultPath, "_system", "autoresearch");
const ledgerPath = path.join(systemDir, "cycles.jsonl");
const agendaPath = path.join(systemDir, "agenda.md");
const benchmarkPath = path.join(systemDir, "benchmark-questions.json");
const claimMapPath = path.join(systemDir, "source-claims.jsonl");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function slugify(value) {
  const slug = String(value || "cycle")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return slug || "cycle";
}

function stableId(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeBenchmark(question, record) {
  if (typeof question === "string") {
    return {
      topic: record.topic || "untitled",
      question,
    };
  }
  return {
    topic: question.topic || record.topic || "untitled",
    page: question.page || question.file || null,
    question: question.question || question.q || "",
    expectedEvidence: question.expectedEvidence || question.expected_evidence || null,
    notes: question.notes || null,
  };
}

function normalizeClaim(claim, record) {
  if (typeof claim === "string") {
    return {
      claim,
      topic: record.topic || null,
    };
  }
  return {
    claim: claim.claim || claim.statement || "",
    topic: claim.topic || record.topic || null,
    page: claim.page || claim.file || null,
    line: claim.line || null,
    sources: ensureArray(claim.sources || claim.source),
    scope: claim.scope || null,
    status: claim.status || "supported",
    confidence: claim.confidence || null,
    notes: claim.notes || null,
  };
}

function buildRecord(input) {
  const recordedAt = new Date().toISOString();
  const topic = input.topic || input.candidate?.topic || "Untitled cycle";
  const cycleId =
    input.cycleId ||
    `${recordedAt.slice(0, 10)}-${slugify(input.runTag || topic)}-${stableId(
      `${recordedAt}:${topic}:${input.cycleNumber || ""}`
    ).slice(0, 6)}`;

  return {
    schemaVersion: 1,
    cycleId,
    recordedAt,
    runTag: input.runTag || null,
    cycleNumber: input.cycleNumber || null,
    topic,
    candidate: input.candidate || null,
    cycleType: input.cycleType || input.type || null,
    decision: input.decision || "draft",
    rationale: input.rationale || "",
    pagesCreated: ensureArray(input.pagesCreated),
    pagesUpdated: ensureArray(input.pagesUpdated),
    sourcesAdded: ensureArray(input.sourcesAdded),
    filesTouched: ensureArray(input.filesTouched),
    healthDelta: input.healthDelta || {},
    benchmarkQuestions: ensureArray(input.benchmarkQuestions).map((question) =>
      normalizeBenchmark(question, { topic })
    ),
    claims: ensureArray(input.claims).map((claim) => normalizeClaim(claim, { topic })),
    lessons: ensureArray(input.lessons),
    nextCandidates: ensureArray(input.nextCandidates),
    blocked: ensureArray(input.blocked),
  };
}

function initializeFiles() {
  if (dryRun) return;
  fs.mkdirSync(systemDir, { recursive: true });
  if (!fs.existsSync(ledgerPath)) fs.writeFileSync(ledgerPath, "", "utf8");
  if (!fs.existsSync(claimMapPath)) fs.writeFileSync(claimMapPath, "", "utf8");
  if (!fs.existsSync(agendaPath)) {
    fs.writeFileSync(
      agendaPath,
      [
        "# Autoresearch Agenda",
        "",
        "This file is maintained by `wiki-autoresearch` runs. It captures promising next cycles,",
        "blocked questions, and lessons from discarded work so future runs do not start cold.",
        "",
      ].join("\n"),
      "utf8"
    );
  }
  if (!fs.existsSync(benchmarkPath)) {
    fs.writeFileSync(
      benchmarkPath,
      JSON.stringify({ schemaVersion: 1, questions: [] }, null, 2) + "\n",
      "utf8"
    );
  }
}

function appendLedger(record) {
  if (dryRun) return;
  fs.appendFileSync(ledgerPath, JSON.stringify(record) + "\n", "utf8");
}

function updateBenchmarkBank(record) {
  const bank = readJson(benchmarkPath, { schemaVersion: 1, questions: [] });
  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  const byId = new Map(questions.map((entry) => [entry.id, entry]));

  for (const question of record.benchmarkQuestions) {
    if (!question.question) continue;
    const id = stableId(`${question.topic}\n${question.page || ""}\n${question.question}`);
    const prior = byId.get(id);
    byId.set(id, {
      id,
      topic: question.topic,
      page: question.page || prior?.page || null,
      question: question.question,
      expectedEvidence: question.expectedEvidence || prior?.expectedEvidence || null,
      notes: question.notes || prior?.notes || null,
      createdAt: prior?.createdAt || record.recordedAt,
      lastUsedAt: record.recordedAt,
      lastCycleId: record.cycleId,
    });
  }

  if (!dryRun) {
    fs.writeFileSync(
      benchmarkPath,
      JSON.stringify({ schemaVersion: 1, questions: Array.from(byId.values()) }, null, 2) + "\n",
      "utf8"
    );
  }
}

function appendClaimMap(record) {
  if (dryRun || record.claims.length === 0) return;
  const lines = record.claims
    .filter((claim) => claim.claim)
    .map((claim) =>
      JSON.stringify({
        schemaVersion: 1,
        cycleId: record.cycleId,
        recordedAt: record.recordedAt,
        ...claim,
      })
    );
  if (lines.length > 0) {
    fs.appendFileSync(claimMapPath, lines.join("\n") + "\n", "utf8");
  }
}

function appendAgenda(record) {
  if (dryRun) return;
  const lines = [
    `## ${record.recordedAt.slice(0, 10)} - ${record.topic}`,
    "",
    `- Cycle: ${record.cycleId}`,
    `- Outcome: ${record.decision}${record.rationale ? ` - ${record.rationale}` : ""}`,
  ];

  if (record.nextCandidates.length > 0) {
    lines.push("- Next candidates:");
    for (const candidate of record.nextCandidates) {
      const text =
        typeof candidate === "string"
          ? candidate
          : `${candidate.topic || candidate.file || "candidate"}${
              candidate.reason ? ` - ${candidate.reason}` : ""
            }`;
      lines.push(`  - ${text}`);
    }
  }

  if (record.blocked.length > 0) {
    lines.push("- Blocked:");
    for (const item of record.blocked) lines.push(`  - ${typeof item === "string" ? item : JSON.stringify(item)}`);
  }

  if (record.lessons.length > 0) {
    lines.push("- Lessons:");
    for (const lesson of record.lessons) {
      lines.push(`  - ${typeof lesson === "string" ? lesson : JSON.stringify(lesson)}`);
    }
  }

  lines.push("");
  fs.appendFileSync(agendaPath, lines.join("\n"), "utf8");
}

initializeFiles();

if (initOnly) {
  console.log(
    JSON.stringify(
      {
        vault: vaultPath,
        dryRun,
        files: { systemDir, ledgerPath, agendaPath, benchmarkPath, claimMapPath },
      },
      null,
      2
    )
  );
  process.exit(0);
}

const input = JSON.parse(fs.readFileSync(cyclePath, "utf8"));
const record = buildRecord(input);

if (!["keep", "discard", "quarantine", "draft"].includes(record.decision)) {
  console.error("decision must be one of: keep, discard, quarantine, draft");
  process.exit(1);
}

appendLedger(record);
updateBenchmarkBank(record);
appendClaimMap(record);
appendAgenda(record);

console.log(
  JSON.stringify(
    {
      dryRun,
      record,
      files: { ledgerPath, agendaPath, benchmarkPath, claimMapPath },
    },
    null,
    2
  )
);
