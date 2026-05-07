---
name: wiki-autoresearch
description: >
  Run an autoresearch-style improvement loop over the user's Obsidian LLM wiki. Use this skill whenever
  the user asks to "autoresearch" the wiki, improve the wiki autonomously, run overnight wiki research,
  fill wiki gaps, resolve open questions or conflicting statements, mine the raw backlog for research
  targets, or build a repeating research loop around the installed wiki skills. This skill orchestrates
  wiki-status, wiki-query, wiki-research, wiki-lint, cross-linker, wiki-synthesize, and tag-taxonomy into
  budgeted keep/discard research cycles. It maintains an autoresearch ledger, benchmark question bank,
  source-claim map, and research agenda so each run compounds what future runs know.
---

# Wiki Autoresearch

You are running an autonomous, budgeted improvement loop over an Obsidian LLM wiki. This adapts the
`autoresearch` pattern: propose a small experiment, make the wiki better, measure whether it improved,
keep the change if it helped, and discard or quarantine it if it did not.

The goal is not to create more notes. The goal is to make the wiki more useful, sourced, connected,
queryable, and trustworthy.

## Core Pattern

Each cycle has one research hypothesis:

1. Select one gap in the wiki.
2. Improve it using the narrowest relevant wiki skill.
3. Evaluate the result with lint, linking, provenance, and retrieval checks.
4. Keep the change only when the wiki is healthier or more useful.
5. Record the cycle in the autoresearch ledger so future cycles learn from it.

Prefer short, reviewable cycles over giant unattended rewrites.

## Before You Start

1. Read `~/.obsidian-wiki/config` first, falling back to `.env`, to get:
   - `OBSIDIAN_VAULT_PATH`
   - `OBSIDIAN_RAW_DIR`
   - `OBSIDIAN_LINK_FORMAT`
   - `QMD_WIKI_COLLECTION`
   - `QMD_PAPERS_COLLECTION`
2. Read `$OBSIDIAN_VAULT_PATH/index.md`.
3. Read `$OBSIDIAN_VAULT_PATH/hot.md` if it exists.
4. Read `$OBSIDIAN_VAULT_PATH/log.md` for recent operations.
5. Read `$OBSIDIAN_VAULT_PATH/references/research-config.md` if it exists.
6. Use `qmd status` or the QMD MCP status to see available wiki/source collections.
7. Follow the Retrieval Primitives section in `llm-wiki/SKILL.md`: start with indexes, summaries,
   frontmatter, and targeted greps before reading whole pages.
8. Check whether `$OBSIDIAN_VAULT_PATH/_system/autoresearch/` exists. If it does not, initialize it
   after the safety checkpoint.
9. Read `$OBSIDIAN_VAULT_PATH/_system/autoresearch/agenda.md` if it exists.
10. Read recent entries from `$OBSIDIAN_VAULT_PATH/_system/autoresearch/cycles.jsonl` if it exists.
11. Read `$OBSIDIAN_VAULT_PATH/_system/autoresearch/benchmark-questions.json` if it exists.
12. For open-question or conflict discovery, run the bundled uncertainty scanner:
   `node <skill-dir>/scripts/find_uncertainty_markers.mjs "$OBSIDIAN_VAULT_PATH" --limit 30`
13. Consult `tag-taxonomy` before assigning new tags to wiki pages.

## Compounding Files

Autoresearch runs should leave behind useful memory, not just changed pages. Maintain these files under
`$OBSIDIAN_VAULT_PATH/_system/autoresearch/`:

- `cycles.jsonl`: one JSON record per cycle, including candidate, decision, scorecard, benchmark questions,
  changed pages, claims, lessons, and next candidates.
- `benchmark-questions.json`: reusable questions for important topics and pages. Prefer reusing existing
  questions before inventing new ones.
- `source-claims.jsonl`: a sparse map of important, disputed, stale, or non-obvious claims to their sources,
  scope, status, and page location. Do not try to map every sentence.
