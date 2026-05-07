# Autoresearch Data Files

`wiki-autoresearch` stores its reusable memory in
`$OBSIDIAN_VAULT_PATH/_system/autoresearch/`. These files are operational metadata for the wiki; they are
not public knowledge pages.

## Files

| File | Purpose |
|---|---|
| `cycles.jsonl` | Append-only ledger of every keep/discard/quarantine/draft cycle. |
| `benchmark-questions.json` | Reusable questions that important topics should answer well. |
| `source-claims.jsonl` | Sparse source-to-claim map for important, disputed, stale, or subtle claims. |
| `agenda.md` | Human-readable queue of next candidates, blocked questions, and lessons. |

## Cycle JSON

Pass a small JSON file to `scripts/record_cycle.mjs` after each cycle:

```json
{
  "runTag": "2026-05-03-open-questions",
  "cycleNumber": 1,
  "topic": "Example topic",
  "candidate": {
    "score": 12,
    "file": "concepts/example.md",
    "line": 42,
    "reason": "open_question: needs source"
  },
  "cycleType": "research",
  "decision": "keep",
  "rationale": "Resolved a concrete open question with primary sources.",
  "pagesCreated": ["references/example-source.md"],
  "pagesUpdated": ["concepts/example.md", "log.md"],
  "sourcesAdded": ["https://example.com/source"],
  "healthDelta": {
    "openQuestions": "-1",
    "provenanceConcerns": "-1"
  },
  "benchmarkQuestions": [
    {
      "topic": "Example topic",
      "page": "concepts/example.md",
      "question": "What should the wiki now answer?",
      "expectedEvidence": "The answer cites the updated concept page and source summary."
    }
  ],
  "claims": [
    {
      "claim": "Important scoped claim worth verifying later.",
      "page": "concepts/example.md",
      "sources": ["references/example-source.md"],
      "scope": "Applies to the 2026 version only.",
      "status": "supported",
      "confidence": "high"
    }
  ],
  "lessons": ["Primary source names are more reliable than secondary summaries for this topic."],
  "nextCandidates": [
    {
      "topic": "Follow-up topic",
      "reason": "The source introduced a related unresolved question."
    }
  ],
  "blocked": []
}
```

`decision` must be one of `keep`, `discard`, `quarantine`, or `draft`.

## Benchmark Questions

Use benchmark questions to make improvement measurable. Good questions are stable, answerable from the
wiki, and sensitive to whether the cycle actually improved retrieval or synthesis.

Prefer questions like:

- "What evidence supports X, and what scope does it apply to?"
- "How does X relate to Y in this project?"
- "What remains unresolved about X?"

Avoid questions whose answer is only "yes/no" unless the yes/no answer requires specific citations.

## Source-Claim Map

Record claims sparingly. A claim belongs in `source-claims.jsonl` when at least one is true:

- It resolved or preserved a conflict.
- It is likely to become stale.
- It depends on date, geography, software version, source scope, or terminology.
- It is central enough that a future answer should cite it.

Use `status: "supported"` for normal claims, `status: "conflict"` or `"disputed"` for competing claims,
`status: "unverified"` when the claim remains plausible but unsettled, and `status: "stale"` when it
needs periodic rechecking.

## Discarded Cycles

A discarded cycle should teach the next run something. Include:

- the failed candidate or attempted question
- why it failed
- what source or permission would unblock it
- whether future runs should avoid the topic, defer it, or reframe it

The candidate scorer penalizes recent discarded or quarantined candidates so the loop does not keep
walking into the same wall.
