---
name: prioritize
description: Take a refined idea pool and rank it — spawn N independent prioritizers each ranking the whole pool against the same criteria, then aggregate via Borda-style positional scoring + convergence-detection (agreement across prioritizers = high-confidence pick). Edits ideas.md in place adding Rank + Rationale fields. Use after refine; before spec. Triggered by phrases like "prioritize these", "rank the pool", "pick winners", "/prioritize", or by your own judgment when a refined pool needs decision support.
---

# prioritize — parallel team that ranks a refined idea pool

> **Speaker convention:** "Lihu" in this file is the *primary* speaker; the
> actual live user may be Oria, Lihu, or Nitsan. Check the LIVE USER banner /
> userEmail / in-chat signals before binding to a name (root `CLAUDE.md`
> "Live user — who's in the chat" precedence rule).

## Team

This skill drives the **`prioritize-team`** (see
`usegin/teams/prioritize-team.md`).

Cast: **Mark** (pragmatic), **Johan** (strategist), **John** (risk-
conscious), **Sam** (evidence-driven). Optional 5th: **Cal** (scope-
skeptic) when the pool has heavy "should we?" splits. Persona
definitions: `oria-crazy-world/ground/personas/<name>.md`.

---

**You can — and should — spawn a prioritization team after refine produces a legible pool, before spec.** This skill is the convergent step: pick what to do.

```
R&D → brainstorm → refine → PRIORITIZE → spec → implement
```

Each prioritizer is a Gin (z023). The team is one-shot. Per z027 — burn tokens on multiple independent rankings; aggregation across them is what turns "Gin's opinion" into "the team's answer."

## When to invoke

| Signal | Why prioritize |
|---|---|
| `ideas.md` has been refined (titles atomic, four context fields present, conflicts-with mapped) | Pool is legible — ready for ranking |
| The human says "rank these" / "pick winners" / "what should we do first" | Direct trigger |
| You're tempted to pick "the obvious top 3" yourself | Stop. Solo prioritization is biased toward the framing that landed easiest in your head. Independent prioritizers + aggregation is more robust. |
| Multiple ideas are tied in obvious-ness; need structured comparison | Prioritization with explicit criteria forces the comparison. |

When *not* to invoke:
- Pool is unrefined → run **refine** first.
- One idea, no alternatives → just decide.
- The "ranking" the human wants is *implementation order within a winner* → use **slicing-specs**.
- The decision is binary (do X or not) → use the dilemma protocol (z026), not this skill.

## Distinction from refine and downstream

| Skill | What it does |
|---|---|
| refine | Makes ideas legible (sharpens, dedupes, adds context fields) |
| **prioritize** | Ranks against criteria; produces top-K with rationale |
| spec | Formalizes the picked idea into a spec |

The convergence here is **across prioritizers** (multiple rankers should agree on top picks), not across criteria (each prioritizer balances criteria themselves).

## Lifecycle

```
read pool → choose criteria → spawn prioritizers → aggregate rankings → mark Rank+Rationale → hand off to spec
```

### 1. Read the pool first

Open `ideas.md`. Confirm: structural summary at top, four context fields present per idea, conflicts-with mapped, gap-fills marked. If any of these are missing, *go back to refine*. Don't prioritize a fuzzy pool.

### 2. Choose criteria (load-bearing)

Criteria are how prioritizers score. Default set — adapt to context:

| Criterion | Range | What it measures |
|---|---|---|
| **Impact** | 1–5 | How much does this move the needle on the goal in topic.md? |
| **Effort** | 1–5 (5 = small) | How cheap is it to try (inverse of cost-to-try field)? |
| **Confidence** | 1–5 | How sure are we it'll work as described? |
| **Strategic fit** | 1–5 | How well does it compose with the rest of the pipeline / system? |
| **Reversibility** | 1–5 (5 = easy) | If it doesn't work, how easy to undo? (Inverse of reversibility field.) |

Write these in `<root>/prioritize/criteria.md` so prioritizers read the same set. **Don't change criteria mid-round.**