- `agenda.md`: a readable queue of promising next cycles, blocked questions, and lessons from discarded work.

Use `scripts/record_cycle.mjs` after every cycle to update these files from a small cycle JSON draft:

```bash
node <skill-dir>/scripts/record_cycle.mjs "$OBSIDIAN_VAULT_PATH" --cycle /path/to/cycle.json
```

See `references/autoresearch-data-files.md` for the cycle JSON shape and examples.

## Run Scope

If the user did not specify a budget, choose a conservative default:

- **Interactive run:** 1 cycle.
- **"Run for a while":** 3 cycles.
- **"Overnight" or "autonomous":** 8 cycles, then stop and report.
- **Explicit schedule/reminder request:** create an automation instead of pretending this turn can run forever.

Do not run indefinitely. Unlike the original code autoresearch loop, a personal wiki is a knowledge base;
reviewability matters more than raw iteration count.

## Safety Checkpoint

Before modifying the vault:

1. Check whether `$OBSIDIAN_VAULT_PATH` is a git repo.
2. If it is a git repo, record the current branch and status. Create a branch named
   `wiki-autoresearch/<YYYY-MM-DD>-<topic-or-run-tag>` unless the user requested direct edits.
3. If it is not a git repo, create a timestamped backup of every file you will edit under:
   `$OBSIDIAN_VAULT_PATH/_archives/wiki-autoresearch/<run-tag>/before/`
4. Never rewrite `_archives/`.
5. Never ingest or expose secrets. If sources contain credentials, personal identifiers, private email,
   or tokens, tag resulting pages with `visibility/internal` or `visibility/pii` as appropriate and keep
   quoted material minimal.
6. After the branch or backup exists, initialize the compounding files if needed:
   `node <skill-dir>/scripts/record_cycle.mjs "$OBSIDIAN_VAULT_PATH" --init`

When the environment prevents writing outside the current workspace, draft the run plan and proposed
changes in the workspace, then ask for permission before applying changes to the vault.

## Gap Selection

Build a candidate list from the cheapest available signals:

- `wiki-status`: new or modified raw sources, unprocessed clippings, recent activity.
- `wiki-lint`: orphan pages, broken links, missing summaries, stale pages, provenance drift, fragmented tags.
- `wiki-query`: topics the wiki answers weakly or only from raw sources.
- `wiki-synthesize`: concepts that co-occur but lack a synthesis page.
- `qmd` source collection: raw documents with no distilled wiki page.
- Bundled uncertainty scanner: pages with `Open questions`, `Unresolved`, `Needs verification`,
  `Conflicts`, `Contradictions`, `Disputed`, `TODO`, `FIXME`, `VERIFY`, `citation needed`,
  `sources disagree`, or similar uncertainty markers.
- Autoresearch memory: prior kept/discarded cycles, benchmark question coverage, unresolved source claims,
  and the research agenda.

Start with the bundled scorer unless the user explicitly asked for a specific target:

```bash
node <skill-dir>/scripts/score_candidates.mjs "$OBSIDIAN_VAULT_PATH" --limit 20
```

Add `--user-topic "<topic>"` when the user named a topic. Add `--json` when the output will be merged into
a cycle scorecard. Treat the scorer as a ranked queue, not an oracle: read the top candidate's surrounding
context before editing.

Rank candidates with this heuristic:

| Signal | Weight |
|---|---:|
| User explicitly mentioned the topic | +8 |
| Page contains a concrete open question that can be investigated | +7 |
| Page contains conflicting sourced statements or explicit contradiction markers | +7 |
| Many raw sources but few wiki pages | +5 |
| Existing page has missing summary or weak provenance | +4 |
| Orphan/thin page can be connected to existing hubs | +4 |
| Topic appears in `agenda.md` as a promising next cycle | +4 |
| Source-claim map marks a claim as disputed, stale, or unverified | +4 to +7 |
| Topic appears in `hot.md` or recent `log.md` entries | +3 |
| Topic has reusable benchmark questions | +1 to +3 |
| Open question is vague, philosophical, or not answerable by sources | -4 |
| Topic would duplicate an already strong synthesis page | -6 |
| Similar candidate was recently discarded or quarantined | -6 |
| Topic requires sensitive/PII-heavy sources without user approval | -8 |

