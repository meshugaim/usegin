# Charter — angle C: scoring-methods

You are a professor of **what produces a number worth tracking — the scorer side of evals**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/evals/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md` (what "good Effi" means in product terms — citations, no confabulation, correct tool calls, helpful synthesis)
- `/workspaces/test-mvp/CLAUDE.md` (the general posture)
- Memory worth pulling: `feedback_one_off_errors_no_speculation.md`, `feedback_dont_jump_to_conclusions.md`, `feedback_verify_before_claiming_dead.md` (these tell you the *shape of failure* the team cares about — not just task completion, but discipline of evidence and absence of confabulation).
- The Effi-session-audit skill: `.claude/skills/effi-session-audit/SKILL.md` — what kinds of failure does Lihu currently look for when he reads a real session? That IS today's manual scorer, and v1 of the eval scorer should formalize it.
- Anthropic's published guidance on Claude-as-judge if it's in the codebase or via context7.
- Skim how AskEffi handles failure today — Sentry alerts, manual session reads.

## Mandate

Map the realistic scoring methods for evaluating Effi and Gin, and recommend a calibrated stack. Cover: judge-LLM scoring, structural assertions (tool-call shape, citation presence, no-PII-leak, latency), golden-answer match (when applicable), human annotation (when needed), regression-vs-baseline (the most-actionable shape — "did this prompt change make things worse"), and the anti-Goodhart problem (any single scorer becomes the target).

## Scope

**In:**
- Method inventory: judge-LLM, structural, golden-match, human-annotation, baseline-comparison.
- Per method: what it grades well, what it grades badly, calibration cost, false-positive shape, runtime cost.
- The agent-trace-eval problem: scoring a multi-turn tool-using session is not the same as scoring chat-completion. How do you score a *trajectory*? Per-turn scoring + aggregate? Outcome-only? Hybrid?
- Calibration: how do we trust a Claude-as-judge score? Inter-judge agreement? Spot-check against human ratings?
- Anti-Goodhart: at least 2 mechanisms (e.g., scorer rotation, secondary "vibe" check, periodic human re-baseline).
- Mapping Effi failure-modes from `effi-session-audit` skill into structural assertions where possible (these are the cheapest, most-deterministic scorers).
- The "noise" problem: an agent run is non-deterministic; how do we tell signal from variance? N-runs-per-case averaging? Fixed seeds (where supported)? Variance budget?

**Out:**
- Where cases come from (angle B).
- The DX of running scorers (angle E).
- Specific tooling (angle D — you say "judge-LLM with rubric X"; D says "implemented via promptfoo or rolled-our-own").
- The v0 scorer pick (angle A — you give them the menu + Lean; they pick).

## Working rules

- Use sub-Explore to read the effi-session-audit skill carefully and pattern-match it to a structural-assertion list.
- Capture friction as zettels.
- Do NOT commit. Do NOT write outside `/workspaces/test-mvp/usegin/research/evals/scoring-methods/`.

## Deliverable

Write `/workspaces/test-mvp/usegin/research/evals/scoring-methods/whiteboard.md`:

```
## Top — the click
<The load-bearing recommendation: which scoring stack fits our team's failure
modes. E.g.: "Structural-first (cheap, deterministic) + Claude-as-judge with
N=3 rotated-rubric (calibrated against weekly 10-case human spot-check).
Golden-match only for the 5 'must never break' cases. Trajectory scored
per-turn-then-aggregate, not outcome-only.">

## Middle — the body
<Method inventory with tradeoffs. Trajectory-scoring proposal. Calibration
loop. Anti-Goodhart mechanisms (≥2). Mapping from effi-session-audit
failure-modes to structural assertions (concrete list). Variance budget.>

## Bottom — the open ends
<Dilemmas in z026 shape (≥2 — at minimum: "judge-LLM cost vs. structural
coverage" and "trajectory vs. outcome scoring for tool-using agents").
Friction zettels. Open questions for Lihu.>
```

Return a ≤10-line summary in chat.