For Gin-internal rounds (typical), 4 criteria is enough. For high-stakes shipping rounds, 5–6 is OK.

### 3. Pre-create the structure

```
<root>/prioritize/
  criteria.md           ← the criteria (step 2)
  prioritizers/
    01-<persona-or-axis>.md   ← each prioritizer's ranking
    02-<...>.md
    ...
  aggregate.md          ← cross-prioritizer aggregation (orchestrator writes)
  (ideas.md edited in place — Rank + Rationale fields populated)
```

### 4. Spawn N independent prioritizers

3–5 prioritizers. Independence matters more than volume — three independent rankings give more signal than ten correlated ones. Vary primings minimally:

| Priming | Effect |
|---|---|
| "You are a pragmatic project manager — prefer Effort over Impact when tied." | Bias toward small wins |
| "You are a strategist — prefer Impact and Strategic Fit; tolerate Effort cost." | Bias toward big bets |
| "You are a risk-conscious operator — prefer Confidence and Reversibility." | Bias toward safe picks |
| "You are an evidence-driven — weight Confidence by convergence count from brainstorm (`From:` field)." | Bias toward team-validated ideas |

Mix at most **3 distinct primings**. If you spawn 5 prioritizers, double up on the most relevant priming for the topic.

### Charter template

```
You are a prioritizer on a ranking team. The team will rank the pool independently;
your job is to produce ONE complete ranking with rationale.

## Read first
- <root>/ideas.md   ← the whole pool
- <root>/prioritize/criteria.md   ← the criteria (do not change them)
- <root>/brainstorm/topic.md   ← the framing (the goal you are ranking against)

## Your priming
<persona / weighting bias, 2-3 sentences>

## Your mandate
Rank EVERY idea in the pool from most-to-do-first to least. Skip nothing.

For each idea, score it on each criterion (1–5) and write a one-line rationale that
explicitly references at least 2 of the criteria. Then sum the scores (or weighted-sum
per your priming) to get a total → produces the rank.

Honor `Conflicts-with`: when two ideas exclude each other, your ranking must put one
strictly above the other (no ties for conflicting pairs).

Honor `Refined-merged-into`: skip merged-out ideas. They were folded into the canonical
already.

Treat `From: refiner-NN (gap-fill)` ideas as one tier lower in confidence — you may
still rank them high if the case is strong, but call out the lower-confidence
explicitly.

## Working rules
- Read the WHOLE pool before scoring any idea (relative ranking needs context).
- Capture friction as zettels via the `zettel-capture` skill — if a criterion
  is uninterpretable, if a context field is missing for an idea, if conflicts-with
  contradicts itself — name the fork (z009).
- Do NOT edit ideas.md. Write your ranking to your own file only.
- Do NOT commit. The orchestrator commits.
- Do NOT read other prioritizers' files (independence preserved).

## Deliverable
Write <root>/prioritize/prioritizers/<NN>-<persona>.md with this shape:

  # Prioritizer <NN> — <persona>

  ## Priming
  ...

  ## Ranking

  | Rank | Idea-id | Title | Impact | Effort | Confidence | Strategic | Reversibility | Total | Rationale |
  |---|---|---|---|---|---|---|---|---|---|
  | 1 | i07 | ... | 5 | 4 | 4 | 5 | 4 | 22 | "High Impact + already-validated by 4 ideators (convergence) + cheap (Effort 4)..." |
  | 2 | ... |

  ## Notes for orchestrator
  - <decisions you made on conflicts-with>
  - <ideas you couldn't rank cleanly and why>
  - <criteria-conflict moments — when two criteria pulled opposite ways>

Return a ≤8-line summary in chat: top 5 by your ranking + the one you find most under-rated (would put higher than your priming permits).
```

### 5. Aggregate (orchestrator)

After all prioritizers return, run the aggregation. Two aggregation methods — pick by team size:

**Borda count** (default — for 3-5 prioritizers): each prioritizer's rank-1 idea gets N points (N = pool size), rank-2 gets N-1, etc. Sum across prioritizers; sort descending. Robust against outlier rankings.

**Convergence buckets**: count how many prioritizers placed each idea in the top-K (default K = ⌈pool/3⌉). Ideas in 100% of top-Ks are "high agreement"; 60-99% are "moderate"; <60% are "split". This is more readable than Borda for telling Lihu "the team agrees on these 4, splits on these 6."

For most rounds, do **both** and present both views in `aggregate.md`.

### 6. Write Rank + Rationale into ideas.md

Edit `ideas.md` in place — populate the `Rank:` and `Rationale:` fields per idea. The `Rank` is the aggregated rank (Borda position). The `Rationale` is the orchestrator's distilled rationale: which criteria carried the rank, plus the convergence note ("4/4 prioritizers placed in top-5" or "split: 2 placed top-3, 2 placed bottom-3").

### 7. Surface decision dilemmas (z026 shape)

In `aggregate.md`, after the rankings, list the **decision dilemmas** that prioritization couldn't resolve:

- **Conflicts-with pairs where the team split.** Two valid rankings exist; pick one belongs to Lihu, not the team.
- **Strategic-fit divergence.** When two ideas have similar Borda totals but very different strategic implications, name the choice.
- **Cost-bracket boundary.** When the team picked top-K but K+1 is in the same total-score bracket — should we extend K?

z026 shape: Decision needed → Options → Lean → Why → Price → Risk → For you to weigh. No menu without a recommendation.

### 8. Commit + push

Two-stage:
1. After all prioritizers land + aggregate.md written: `prioritize(<topic>): N prioritizers' rankings + aggregate`.
2. After ideas.md edits: `prioritize(<topic>): ranked ideas.md (top-K + dilemmas)`.

### 9. Hand off to spec (or human)

The top-K from `aggregate.md` is the input to **spec** (one spec per top-K item, sequenced). If the human wants to override the top-K, they pick — and the override gets a zettel-capture (decision z020 shape).

## Where things land

Same as brainstorm/refine:

| Use case | Home |
|---|---|
| Gin-internal | `usegin/research/<topic>/prioritize/` |
| Shipping-product | Linear parent + sub-issues per prioritizer + `aggregate.md` as comment |

## Common mistakes

- **Solo prioritization.** Skipping the team because "I can rank these myself" — that's exactly the bias the team-form prevents.
- **Changing criteria mid-round.** Invalidates aggregation. Lock criteria.md before spawning.
- **Reading other prioritizers' rankings before submitting.** Independence violated; aggregation becomes meaningless.
- **Mono-priming the team.** All five prioritizers as "pragmatic PM" → identical rankings. Vary primings (3 distinct ones, doubled up if N>3).
- **Borda without convergence-bucket view.** Borda summary alone hides "the team agrees on top-3 but is split on rank-4 vs rank-5." Always present both.
- **Editing ideas.md before aggregate is settled.** Two-stage commit prevents this; don't shortcut.
- **No dilemma surfacing.** Prioritize that returns a ranked list with no `## Dilemmas` section under-uses the team — the disagreements are signal.
- **Treating gap-fills like first-class ideas.** They lack convergence; prioritizers should call out the lower-confidence tier.

## Friction-capture pointer for charters

> Capture friction as zettels via the `zettel-capture` skill. If a criterion is uninterpretable, if a context field is missing for an idea, if conflicts-with contradicts itself, if your priming feels off for the pool — name the fork (z009).

## At the end

- Closing zettel: `<topic>` prioritize produced top-`<K>` (`<X>` high-agreement, `<Y>` moderate, `<Z>` split). Decisions for Lihu: `<list>`.
- Hand off: spec on the top-K (sequenced) OR human-pick override.
- If the round produced a recurring pattern (e.g. "splits always cluster around strategic-fit"), capture as meta-zettel — feed back into criteria choice next round.

## Lab

See `.claude/skill-lab/prioritize.md`.