Pick the top candidate that can be improved in one cycle.

## Bundled Uncertainty Scanner

Use `scripts/find_uncertainty_markers.mjs` as the deterministic first pass for open questions and
conflicts:

```bash
node <skill-dir>/scripts/find_uncertainty_markers.mjs "$OBSIDIAN_VAULT_PATH" --limit 30
```

The scanner prints a ranked table of candidate lines with score, kind, file, line, marker, and text. It
skips `.obsidian`, `_archives`, `_raw`, and other noisy folders by default. Add `--include-raw` only when
the cycle is intentionally mining raw sources. Add `--json` when a structured output is easier to merge
into a scorecard.

Treat scanner results as leads, not proof. Read the surrounding page context before choosing a cycle, and
prefer candidates that can be answered or clarified within one reviewable cycle.

## Open Questions And Conflicts

Treat explicit uncertainty as a high-value research target, not as mere lint. The wiki is more trustworthy
when unresolved questions and contradictory claims are either resolved with sources or preserved clearly
as still unresolved.

Before choosing `wiki-research`, determine what kind of uncertainty you found:

- **Open question:** a page asks something answerable, such as a missing date, unclear cause, unknown
  relationship, unverified implementation detail, or "needs source" claim.
- **Conflict:** two or more pages, sources, or sections make claims that cannot all be true under the
  same scope and date.
- **Apparent conflict:** statements look inconsistent but may differ by terminology, time period,
  geography, version, source scope, or level of abstraction.

Use `wiki-query` and QMD search first to see whether the answer already exists in the vault or raw source
collections. Call `wiki-research` when the question requires sources outside the current vault, when the
existing sources disagree, or when the likely answer depends on recent or authoritative external evidence.

When handling conflicts, do not simply delete one side or choose the newest-looking claim. Capture the
competing statements, their pages, their provenance, and the date or scope each source applies to. Resolve
the conflict only when the evidence is strong enough; otherwise update the relevant page to state what is
known, what remains unresolved, and what source would settle it.

## Cycle Types

Choose one cycle type. Do not mix all of them at once.

### 1. Research Cycle

Use when the wiki has a topical gap, a concrete open question, conflicting statements that need outside
evidence, or the user asked for external research.

1. Frame the target as a focused research question or conflict to resolve.
2. Run `wiki-research` on the selected topic.
3. Prefer primary sources, official docs, papers, and authoritative references.
4. Write source, concept, entity, and synthesis pages following `wiki-research`.
5. Merge with existing pages instead of creating duplicates.
6. Update the originating page: answer the open question, reconcile the conflict, or mark why it remains
   unresolved.
7. Update `index.md`, `log.md`, `hot.md`, and `.manifest.json`.

### 2. Backlog Distillation Cycle

Use when QMD or `wiki-status` shows raw sources already exist in `_raw`, `Inbox`, or `Clippings`.

1. Select a small batch of related raw sources.
2. Use `wiki-ingest` or `data-ingest` depending on source shape.
3. Distill into durable concept/entity/skill/reference/synthesis pages.
4. Preserve source paths in frontmatter.
5. Update tracking files.

### 3. Connection Cycle

Use when the wiki has orphaned pages, fragmented tag clusters, or recent ingest output.

1. Run `wiki-lint` to identify structural gaps.
2. Run `cross-linker` on the relevant subset.
3. Add conservative links only where the relationship is extracted or well-supported.
4. Update `log.md` and `hot.md`.

### 4. Synthesis Cycle

Use when several pages repeatedly mention the same pair or cluster of concepts but no synthesis page exists.

1. Run `wiki-synthesize` to identify the strongest opportunity.
2. Create or update one synthesis page.
3. Mark inferred connections with `^[inferred]`.
4. Link back to all supporting pages and sources.

