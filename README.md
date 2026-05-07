# Wiki Autoresearch Skill

An agent skill for running Karpathy-style autoresearch loops over an Obsidian LLM wiki.

Instead of optimizing a model training script, this skill optimizes a knowledge base: it selects one high-value wiki gap, improves it with the narrowest relevant wiki workflow, evaluates whether the wiki became more useful, and keeps, discards, or quarantines the change.

## Background References

This project combines two related patterns:

- [karpathy/autoresearch](https://github.com/karpathy/autoresearch) - Andrej Karpathy's original autonomous research loop for small, measurable LLM training experiments.
- [karpathy/llm-wiki.md](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) - the original LLM Wiki idea file for LLM-maintained, compounding markdown knowledge bases.
- [Ar9av/obsidian-wiki](https://github.com/Ar9av/obsidian-wiki) - an Obsidian-focused implementation of the Karpathy LLM Wiki pattern using agent-readable skill files.

## What It Does

`wiki-autoresearch` helps an agent:

- Find gaps such as open questions, contradictions, weak provenance, orphaned pages, missing summaries, stale claims, or missing synthesis pages.
- Choose one reviewable cycle type: research, backlog distillation, connection repair, synthesis, or maintenance.
- Use existing wiki skills such as `wiki-query`, `wiki-research`, `wiki-ingest`, `wiki-lint`, `cross-linker`, `wiki-synthesize`, and `tag-taxonomy`.
- Evaluate the before/after state using wiki health checks, provenance, links, retrieval quality, and benchmark questions.
- Record reusable memory in `_system/autoresearch/` so later runs compound instead of starting cold.

## Who This Is For

This is for people who maintain an Obsidian-based LLM wiki with an agent such as Codex or Claude Code.

It is not an Obsidian plugin. It is a skill/runbook plus helper scripts for an agent environment that supports `SKILL.md` files and bundled resources.

## Repository Layout

```text
.
├── SKILL.md
├── scripts/
│   ├── find_uncertainty_markers.mjs
│   ├── record_cycle.mjs
│   └── score_candidates.mjs
├── references/
│   └── autoresearch-data-files.md
├── evals/
│   └── evals.json
├── docs/
│   ├── portability.md
│   └── publish-from-vscode.md
└── package.json
```

## Requirements

- An agent environment that can load skills from a directory containing `SKILL.md`.
- Node.js 18 or newer for the helper scripts.
- An Obsidian vault following a Karpathy-style LLM wiki pattern.
- A wiki config file at `~/.obsidian-wiki/config` or a compatible `.env`.
- Companion wiki skills or equivalent workflows for querying, ingesting, linting, research, linking, synthesis, and tag normalization.
- Optional but recommended: `qmd` or another local search layer for hybrid wiki/source retrieval.

Example config:

```bash
OBSIDIAN_VAULT_PATH="/path/to/your/wiki"
OBSIDIAN_RAW_DIR="/path/to/raw/sources"
OBSIDIAN_LINK_FORMAT="wikilink"
QMD_WIKI_COLLECTION="wiki"
QMD_PAPERS_COLLECTION="papers"
```

## Install

Clone or copy this repository into your agent's skills directory.

For example, in one local setup:

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/YOUR-USERNAME/wiki-autoresearch.git ~/.agents/skills/wiki-autoresearch
```

If your agent uses a different skill directory, put the cloned repository there instead. The important part is that `SKILL.md` remains at the root of the skill folder.

## Use

Example prompts:

- "Run one autoresearch cycle on my wiki."
- "Autoresearch my open questions and contradictions."
- "Use my raw clippings backlog to improve the wiki for a while, but keep it reviewable."
- "Continue autoresearch from the last run and choose the next best cycle."
- "Run an overnight autoresearch loop on the wiki."

The skill defaults to bounded runs:

- Interactive: 1 cycle.
- "For a while": 3 cycles.
- "Overnight" or "autonomous": 8 cycles.

It should not run indefinitely.

## Helper Scripts

Run a quick syntax check:

```bash
npm run check
```

Find explicit uncertainty markers in a vault:

```bash
node scripts/find_uncertainty_markers.mjs "$OBSIDIAN_VAULT_PATH" --limit 30
```

Score candidate pages for an autoresearch cycle:

```bash
node scripts/score_candidates.mjs "$OBSIDIAN_VAULT_PATH" --limit 20
```

Initialize or update autoresearch memory:

```bash
node scripts/record_cycle.mjs "$OBSIDIAN_VAULT_PATH" --init
node scripts/record_cycle.mjs "$OBSIDIAN_VAULT_PATH" --cycle /path/to/cycle.json
```

## Safety Model

The skill is intentionally conservative:

- Prefer one topic per cycle.
- Prefer updating existing pages over creating duplicates.
- Use a git branch or file backup before vault edits.
- Keep quoted sensitive material minimal.
- Mark unresolved conflicts instead of flattening uncertainty into false certainty.
- Keep a ledger entry for kept, discarded, quarantined, and draft cycles.

## Portability

This skill was extracted from a personal wiki setup, so some names are opinionated. See [docs/portability.md](docs/portability.md) for what other users may need to adapt.

## License

MIT. See [LICENSE](LICENSE).
