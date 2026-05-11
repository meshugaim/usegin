---
authored: 2026-05-11
status: experiment complete — see findings
references:
  - PLAN.md (success criteria)
  - runs/2026-05-11T11-31-17Z/ (the one successful run)
---

# Results — exp 004 offline-processor prototype

The prototype produces accurate, zero-hallucination, well-confidence-calibrated
proposals on first run. On retries with a slightly larger delta, the production
`effi ask` endpoint drops the streaming socket mid-tool-use and the run fails.
The accuracy finding stands; the reliability finding is the load-bearing signal
for v1 architecture.

## Headline

- **The synthesis approach works.** 11 proposals from 4 new artifacts, 13/13
  citations resolved, all five PLAN.md success criteria met (see scoring
  below). Runtime 146s, cost $0.28 — both inside the budgets.
- **The transport doesn't.** Of N=5 subsequent attempts (5 delta items, same
  shape prompt), all five failed with `socket connection was closed
  unexpectedly` after Effi's parallel artifact-retrieval phase. 3-attempt retry
  with 2s/4s backoff did not recover any of them.
- **Implication for v1.** The offline processor should not depend on
  `effi ask` CLI as its synthesis layer. v1 architecture should either
  (a) call Anthropic API directly with pre-fetched artifact bodies, or
  (b) talk to a dedicated internal Effi endpoint not subject to the
  consumer-chat streaming proxy.

## Success criteria scoring (from PLAN.md §"Success criteria")

The PLAN required 3 of 5 to hold for success; **all 5 hold** in the one
successful run.

| # | Criterion | Result |
|---|---|---|
| 1 | Zero hallucinated citations | ✅ 13/13 resolved (8 to delta items, 5 to existing note anchors) |
| 2 | Correctly identifies cadence shifts | ✅ Guy `last_email` Mar 8→May 11; Nitsan `last_email` May 8→May 9; both with correct citing artifact |
| 3 | Does not propose changes where none warranted | ✅ 8 explicit `no-change` rows with absence-of-evidence rationale per person |
| 4 | Confidence scores correlate with correctness | ✅ Roi Zamir new-person flagged `low` (genuinely borderline editorial call); two updates flagged `high` (clear evidence); 8 no-changes `high` (well-founded absence) |
| 5 | Synthesis runtime < 5 minutes | ✅ 146s end-to-end including stages 1+2+4+5; Effi synthesis call itself ~135s |

Cost: **$0.28** vs the PLAN.md estimate of ~$0.50. At 17 topics × daily this
extrapolates to **~$4.80/day**, comfortably under the $8/day plan estimate.
The cache_creation_input_tokens count was 32K — close to the 30K target.

## What the one successful run actually produced

`runs/2026-05-11T11-31-17Z/proposal.md` (full text checked in only as a
gitignored run artifact). Summary:

- **2 last-email updates** — both legitimate, both with single-citation
  evidence, both at high confidence.
- **1 new-person at low confidence** — Roi Zamir, an external Israeli IT
  consultancy connector who replied to Guy's ICP brief. Correctly flagged
  as a "human call on scope" rather than auto-added.
