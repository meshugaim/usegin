# Effi corpus

Cases, runs, baselines, and DoGs for AskEffi-product quality. What's special
about this corpus is the source: real Effi conversations from the
`conversations` Supabase bucket, already indexed by `is_error`, `storage_path`,
and `claude_session_id`.

## What "mental model" means here

Every Effi case has a mental model that is the actual state of the dogfooding
project at the time the conversation was recorded — the Drive documents, email
threads, and meeting notes that were indexed and available to Effi's retrieval
layer. The case does not embed this data; it references the session JSONL via
`source_uri`. The runner replays the structural properties of the recorded
session; it does not re-run Effi live against the data (v0 posture: trace-
replay, not live-replay).

This means Effi cases are backward-looking at v0: they assert that properties
of a recorded session hold (or failed to hold). The live-replay posture — where
the runner actually calls Effi with the original query and the original indexed
knowledge state — is a v1 target.

## Replay mode

**v0: trace-replay (mode 1).** The runner reads the session JSONL from the
`conversations` bucket, extracts the turn range specified in the case, and
asserts structural properties against the recorded output. No Anthropic API
call is made. No knowledge state re-hydration. Cost: near-zero per case.

**v1: live-replay (mode 3).** The runner re-runs the query through the live
Effi agent with the original knowledge state reconstructed. Requires budget
approval (cost: ~$0.10–0.30 per case per Opus judge call). Enables prompt
change evaluation on Effi's actual system prompt.

## Case sources

- **`is_error=TRUE` sessions** — the primary harvest source. Sessions where
  Effi returned an error, hallucinated, or failed to cite. Harvested via
  `dx evals harvest --source effi --is-error --since 14d` (v1 primitive;
  until then, pulled by hand from the conversations table).
- **Hand-picked happy-path** — 2–3 sessions where Effi answered well, used
  as calibration anchors and regression guards.
- **Friction zettels** — zettels that name a specific Effi failure (e.g.
  "Effi confabulated the owner when Drive doc had stale ACL") become cases
  by threading: case `origin: zettel`, `threads: [~zNNN]`.

## Case front-matter shape

```json
{
  "id": "effi-001-citation-test",
  "title": "Effi must cite the Drive doc when answering about project ownership",
  "origin": "session-audit",
  "threads": ["~z078", "~ENG-5612"],
  "created": "2026-04-28",
  "authored-by": "gin",
  "status": "active",
  "source": {
    "kind": "transcript",
    "uri": "conversations/<bucket-path>.jsonl.gz",
    "turn_range": [0, 4]
  },
  "mental_model": {
    "description": "Dogfooding project state as of 2026-04-10; Drive indexed, email indexed",
    "dataset_uri": "conversations/<session-id>/knowledge-snapshot.json"
  },
  "dog_ref": "effi/dogs/citation-faithful.md",
  "expected": {
    "citations_required": true,
    "no_pii": true,
    "tool_calls_must_include": ["search_documents"]
  }
}
```

## Governance

Effi cases are ship-grade. They reference real user sessions; handle with care.

- **Add:** Any team member or Gin may add a case. Gin additions require a
  companion `decisions-pending/` note if the case was auto-generated from
  an error harvest (Lihu reviews before the case is active).
- **Retire:** Lihu only. Set `status: retired`, `retired-at`, `retired-because`.
  Never delete.
- **Baseline bumps:** Lihu only. Commit message must name the reason.

## Prompts

`effi/prompts/` is where Effi's evaluable system prompts live. These are the
prompts that the eval runner compares across the matrix — they are canonical
reference prompts, not test fixtures.

| File | Purpose |
|------|---------|
| `baseline.md` | Default prompt used in all runs unless overridden. The current working version under active evaluation. |
| `strict-citations.md` | Stricter citation variant — every claim must be immediately cited. |
| `prod-snapshot-2026-04-28.md` | Read-only snapshot of `EFFI_SYSTEM_PROMPT` from production as of 2026-04-28. Run `--prompt prod-snapshot-2026-04-28` to reproduce production-baseline behavior. |

To add a new prompt: create `effi/prompts/<name>.md`, then reference it via
`--prompt <name>` or `--matrix prompt=<name>,…`.

Production code (`python-services/`) is read-only at v0. New prompt experiments
live here, in `effi/prompts/`. Apply winners back to production manually after
Lihu's sign-off.

## DoGs in this corpus

`effi/dogs/` contains one DoG doc per named goal:

- `citation-faithful.md` (S2) — Effi's answers must be faithful to cited
  sources. Three dimensions: `citation_present`, `citation_correct`,
  `claim_supported_by_citation`.

## Runs

Each run lands in `effi/runs/<YYYY-MM-DD-HHMM>-<suite>-<sha>/`. Contents:
- `summary.md` — human-readable table (one row per case, one column per
  metric, delta vs baseline row at bottom).
- `<case-id>.json` — full per-case verdict (inputs snapshot, structural
  scores, judge transcript, vibe flag).
- `meta.json` — run metadata: model, prompt version, judge selected, sha.

Run folders are committed. Sandbox iterate runs land in `sandbox/` (gitignored).
