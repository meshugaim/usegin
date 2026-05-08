---
status: proposal — needs Lihu green-light
authored: 2026-05-08
authored-by: claude (effi-memory R&D)
references:
  - usegin/effi-memory/DESIGN.md (load-bearing question — "where does the offline processor run")
  - usegin/effi-memory/askeffi-app-really/_lifecycle.md (OP-1, OP-2, OP-3)
  - usegin/effi-memory/askeffi-app-really/notes/activity.md (test topic)
---

# Experiment 004 — offline-processor prototype, single topic

## Question

Given a curated wiki note + a new batch of indexed artifacts since the
last reconciliation watermark, **can an automated pipeline produce a
proposal that a human owner would accept as-is?**

Concretely: pick `notes/activity.md`, watermark it, feed the prototype
new artifacts (last 7 days of Gmail + Fathom + dogfooding-Effi JSONLs),
and have the prototype emit a structured proposal. Score the proposal
against what a manual extraction would have produced.

## Why activity as the test topic

- **Highest churn rate** in the wiki (cadence changes daily).
- **Just authored** (this session) — known-good baseline.
- **Cross-source** — touches Gmail (per-person email cadence), Fathom
  (meeting attendance), Drive (production-week reports), Linear (commit
  counts via dogfooding-Effi).
- **Low blast radius if wrong** — activity classifications are
  internal-team-facing, not customer-facing.

If the prototype handles `activity` it likely handles `team` /
`design-partners` / `prospects` (similar shape: per-entity rows with
last-touch dates). It likely struggles more on `compliance` /
`positioning` (long-form prose without tabular structure).

## Scope — what the prototype does and does NOT do

**Does:**

1. Read the current `notes/activity.md` + frontmatter (treats `updated:`
   as the watermark).
2. Pull new artifacts since the watermark from 4 sources, via
   `effi --profile dogfooding`:
   - Gmail messages
   - Fathom recordings
   - Drive doc edits (production-week reports)
   - Dogfooding-Effi conversation JSONLs
3. Filter to artifacts that *plausibly touch any of the 10 people in
   `activity.md`* — keyword match on names + email addresses.
4. Synthesize a proposal via Claude (Opus) with the rubric:
   - For each named person: did their cadence/trend/last-touch change?
   - Are there new people who should be added?
   - Are there existing classifications that should change?
5. Output: a structured `proposal.json` + a human-readable
   `proposal.md` showing the diff against the existing note.
6. Emit a run-report: artifacts processed / dropped, conflicts detected,
   confidence per proposed change.

**Does NOT:**

- Apply the proposal to the wiki. Human reviews; manual apply.
- Touch any other note.
- Run on a schedule. Manual one-shot via `python run.py`.
- Use Supabase. Pure markdown read + JSON write.

## Success criteria

The experiment is a **success** if at least 3 of these hold:

- ✅ Proposal contains zero hallucinated citations (every `gmail:<id>`
  resolves to a real message).
- ✅ Proposal correctly identifies any cadence shift visible in the
  artifacts (e.g. Courtney sends an email after weeks of silence →
  proposal updates her trend).
- ✅ Proposal does not propose a change where none is warranted (does
  not flag `team-is-five` when team is still five).
- ✅ Proposal includes confidence scores that correlate with
  human-judged correctness (high-confidence proposals are right; low-
  confidence proposals are where the human disagrees).
- ✅ Synthesis runtime < 5 minutes for one topic (sets cost ceiling for
  scaling to 17 topics).

The experiment is a **partial success** if 2 hold; **failure** if ≤1.
Failure is informative — tells us whether the limit is matching,
synthesis, proposal shape, or all three.

## Pipeline shape

```
                ┌──────────────────────────────────────┐
                │  notes/activity.md  (current state)  │
                └────────────────────┬─────────────────┘
                                     │
                                     ▼
       ┌────────────────────────────────────────────────────┐
       │ stage 1 — fetch artifacts since watermark          │
       │   gmail / fathom / drive / chat-jsonl              │
       │   via effi --profile dogfooding                    │
       └────────────────────┬───────────────────────────────┘
                            │
                            ▼
       ┌────────────────────────────────────────────────────┐
       │ stage 2 — filter by name/email keyword match       │
       │   keep artifacts plausibly mentioning a tracked   │
       │   person                                           │
       └────────────────────┬───────────────────────────────┘
                            │
                            ▼
       ┌────────────────────────────────────────────────────┐
       │ stage 3 — synthesize proposal                      │
       │   Claude Opus call with current note + filtered    │
       │   artifacts                                        │
       │   output: structured JSON                          │
       └────────────────────┬───────────────────────────────┘
                            │
                            ▼
       ┌────────────────────────────────────────────────────┐
       │ stage 4 — render proposal.md (diff view)           │
       │   human-readable changes vs current note          │
       └────────────────────┬───────────────────────────────┘
                            │
                            ▼
       ┌────────────────────────────────────────────────────┐
       │ stage 5 — citation verification                    │
       │   resolve every cited id back to source            │
       │   reject proposal if any citation fails            │
       └────────────────────────────────────────────────────┘
```

## Implementation notes

- Live in `experiments/004-offline-processor-prototype/`. Self-contained.
  No production code touched.
- Use `uv` for Python deps; reuse `experiments/_lib/ttft.py` if useful.
- Watermark seed: 2026-05-08 13:00 UTC (just before this session ended).
  Artifacts after that are the fresh batch.
- Output goes to `runs/<timestamp>/proposal.{json,md}` + `runs/<timestamp>/report.md`.
- Failed proposals (citation-resolution failures) go to
  `runs/<timestamp>/rejected.md` with the reason.

## Cost estimate

Per topic per run:
- ~tens to ~hundreds of artifacts after stage 2 filter.
- One Claude Opus synthesis call: ~30K input tokens (current note +
  filtered artifacts) + ~2K output tokens. **~$0.50 per topic per run**
  at current Opus pricing.
- At 17 topics, daily run: **~$8/day** for full automation. Acceptable
  for an internal-team feature; needs tighter filtering for production.

## Decisions deferred to the run

- **Match threshold** (stage 2). Start with substring match on names +
  emails. If precision is too low, escalate to embedding similarity.
- **Proposal granularity**. Per-row diff vs whole-section rewrite. Try
  per-row first.
- **Confidence rubric**. Start with three-bucket (high / medium / low)
  + a one-sentence rationale per claim.

## Out of scope for this experiment

- Multi-topic processing (do one, generalize after).
- Owner-ask routing (proposal goes to file, not Slack).
- Auto-apply (human reviews every proposal).
- Database persistence (markdown only).
- Cron scheduling (manual run).

## Reading order

1. `usegin/effi-memory/DESIGN.md` — for the broader frame (especially §1
   on offline processing).
2. `usegin/effi-memory/askeffi-app-really/notes/activity.md` — the test
   topic.
3. This file.
4. (After running) `runs/<timestamp>/report.md`.