### 5. Maintenance Cycle

Use when the main problem is stale metadata, summaries, tag drift, or broken links.

1. Run the relevant subset of `wiki-lint`.
2. Fix only issues directly tied to the selected candidate.
3. Normalize tags through `tag-taxonomy`.
4. Do not perform broad restyling.

## Evaluation

At the start and end of each cycle, capture a small scorecard:

```markdown
## Cycle Scorecard
- Topic:
- Cycle type:
- Pages created:
- Pages updated:
- Sources added:
- Orphans before/after:
- Broken links before/after:
- Missing summaries before/after:
- Provenance concerns before/after:
- Open questions before/after:
- Conflicts before/after:
- Benchmark questions:
  - Q:
  - Before:
  - After:
- Claims recorded:
- Keep/discard decision:
- Rationale:
```

Use 2-3 benchmark questions for research or synthesis cycles. Reuse questions from
`benchmark-questions.json` when they fit; otherwise add new questions that the improved wiki should now
answer better. Use `wiki-query` or QMD search before and after; the after answer should cite more relevant
wiki pages, sources, or clearer synthesis.

Record only high-value claims in the source-claim map: conflict resolutions, claims likely to go stale,
claims with subtle scope or date constraints, and claims that future runs may need to verify. Store the
claim text, page, sources, scope, status, and confidence in the cycle JSON passed to `record_cycle.mjs`.

## Keep / Discard Rules

Keep a cycle when at least one is true:

- It creates a well-sourced synthesis, concept, entity, skill, or reference page that fills a real gap.
- It improves benchmark answers with better citations or clearer provenance.
- It resolves a concrete open question or conflict with clear source-backed evidence.
- It reduces orphans, broken links, missing summaries, stale pages, or fragmented clusters.
- It merges duplicate knowledge into a stronger existing page.

Discard, revert, or quarantine the cycle when any is true:

- It creates duplicate pages instead of merging.
- It adds unsourced factual claims without provenance markers.
- It silently removes open questions or conflicting claims instead of resolving or preserving them.
- It worsens broken links or leaves index/manifest/log inconsistent.
- It spreads sensitive material into public pages.
- It mostly adds generic summaries that do not improve queries or graph structure.

If the vault is not under git and discard is needed, restore edited files from the cycle backup.

Discarded work should still compound. When discarding or quarantining a cycle, record why it failed,
what evidence was missing, and what future candidate should avoid or wait for. Never silently drop a
failed experiment from the ledger.

## Output Report

After the run, report:

```markdown
## Wiki Autoresearch Report

### Run
- Tag:
- Budget:
- Cycles completed:

### Changes Kept
- ...

### Changes Discarded Or Quarantined
- ...

### Wiki Health Delta
- ...

### Resolved Questions Or Conflicts
- ...

### New Pages
- ...

### Updated Pages
- ...

### Recommended Next Cycles
- ...

### Autoresearch Memory Updated
- Ledger:
- Benchmark questions:
- Source claims:
- Agenda:
```

Keep the report short enough that the user can decide whether to continue.

## Good Defaults

- Default to `OBSIDIAN_LINK_FORMAT=wikilink` when config is absent.
- Prefer one topic per cycle.
- Prefer updating existing pages over creating new pages.
- Prefer `references/` pages for source summaries and `synthesis/` pages for cross-source conclusions.
- Prefer source-backed claims over clever inferences.
- Prefer recording reusable cycle memory over relying on the final chat report.
- Prefer explicit open questions and conflicting statements as research targets when they are answerable
  within one cycle.
- Prefer sparse, high-signal source-claim records over exhaustive claim extraction.
- Mark every non-obvious synthesis with `^[inferred]`.
- If a conflict remains unresolved, preserve the competing claims, scope, and next evidence needed instead
  of flattening the page into false certainty.
- Stop early if the first cycle reveals configuration problems, missing vault paths, or write permission issues.
