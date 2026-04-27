---
id: z108
title: Evals R&D round 1 — closed; substrate already exists, only the runner is missing
type: zettel
authored-by: usegin
threads: [↑z023, ~z027, ~z105, ~z104]
created: 2026-04-27
session: c9d84b44-7654-4727-af3e-5fff83a1f771
---

## Human side

2026-04-27, this autonomous run: Lihu asked Gin to find the moment from today's "Feature prioritization" meeting when Oria said "I can have a v0 of evals by tomorrow" and — if found — to R&D it as Gin (slack-shape, standalone sub-app inside `usegin/`). Found at [00:18:30] (Hebrew transcription, topic = איבל / evals). Gin then ran the full rnd skill — 6 parallel Polls, Sam-shape main-thread synthesis, z026-shape recommendation. Output: `usegin/research/evals/` end-to-end:

- 6 charters under `<angle>/charter.md` (A v0-click, B dataset-sourcing, C scoring-methods, D landscape-buy-vs-build, E dx-let-claude-run, F subapp-shape)
- 6 whiteboards (top/middle/bottom) committed individually as they landed (no batching, per z096)
- `SYNTHESIS.md` — load-bearing finding + 12 convergent + 8 divergent (5 lean-collapsed in synthesis, 3 promoted)
- `recommendation.md` — three z026-shape calls (R1 sequencing, R2 auto-promote line, R3 judge cost mix) + R4 default sequence

**Round 1 spine (in ship order, if Lihu accepts the Leans):** v0 substrate Gin-first tomorrow (~6h) → Effi-corpus seed Wed-Thu (~14h) → autonomous-iterate Director Fri (~10h) → calibration + scaling following week (~12h). Total ~42h to "evals are real," demo-able tomorrow.

## UseGin side

The load-bearing finding is the best kind — it dissolves a question rather than answering it. **The corpus already exists. The runner is the missing piece.** Both surfaces (Effi product, Gin dev-loop) capture every session as Claude-Agent-SDK JSONL — Effi in Supabase `conversations` bucket, Gin in `~/agent-records`. The skills `spec` and `fix-bug` already ship `evals.json` files (3 + 2 cases) in the canonical case shape with hand-written natural-language `assertions[]`. ~300 LOC ships v0 by tomorrow. Adopting any framework before this point would lock-in a data model we are about to invent. Anthropic's own published guidance (2025) names exactly this floor: 20–50 real-failure tasks; early changes carry large effect sizes so small samples suffice.

Five of six angles independently arrived at the same v0 shape — the strongest convergence I've seen in three rounds (slack had ~7/10 high-confidence convergences; this had 12/12 hard-to-disagree-with). Convergence at this strength is signal that the question was *findable* from multiple starting points, not that the team lucked into the right priors. The divergences that survived (DV1 sequencing, DV2 auto-promote line, DV3 judge cost) are exactly the calls Lihu has the context to make and the agents don't.

**Process notes worth keeping (z099 trajectory):**
- Pre-decompose at the orchestrator (z029): 6 angles set up cleanly; no fan-out attempts inside charters.
- Charter-as-instantiation (z023): each charter named the read-first list, the deliverable shape, the scope-out, the friction-capture pointer. Whiteboards came back tight.
- Commit-per-whiteboard (z096): one collision Mode-1 dodged on the C commit by using the new snapshot-staged tripwire (`scripts/hooks/snapshot-staged.sh`); one collision LANDED on the D commit before I read the new use-gin entry (zisser/principles files came along under the D message). Lesson: read the use-gin section "Commit safely under multi-Gin pressure" *before* the first commit of a multi-commit run, not after the first collision.
- Effi-direct fetch (z105): the workaround for Effi looping on Hebrew/paraphrased queries paid off twice — once for the original Oria-quote lookup, then again as canonical reference for Poll-E's reading of [00:18:10–00:18:43]. The first-place capture (use-gin update + z105) lands the same turn the gap is found.

**The "let Claude run on it" framing as load-bearing differentiator.** Poll-E's autonomous-iterate Director design — porting `tdd-execute`'s 3-wall isolation onto a `cell` of stateless workers, with cases+scorers locked by PreToolUse hook — is the piece that makes this *evals for an agent product team*, not just yet another eval framework. Without that hook, a worker that hits a wall rewrites the test. The lesson is from `tdd-execute` session `9e966133`. The same primitive that disciplines TDD disciplines auto-iteration. Reuse, not re-invention.

**Round opens four follow-on tracks:**
1. **`dx evals harvest`** — the missing primitive between have-data and have-corpus. Should be its own slice once R1 lands.
2. **Inter-rater capture infra** — C's weekly Lihu spot-check has nowhere to land. Cross-cuts to E + F. Worth one zettel + one ENG- issue.
3. **`dx his` ratings as eval-source** — write-only today, highest-yield untapped harvest source for Gin. One small connector.
4. **Yohai (comptroller) vs evals** — F asks: same job in two costumes? Worth a zettel naming the distinction.

## Threading

↑z023 (charter is the instantiation — every Poll's charter held the round) · ~z027 (token-budget open for parallelism, economized for Lihu — followed) · ~z105 (effi-direct meeting fetch — used twice this round) · ~z104 (enhance-gin round 1 — same shape, this round mirrors). Cross-references: ~z029 (pre-decompose at orchestrator), ~z030 (whiteboard-as-charter-deliverable), ~z075 (war-management round, prior rnd template), ~z096 (autosync mode-1 collisions — landed once, dodged once with new tripwire), ~`usegin/research/evals/SYNTHESIS.md`, ~`usegin/research/evals/recommendation.md`, ~`usegin/research/slack-integration/SYNTHESIS.md` (sister-round template).
