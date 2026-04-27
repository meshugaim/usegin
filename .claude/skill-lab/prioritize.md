# prioritize — Skill Lab

## Intent

Make ranking-by-team a repeatable convergent step that beats solo Gin prioritization. Solo prioritization is biased toward the framing that landed easiest; independent prioritizers + Borda aggregation + convergence-bucket views surface both the consensus picks and the disagreements (which are themselves signal).

The skill exists to close the brainstorm-refine-prioritize-spec pipeline: brainstorm produces volume, refine makes it legible, prioritize picks winners, spec formalizes them. Without prioritize, refine's output bottlenecks at "what should I work on first?" — a question the team can answer better than any one Gin.

Sits between `refine` (legibility) and `spec` (formalization). It is the explicit-criteria + multi-ranker convergence step.

Success means: a prioritize round runs end-to-end (read → criteria → spawn → aggregate → mark → dilemmas → hand off) without re-deriving the lifecycle, with both Borda and convergence-bucket views landing in `aggregate.md`, and with dilemmas surfaced to Lihu in z026 shape.

## Success Signals

When retroing a session that used this skill:

### Pool readiness
- [ ] ideas.md had structural summary, four context fields per idea, conflicts-with mapped, gap-fills marked
- [ ] If pool was unrefined, prioritize did NOT proceed — it triggered refine first

### Criteria
- [ ] criteria.md exists at `<root>/prioritize/criteria.md`
- [ ] 4–6 criteria, scoped to the topic
- [ ] Criteria locked before spawning (no mid-round change)

### Spawning
- [ ] 3–5 prioritizers (independence > volume sweet spot)
- [ ] At most 3 distinct primings (PM / strategist / risk-conscious / evidence-driven), doubled up if N>3
- [ ] All prioritizers fired in one batched response
- [ ] No prioritizer read another's file mid-run

### Per-prioritizer output
- [ ] Every idea ranked (no skips except merged-out)
- [ ] Each idea scored on every criterion (1–5)
- [ ] Each rationale references ≥2 criteria explicitly
- [ ] Conflicts-with pairs ranked strictly (no ties for excluded pairs)
- [ ] Gap-fills called out as lower-confidence

### Aggregation
- [ ] Both Borda and convergence-bucket views computed
- [ ] aggregate.md written with both views
- [ ] Convergence bucketing tagged: high-agreement (100% top-K), moderate (60-99%), split (<60%)
- [ ] Dilemmas section in aggregate.md, z026 shape (Decision needed / Options / Lean / Why / Price / Risk)

### Pool edits
- [ ] Rank field populated per idea (Borda position)
- [ ] Rationale field populated (carrying-criteria + convergence note)
- [ ] No edits to other fields

### Commits + hand-off
- [ ] Two-stage: prioritizers-and-aggregate, then pool-edits
- [ ] Closing zettel + dilemma list
- [ ] Hand-off explicit (spec on top-K, or human-pick override)

### Friction capture
- [ ] Frictions logged live (broken context fields, criteria ambiguity, priming-pool mismatch)

## Known Limitations

- **Borda is not weighted.** A prioritizer who is wildly off-base counts the same as one who's nailed it. Mitigation: vary primings to 3 distinct stances (so off-base is a stance, not a mistake) and present convergence-bucket view alongside Borda. Future: trust-weighted Borda where weights come from prior-round retros.

- **Criteria choice is judgment-driven.** No tool helps the orchestrator pick which 4-6 criteria to lock. The default set (Impact, Effort, Confidence, Strategic Fit, Reversibility) is empirically OK for Gin-internal but may not fit shipping rounds. Track criteria choices across rounds.

- **Independent rankings are still subject to a shared training-data prior.** Five prioritizers with different primings may still all over-rank "obvious AI-best-practices" ideas relative to ones that need deeper context. Mitigation: at least one priming should be evidence-driven (weight by brainstorm convergence count).

