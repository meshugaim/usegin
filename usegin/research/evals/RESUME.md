# Evals R&D — Resume Pointer

**Status:** **CLOSED 2026-04-27.** All 6 whiteboards landed; SYNTHESIS + recommendation complete; closing zettel z108 written.

**Cold-reader entry point:** read `SYNTHESIS.md` first (≤5min), then `recommendation.md` (≤5min). Drill into individual whiteboards only when a specific dilemma needs deeper context — pointers in SYNTHESIS.md.

**Deliverables:**
- `SYNTHESIS.md` — load-bearing finding (the corpus already exists, only the runner is missing), 12 convergent findings, 8 divergent points (5 lean-collapsed, 3 promoted to recommendation).
- `recommendation.md` — three z026 calls for Lihu (R1 sequencing, R2 auto-promote line, R3 judge cost mix) + R4 default sequence (~42h to "evals are real," v0 demo-able tomorrow).
- 6 whiteboards under `<angle>/whiteboard.md` (A–F).
- Closing zettel: `usegin/zettel/zettels/z108-evals-rd-round-1-closed.md`.

---



**Trigger:** Today's "Feature prioritization" meeting (2026-04-27 14:32 UTC). At [00:17:24] Guy: "we'll never prioritize the whole evals story — and now we have to." At [00:18:30] Oria: "I can have a v0 of an eval [framework] for us by tomorrow, like, just, with something." Topic = **evals for our prompts/agents**, surfaced as "never-prioritized but doable-tomorrow."

Lihu directive (this session): **R&D it as Gin — same shape as the slack-integration round we just closed. Build it standalone, out of the AskEffi product, as another sub-app inside Gin's project (`usegin/evals/`). Take inspiration from how zettel, slack, and zisser were shaped.**

**Skill:** `rnd` (`.claude/skills/rnd/SKILL.md`)
**Sister round (template):** `usegin/research/slack-integration/`
**Linear:** none — Gin-internal R&D per z024; promote later if it earns it.

## What this round is

Evals for an agent product that ships to humans (Effi). Two surfaces braided:

1. **Eval the AskEffi product agent (Effi).** Does this prompt change improve real-user conversations? Does this tool-call orchestration regression matter? Production-grade.
2. **Eval Gin (this dev agent).** Do our skills trigger right? Do orchestrations land their charters? Dev-loop-grade — informs `usegin/`.

Same primitive (eval), two consumers. The R&D should keep both in view but not collapse them — they have different datasets, different scoring shapes, different cadences.

The deliverable is **the design for `usegin/evals/`** — a standalone sub-app inside Gin's project (peer to `zettel/`, `zisser/`, `consultant/`). NOT product code (yet). The R&D produces the recommendation; if Lihu accepts, the next round implements the v0 skeleton.

## Goal output

- 6 angle-whiteboards under `usegin/research/evals/<angle>/whiteboard.md`
- 1 `SYNTHESIS.md` cross-cutting
- 1 `recommendation.md` in z026 shape (decisions for Lihu)
- Closing zettel naming the round

## Round structure (6 angles)

| # | Folder | Model | Charter focus |
|---|---|---|---|
| A | `v0-click/` | Opus | What "v0 by tomorrow" minimally looks like — 1 dataset, 1 scorer, 1 runner, 1 result-surface. The smallest thing that could earn the next iteration. Load-bearing because everything else hangs off "what does v0 mean here." |
| B | `dataset-sourcing/` | Opus | Where the eval corpus comes from. Effi session JSONLs (`~/agent-records`, `conversations` bucket), Linear-tagged regressions, hand-curated golden cases, synthetic. Coverage, refresh, drift, anti-leakage. |
| C | `scoring-methods/` | Opus | What produces a number worth tracking. Claude-as-judge, structural assertions (tool-call shape, citations present, no PII leak), golden-answer match, human annotation, regression-vs-baseline. Calibration + anti-Goodhart. |
| D | `landscape-buy-vs-build/` | Sonnet | Existing tooling (promptfoo, braintrust, langsmith, langfuse, helicone, openai-evals, anthropic SDK eval surface, Inspect AI, Claude Code's own evals). What we adopt vs. what doesn't fit our Anthropic-SDK / ClaudeSDKClient / dogfooding stack. Includes peer-org practice (Cursor, Aider, Continue, Devin) as input. |
| E | `dx-let-claude-run/` | Opus | The DX shape — Oria's framing: "what evals give you is letting Claude run on it." CLI surface, headless-claude swarms iterating prompts against the eval, results format, where regressions surface (Linear comment? Slack post via `dx slack`? `dx evals` dashboard? PR check?). Connection to existing `usegin` patterns (cell, ralph, tdd-execute). Load-bearing because this is the differentiator vs. "yet another eval framework." |
| F | `subapp-shape/` | Opus | Folder layout + governance for `usegin/evals/`. Where files live (`runs/`, `cases/`, `configs/`, `judges/`), zettel-integration, relationship to AskEffi product code (when does this graduate to `python-services/` or `nextjs-app/`, if ever), comparison to how `zettel/`, `zisser/`, `consultant/` are organized. The standalone-vs-graduates question. |

## Doctrinal pointers (every Poll inherits)

- **Charter is the instantiation (z023).** No vague "investigate evals" — each charter names the angle, the read-first list, the deliverable shape, the scope-out, and the friction-capture pointer.
- **Friction is a deliverable (principle 9, z009).** Each whiteboard ends with friction zettels captured via `dx zettel add --as=usegin`. Don't push through silently.
- **Top/middle/bottom whiteboard shape.** Top = the click. Middle = body. Bottom = open ends in z026 shape. The synthesizer reads only "top" across all six.
- **Selbständigkeit (principle 5).** Each Poll decides its own sub-questions within its scope; orchestrator does not micromanage.
- **Aharai for model selection (principle 10).** Opus for load-bearing/novel angles; Sonnet for clear-cut landscape lookups.
- **Hold the dialectic (principle 7).** Sam preserves disagreements between Polls; does not average them. If two Polls land different prescriptions, that's signal.

## Resume guide (if power dies / new agent picks up)

1. Read this file.
2. `ls usegin/research/evals/*/whiteboard.md` — every present whiteboard is done. Missing → re-read that folder's `charter.md` and respawn.
3. `git log --oneline | grep "research(evals"` — committed whiteboards persisted.
4. Resume options:
   - **All 6 whiteboards present, no SYNTHESIS.md** → run synthesis (spawn an N+1 synthesizer Gin or do main-thread).
   - **Some whiteboards missing** → re-read the charter, spawn a fresh Agent with the same charter text.
   - **SYNTHESIS.md present, no recommendation.md** → write `recommendation.md` in z026 shape and bring to Lihu.
   - **All artifacts present** → close the round, write closing zettel (z106+).
5. **Don't batch commits.** Per `feedback_commits_at_every_change` + `reference_autosync_concurrent_collisions`, commit each whiteboard as it lands.
