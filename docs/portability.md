# Portability Notes

`wiki-autoresearch` is designed to be shareable, but it assumes an agent-maintained Obsidian LLM wiki rather than a plain Obsidian vault.

## What Should Work As-Is

- The core loop: select a gap, improve it, evaluate, keep/discard, record memory.
- The bundled Node scripts:
  - `find_uncertainty_markers.mjs`
  - `score_candidates.mjs`
  - `record_cycle.mjs`
- The `_system/autoresearch/` memory format.
- The eval prompts in `evals/evals.json`.

## What Other Users May Need To Adapt

### Skill Directory

Different agent environments use different skill directories. The only hard requirement is that `SKILL.md` sits at the root of the skill folder.

### Wiki Config

The skill first looks for:

```text
~/.obsidian-wiki/config
```

and falls back to `.env`.

Users can either create that config file or adapt the `Before You Start` section of `SKILL.md` to their own environment.

### Companion Skills

The skill refers to these related workflows:

- `wiki-status`
- `wiki-query`
- `wiki-research`
- `wiki-lint`
- `wiki-ingest`
- `data-ingest`
- `cross-linker`
- `wiki-synthesize`
- `tag-taxonomy`

If a user does not have those exact skills, they can still use `wiki-autoresearch` by mapping each named workflow to their local equivalent.

### Search Layer

The skill recommends `qmd` for local search over wiki and source collections. If a user does not use `qmd`, they can substitute `ripgrep`, Obsidian search, a vector database, or another local retrieval layer.

### Wiki Schema

The skill expects pages with:

- Markdown files in an Obsidian vault.
- Wiki links or another configured link format.
- Frontmatter containing at least title/category/tags/sources/summary where possible.
- A root `index.md`, optional `hot.md`, and append-only `log.md`.

Users with a flatter or more informal vault can still use the skill, but the health checks will be less precise until they add some structure.

## Recommended Sharing Language

Use wording like this in announcements:

> `wiki-autoresearch` is an agent skill for Obsidian LLM wikis. It runs bounded keep/discard improvement cycles over your vault: selecting gaps, improving one thing, evaluating wiki health, and recording memory so future runs compound.

Avoid presenting it as an Obsidian plugin or a general-purpose web research agent. Its value is specifically in maintaining a compiled, sourced, agent-readable wiki.
