# Dispatch — Slack Ingestion POC (overnight, autonomous)

**Date:** 2026-04-28 (Oria asleep; liaison Zisser owns the night)
**Origin:** peer Zisser (Oria's pre-sleep dispatch)
**Type:** liaison run with sub-Zisser team

## Verbatim charter

(See full text in the dispatching turn — preserved in `agent-records/`
session JSONL and in this run's transcript. Key elements distilled
into `usegin/oria-crazy-space/poc-reports/whiteboard-slack-ingest.md`.)

## Goal (what)

Working ingestion pipeline by morning:
Slack messages → canonical normalizer → isolated index → query with
citation. Real wire where possible (auth + list), fixtures from S2 on
(history blocked). Honest morning report at
`usegin/oria-crazy-space/poc-reports/2026-04-29-slack-ingest.md`.

## How (mine)

- Build under `usegin/oria-crazy-space/slack-ingest-poc/`
- Reuse `experiments/slack-direct/lib/` read primitives + treat its test
  files as the fixture corpus
- Parallel JSONL index, NOT production Effi (charter parks Effi)
- Sequential slices S0 → S8, commit + push per slice
- Sub-Zissers as peer agents talking via the whiteboard:
  Wes-Builder, Ron-Reviewer, Tim-Verifier, John-Pessimist, Sam-Synth

## Stop conditions (charter-set)

- Touching production code → halt + polaroid
- Touching parked Slack code → halt + polaroid
- Missing auth that needs human → halt + polaroid
- 3 same-root failures at one slice → tikur + halt

## Open questions (non-blocking, for morning report)

- ↑ Want E2E against real Effi after this lands, or stay parallel-store?

## Sub-dispatches (chartered in this directory)

- `2026-04-28-slack-ingest-poc-wes-S1.md` — Wes-Builder, S1 slice
- (more added as the night progresses)

## Status

**RESUMED + COMPLETED inline.** Initial halt at S0→S1 was based on
"no Agent/Task tool" + "8 inline serial slices is too much for one
context window."  A peer-Zisser charter update mid-run unblocked the
live wire (Oria's `/invite` had landed; bot now `is_member=True` in
`#social`; `conversations.history` returns the 8 real messages).

With live data + recorded ground-truth shapes, scope shrunk to ~5
small inline slices, which fit. Pipeline is end-to-end working:

- `bash scripts/probe-live.sh` — auth/list/history all `ok=True`
- `bash scripts/run-e2e.sh` — fetches 8 messages, indexes, queries
  for `ENG-5399`, `הקוד`, `TODO`, `api.slack.com` — all hit with
  proper `#social @ <ts> (<user_id>)` citation
- `uv run pytest tests/` — 33/33 passing (unit + E2E fixture tests)

**Original halt reasoning preserved (for the cluster check):** Agent
tool unavailable in Zisser sub-agent contexts is a real, repeated
finding — see `zisser/log/2026-04.md` two entries on 2026-04-28.
The fix-the-dispatch-shape candidate stands: future multi-agent
charters dispatched to Zisser-as-sub-agent should expect inline
serial execution, not sub-Zisser parallelism.

### Original halt reasoning (preserved for history)

The charter assumes I can spawn sub-Zissers (Wes/Ron/Tim/John/Sam) via
the `Agent` tool. The Agent/Task tool is NOT available in this
sub-agent context (ToolSearch confirms: no `Agent`/`Task` deferred,
only `TaskStop` and `EnterWorktree` for the spawn family). Matched
prior 2026-04-28 persona-investigation finding.

The charter's value is the parallel sub-Zisser shape; serial inline
8-slice execution on a single context window will hit context/turn
limits before reaching S6 E2E or the morning report — and the charter's
norma 1 (process over outcome) prefers an honest halt to a half-finished
silent run.

**Foundation is durable; next run can resume cleanly:**
- Whiteboard with verified Slack live state (bot auth ok, channels
  listed, `not_in_channel` blocking history)
- README + directory plan
- Polaroid at `usegin/memento/scopes/slack-ingest-poc/latest.md`
- Identified fixture corpus: `experiments/slack-direct/tests/
  test_messages_normalize.py` (real-shape JSON literals, no need to
  manufacture)
- Identified reusable read primitives: `experiments/slack-direct/lib/`

**Next-step recommendation:** re-run from a parent-harness that
exposes Agent/Task (main session), OR scope inline to S1+S3 only
(live auth + normalizer-with-fixtures) — the smallest delta that
proves shape.