- **8 explicit no-change rows** — one per tracked person/group not appearing
  in the new artifacts. Each gives the reason ("does not appear in any of
  the four new artifacts" or, for Lihu/Efrat, "appears as passive recipient
  / passive reference, no authoring activity").
- **No headline shifts** proposed — the model judged 3 days of low-volume
  activity not enough to amend the headline-shifts paragraph.

The proposal is something a human reviewer could apply almost verbatim. The
two updates would be merged; the new-person would prompt a question ("does
this person belong in `activity.md` or `prospects.md`?"); the no-changes
would be confirmed silently.

## What broke — reliability

After the first successful run, every subsequent attempt failed. Pattern:

```
[stage 3] synthesize — effi ask --new --json
  Retrieving all 5 new artifacts in parallel before forming any proposals.
  Error: The socket connection was closed unexpectedly.
```

Effi's response begins with a tool-use phase ("Retrieving all 5 new
artifacts in parallel"). The streaming socket drops during/after this phase
on the production `app.askeffi.ai` endpoint. We added a 3-attempt retry
with 2s/4s backoff on transient stderr markers; it did not help —
subsequent attempts hit the same drop.

This matches the known failure mode documented in the prior session's
handoff (per-topic extractions for `prospects`, `customer-outcomes`,
`investors-and-advisors` each socket-dropped at least once before
succeeding). What's new in this experiment is the rate: 5/5 retries
failed on the second batch, where 1/N succeeded in prior manual sessions.

A speculative prompt-side fix ("retrieve artifacts ONE AT A TIME, not in
parallel") did not change the outcome — Effi still socket-dropped.

A trivial `echo ping | effi ask` succeeds, confirming the endpoint itself
is reachable; the failure is specific to long-running tool-use streams.

## v0 → v1 design implications

The experiment was meant to test the **load-bearing v1 question** from
`DESIGN.md` — where does the offline processor run and what does it
output. The answer the experiment gives:

1. **Output shape works** — a strict-JSON proposal with kind/field/
   current/proposed/citations/confidence/rationale per row is a good
   substrate; humans can review row-by-row and apply selectively. The
   rendering of that JSON into a diff-style markdown is human-readable.

2. **Verification belongs in the pipeline, not the model** — letting the
   model self-report citations and then independently resolving each ID
   against (delta ∪ note) caught zero hallucinations in this run. That's
   the right shape: trust the model to write, verify the artifact-IDs
   externally, reject the whole proposal on any failure.

3. **Synthesis transport is not `effi ask`** — the `effi ask` CLI against
   the consumer-chat endpoint is the wrong substrate for offline
   processing. It's optimised for interactive chat with short tool-use
   loops, not for 2+-minute synthesis streams. v1 should:
   - Either call Anthropic API directly with pre-fetched artifact bodies
     (i.e. teach the offline processor to be a small standalone agent that
     fetches via `effi api`/Gmail/Fathom MCP/etc. before invoking Claude).
   - Or expose a dedicated internal Effi endpoint that's not subject to
     the consumer-chat proxy's streaming timeouts.

4. **Stage 2 (filter) is a no-op at index-only granularity** — project-
   delta returns `{id, entity_type, title, created_at}` per item; titles
   include the Effi forwarding alias as the "from" portion, not the real
   sender. Substring matching against the wiki's tracked-name list
   matched 0/4 in this run. Filter at scale will need either body
   fetches before filtering, or delegation of filtering entirely to the
   synthesizer (giving it all delta items, letting it ignore irrelevant
   ones).

5. **Watermark precision matters** — the wiki note's `updated: 2026-05-08`
   (date-only) was normalised to `2026-05-08T23:59:59Z` to avoid re-
   proposing items the note already cites. Going forward, frontmatter
   should carry a full ISO timestamp so the watermark is unambiguous.

## Anti-findings (things we did NOT learn)

- **Behaviour on a wider window** (e.g. one month of delta items, dozens
  to hundreds of artifacts). The test used a 3-day, 4-item window —
  realistic for daily cadence, but doesn't stress synthesis breadth.
- **Behaviour on a different topic shape** — `activity.md` is per-person-
  row. We don't know how the prototype would do on long-form prose notes
  like `compliance.md` or `positioning.md`.
- **Reproducibility of the one successful run** — we have N=1 success.
  Cost/runtime/accuracy figures should be treated as a single observation,
  not a distribution.
- **Reviewer-side acceptance rate** — the proposal was not actually
  applied to the wiki nor reviewed by a teammate. The "would a human
  accept this as-is" question is answered only by self-judgement.

## Open questions that still need answering

- **OP-1** (`DESIGN.md`) — where does the offline processor run, what's
  its budget? The cost data ($0.28/topic/run) gives a budget but the
  reliability data argues against the `effi ask` CLI as the runtime
  substrate.
- **OP-3** — is the offline processor stateless per run, or does it
  carry state across topics? This experiment was stateless; we don't
  know if cross-topic state would change accuracy.
- **DC-1** — how does the processor decide whether to ask the owner
  versus apply silently? This experiment didn't surface owner-asks; the
  three confidence buckets are a substrate for that decision but the
  thresholds aren't tested.

## Provenance

- One successful run: `runs/2026-05-11T11-31-17Z/`
  - `proposal.json` (5.7K), `proposal.md` (3.9K)
  - `report.md`, `raw_response.md`, `delta.json`, `annotated.json`
  - effi session_id `20be9c8a-16da-4d75-b059-2b5ce2324d91`
- Five failed runs (no committed artifacts — runs/ is gitignored — but
  the failure stderr is consistent: socket drop after
  `Retrieving all <n> new artifacts in parallel`).

## Reading order for the next agent

1. This file.
2. `PLAN.md` (for the original intent and success criteria).
3. `runs/2026-05-11T11-31-17Z/proposal.md` (the one good output).
4. `runs/2026-05-11T11-31-17Z/proposal.json` (the structured form).
5. If picking up v1 design — `usegin/effi-memory/DESIGN.md` §1
   (offline processing), now informed by points 1–5 of "v0 → v1 design
   implications" above.