- **No quality control on rationales.** A prioritizer can write "good Impact, low Effort" as rationale for everything; the orchestrator catches it only by reading. Mitigation: charter requires explicit reference to ≥2 criteria; spot-check during retro.

- **Gap-fill handling is heuristic.** "One tier lower in confidence" is fuzzy; some gap-fills are genuinely high-confidence and some are speculation. The downweighting is conservative, but may bury valid gap-fills.

- **Conflicts-with isn't always honored.** A prioritizer can technically rank A above B and B above A across rounds (across-rounds inconsistency). Within-round, the charter forces strict ordering for conflict pairs.

- **Sub-Gin can't fan out (z029 inherited).**

- **No retrieval across rounds.** A 2nd prioritize on a related topic re-ranks from scratch; convergence with prior rounds isn't surfaced.

## Retro Guide

When `skill-retro` triggers a retro for `prioritize`:

**1. Check criteria-locking discipline**
Did criteria.md exist before spawning? Was it changed during? Mid-round changes invalidate aggregation.

**2. Check independence**
Did any prioritizer reference another prioritizer's ranking? Independence is non-negotiable.

**3. Check rationale depth**
Sample 5 rationales from one prioritizer. Do they reference 2+ criteria each, with concrete reasoning? Or is it "high impact, do it"? Shallow rationales = the prioritizer skimmed.

**4. Check both aggregation views**
Was Borda ALONE the only output? Convergence-bucket view ALONE? Both must land.

**5. Check dilemma surfacing**
Did `## Dilemmas` exist in aggregate.md? Z026 shape? If absent, the team's disagreements were swallowed — that's lost signal.

**6. Check priming variation**
Five prioritizers all "pragmatic PM" produces a same-shaped ranking. Were ≥3 distinct primings used?

**7. Check gap-fill treatment**
Were gap-fill ideas explicitly downweighted in rationales? Or did they get ranked top-3 with no caveat?

**8. Check pool-edit invariants**
Were any fields besides Rank and Rationale edited? Forbidden — those are upstream skills' fields.

## Retros

| Date | Round | What happened | What the round taught us |
|---|---|---|---|
| *(pending)* | | | |

## Ideas / Notes

- **Trust-weighted Borda.** Track which prioritizers' rankings have correlated with downstream success (idea actually shipped, idea was good in retrospect). Weight their rankings higher in future rounds. Risk: institutionalization.

- **Cross-pool prioritization.** When two pools touch the same domain, can a meta-prioritize rank ideas across both? Probably yes — same skill, just larger pool input. Worth trying.

- **Live-with-Lihu prioritize.** Variant where Lihu walks through the pool with Gin pair-style, scoring as they go. For high-context topics or when team-form feels heavy. Captures via the same Rank+Rationale format.

- **Auto-promote high-agreement to spec.** When 100%-top-K convergence is observed, auto-trigger spec without waiting for human-pick. Risky but cheap; the human can override.

- **Re-prioritize on context change.** When a major context shift happens (a constraint relaxed, a deadline introduced), re-run prioritize on the same pool with new criteria. Compare across-rounds — what changes?

- **Negative criteria ("anti-goals").** A criterion that *subtracts* (e.g. "user-confusion impact" — high score = bad). Test whether negative criteria produce different rankings.

- **Prioritizer-of-prioritizers.** A second-pass Gin reads the per-prioritizer files and identifies systematic biases ("prioritizer-2 always over-weights Effort"). Could feed back into priming-mix selection. Probably overkill for now.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-04-27 | Skill created. Lab seeded. Closes the brainstorm → refine → PRIORITIZE → spec → implement pipeline. Default criteria set: Impact / Effort / Confidence / Strategic Fit / Reversibility. Aggregation: Borda + convergence-buckets. | Lihu / Oria asked for the four team-skills modeled on rnd. Prioritize is the convergent decision step that beats solo prioritization through independent rankings + structured aggregation. |
