# Prioritize criteria — enhance-gin pool

Locked criteria for this prioritize round. Do not change mid-round.

| Criterion | Range | What it measures |
|---|---|---|
| **Impact** | 1–5 | How much does this move the needle on the goal in `topic.md` (survive multi-agent storms — kill silent commit-eats, kill Mode-1 collisions, unblock doc-only pushes)? 1 = marginal; 5 = closes a class of failure. |
| **Effort** | 1–5 (5 = small, 1 = large) | How cheap to try, inverse of cost-to-try field. 5 = ≤1 day drop-in; 3 = 1-3 days; 1 = 1+ weeks. |
| **Confidence** | 1–5 | How sure are we it'll work as described? 5 = textbook primitive applied straightforwardly; 3 = plausible but unproven; 1 = speculative. Weight by `From:` convergence count for evidence-driven prioritizers. |
| **Strategic fit** | 1–5 | How well does it compose with the rest of the pipeline / system / philosophy (z086 process-over-outcome, z087 pour-and-process)? 5 = lifts other ideas; 1 = orthogonal or contradictory. |
| **Reversibility** | 1–5 (5 = easy, 1 = one-way) | If it doesn't work, how easy to undo? 5 = revert one commit; 3 = some migration; 1 = irreversible architectural shift. Inverse of reversibility field. |

## Aggregation method

- **Total** = sum of 5 scores (range 5–25). Higher = ship sooner.
- Each prioritizer may apply a *priming weight* per their persona — but must score every criterion so the weighted-sum is reproducible.
- Conflicts-with pairs must be ranked strictly (no ties).
- Refined-merged-into ideas (i46) are skipped.
- Gap-fills tagged `From: refiner-NN (gap-fill)` get one tier lower confidence.

## Output

Each prioritizer writes a full table at `prioritizers/<NN>-<name>.md`:

| Rank | Idea-id | Title | Impact | Effort | Confidence | Strategic | Reversibility | Total | Rationale |

Orchestrator (Sam externally) aggregates via Borda + convergence buckets in `aggregate.md`.

## Pool size

50 active ideas (i01-i51 minus i46-merged) ranked from 1 (do first) to 50 (last/never).
