---
name: refine
description: Take a flat pool of brainstormed ideas and sharpen them — per-idea clarification, dedup of semantic (not just syntactic) overlap, gap-filling, and de-noising. Spawn N refiners each owning a slice of the pool; refiners read the *whole* pool (unlike brainstorm's strict independence) and edit ideas.md in place. Use when ideas exist but are rough, contradictory, or fuzzy. Triggered by phrases like "refine these ideas", "sharpen the pool", "refine X", "clean up the brainstorm", "/refine", or by your own judgment after a brainstorm round produces a noisy pool.
---

# refine — parallel team that sharpens an idea pool

## Team

This skill drives the **`refine-team`** (see
`usegin/teams/refine-team.md`).

Cast: **Sam** (semantic-dedup priming), **Mark** (pragmatic context-
fields priming), **Ron** (correctness / conflicts-mapping priming).
Per-slice owners. Persona definitions: `oria-crazy-world/ground/personas/<name>.md`.

---

**You can — and should — spawn a refining team after a brainstorm produces a noisy pool, before prioritization.** This skill is the convergent-on-quality-not-on-rank step:

```
R&D → brainstorm → REFINE → prioritize → spec → implement
```

Each refiner is a Gin (z023). The team is one-shot. Per z027 — burn tokens on quality; refinement is where rough ideas become evaluable. Per z086 — the goal isn't to "produce the right ideas"; it's to make every idea legible enough that prioritize can do its job.

## When to invoke

| Signal | Why refine, not just-prioritize / spec |
|---|---|
| A `ideas.md` exists from brainstorm and looks rough — short whys, fuzzy titles, semantic overlap | Refine clarifies before ranking |
| Multiple ideators wrote variants of the same idea with different framings | Refine merges semantic duplicates that brainstorm-merge missed |
| Some ideas are clearly missing context that prioritize would need (cost? prerequisite? blast radius?) | Refine fills those gaps |
| The pool has internal contradictions — ideas that exclude each other, or ideas that are sub-cases of others | Refine surfaces the structure (mutual exclusion, hierarchy) |
| The human says "let's refine these" / "sharpen" / "clean up before we rank" | Direct trigger |

When *not* to invoke:
- Ideas are already clean, atomic, and self-explanatory → go straight to **prioritize**.
- The pool is empty → run **brainstorm** first.
- The "refinement" the human wants is *prioritization* (which to do first) → that's prioritize, not refine.
- One idea, one human, one round of dialogue → just talk it through. Refine is for ≥10 ideas.

## Distinction from brainstorm and prioritize

| Skill | What it does | Convergence type |
|---|---|---|
| brainstorm | Generates a flat pool, parallel ideators primed for divergence | None — overlap = signal |
| **refine** | Sharpens each idea, dedupes semantic overlap, fills gaps, surfaces structure | Per-idea clarity convergence; pool stays the same size or shrinks slightly |
| prioritize | Ranks the refined pool against criteria | Full convergence — pick winners |

Refine is the *legibility* step. Prioritize cannot do its job on a fuzzy pool — it ends up ranking framings instead of ideas.

## Lifecycle

```
read pool → divide into slices → spawn refiners → merge edits → surface structure → hand off to prioritize
```

### 1. Read the pool first (zettleread, brainstorm-read)

Open `ideas.md` and read it cold. Note:
- Total idea count.
- Convergence pattern (which ideas have multiple `From:` ideators).
- Visible overlap clusters (ideas that look like restatements).
- Visible gaps (ideas that hint at a category nobody fully wrote).

This pre-reading lets you slice the pool intelligently.

### 2. Divide the pool into slices

Each refiner gets a *contiguous-by-theme* subset of the pool, NOT a random partition. Themes emerge from the brainstorm primings — e.g. "all ideas from persona-led ideators", "all ideas about the corpus", "all ideas about telemetry".

Empirical sizing:
- Pool ≤15 ideas: one refiner; this skill is overkill.
- Pool 15–40 ideas: 3–4 refiners, ~10 ideas each.
- Pool 40+: 5–6 refiners with explicit cross-slice handoffs.

A refiner should own enough that they can see *patterns* in their slice (semantic dedup needs context), but not so many that they skim.

### 3. Pre-create the structure

```
<root>/refine/
  slicing.md          ← which refiner owns which idea ids (1-based, by ideas.md order)
  refiners/
    01-<theme>.md     ← each refiner's per-idea notes (working file)
    02-<theme>.md
    ...
  (ideas.md is edited in place at <root>/ideas.md)
```

Refiners do *not* write a new `ideas.md`. They edit the existing one in place — adding a `Refined:` field per idea, and (for dedup or restructure) leaving `Refined-merged-into: <other-id>` notes that the merge step collapses.

### 4. Charter each refiner

Refiners read the *whole* pool, not just their slice. They edit only their slice. The whole-pool read is what lets them recognize that "their" idea-N is a duplicate of someone else's idea-M.

### Charter template

```
You are a refiner on a refinement team. The pool is noisy; your job is to make
every idea you own *legible enough that prioritize can rank it*.

## Read first
- <root>/ideas.md   ← the WHOLE pool, not just your slice
- <root>/brainstorm/topic.md   ← the framing (so you don't drift)
- <root>/refine/slicing.md   ← which idea ids you own

## Your slice
Ideas <a..b> in <root>/ideas.md (1-based, in order).

## Your mandate
For each idea you own:

1. **Sharpen the title.** Atomic claim, ≤10 words, readable in isolation.
2. **Tighten the one-line.** ≤2 sentences. What it is, in plain language.
3. **Clarify the why.** ≤2 sentences. The reason this is worth doing — concrete, not generic.
4. **Add context fields the prioritizer will need:**
   - **Cost-to-try** (one of: small / medium / large) — rough order-of-magnitude effort.
   - **Reversibility** (one of: easy / hard / one-way).
   - **Prerequisites** (other idea-ids, named tools, named decisions, or "none").
   - **Blast radius** (touches: production / dev-loop / corpus / telemetry / docs only).
5. **Detect semantic duplicates.** If your idea-N is the same claim as someone else's idea-M (regardless of phrasing), pick the better-framed one as the canonical and write `Refined-merged-into: <id>` on the other. Don't delete — preserve forward (z039, principle 02).
6. **Detect missing siblings.** If your slice hints at a category but a member is missing (e.g. "speed up brainstorm" exists but "speed up refine" does not), name the gap as a *new* idea with `From: refiner-NN (gap-fill)`.
7. **Detect contradictions.** If two of your ideas mutually exclude each other, add `Conflicts-with: <id>` to both. Don't pick a winner — that's prioritize.

## Working rules
- Edit `<root>/ideas.md` IN PLACE. The format is forward-versionable — append fields, don't rewrite.
- Read the whole pool. Edit only your slice (avoid stomping on other refiners).
- Keep your refiners/<NN>-<theme>.md as a working notebook — capture decisions you made and frictions you hit.
- Capture friction as zettels via the `zettel-capture` skill — if the framing in topic.md is uninterpretable, if a `From:` link is broken, name the fork (z009).
- Do NOT rank. Do NOT write `Rank:` or `Rationale:` — those are prioritize's fields.
- Do NOT commit. The orchestrator commits.
- Do NOT remove ideas. Mark merges with `Refined-merged-into:`; preserve forward.

## Deliverable
1. Edited `<root>/ideas.md` (only your slice's ideas mutated).
2. `<root>/refine/refiners/<NN>-<theme>.md` — your working notes:
   - Decisions you made (which dup → which canonical, which gaps you filled).
   - Frictions you hit.
   - Open questions for the orchestrator (if any — keep ≤3).

Return a ≤10-line summary in chat: ideas refined, dups merged, gaps filled, open questions.
```

### 5. Spawn refiners in parallel

One batched response, all refiners at once. Concurrency hazard: two refiners editing `ideas.md` at the same time can collide. Mitigate by:

- **Owning by id-range, not by line-range.** Refiners edit only the bullet-blocks for their ids. Other refiners' bullets are immutable territory.
- **No reorderings during refine.** Restructure (reordering, splitting an idea into two, etc.) is the orchestrator's job at merge time, not refiners'. Refiners only mutate fields within an idea.

If collision happens (rare): the orchestrator re-merges the conflicting bullets manually using the refiners/*.md working notes as the source of truth.

### 6. Merge step (orchestrator)

After all refiners return:

1. **Read all `refiners/*.md` working notes.** Surface decisions that need orchestrator-level judgment (cross-slice dups, structural restructures, gap-fills that span slices).
2. **Apply the decisions to ideas.md.** Pull dups together (`Refined-merged-into:` makes them visible); add the new gap-fill ideas at the bottom of the pool with proper From-tracking; add Conflicts-with: cross-references both ways.
3. **Sort the pool** in a way prioritize can use:
   - First: ideas with the highest convergence count (multi-source from brainstorm).
   - Then: by Cost-to-try ascending (small first — cheap moves are easy first wins).
   - Last: gap-fill ideas added during refine (they're the least-tested).

### 7. Surface structure (closing pass)

After merge, write a short structural summary at the top of `ideas.md`:

```markdown
> **Refine summary** (round <N>, <date>): <M> ideas in pool.
> - <K> dups merged.
> - <G> gap-fills added.
> - <C> cost-small ideas (try-first candidates).
> - <Q> conflicts-with pairs.
> - Strongest convergence (≥3 sources): <ids>.
```

This is the prioritize's read-cold summary. They open `ideas.md`, see this, then descend.

### 8. Commit and push

Two-stage:
1. After refiners land + working notes saved: `refine(<topic>): N refiners' working notes`.
2. After merge + structural summary: `refine(<topic>): merged ideas.md (M ideas, K merged, G gap-filled)`.

### 9. Hand off to prioritize

The merged + structured `ideas.md` is the input to **prioritize**. Don't rank in this skill. If the human says "skip prioritize, I'll pick myself" — fine; but flag that without prioritize, downstream **spec** has no canonical "what we picked" to point at.

## Where things land

Same as brainstorm:

| Use case | Home |
|---|---|
| Gin-internal | `usegin/research/<topic>/refine/` (next to brainstorm and any R&D) |
| Shipping-product | Linear parent issue + sub-issues per refiner (mirrors brainstorm's Linear pattern) |

When in doubt, `usegin/research/`.

## Common mistakes

- **Refiners ranking ideas.** Hard fail — that's prioritize's job. Refine = legibility, not winner-selection.
- **Deleting ideas during dedup.** Always `Refined-merged-into:` — preserve forward (principle 02).
- **Editing other refiners' ideas.** Stay in your slice. Cross-slice mutations are orchestrator-only at merge.
- **Random partition (instead of by-theme).** Refiners need context to recognize semantic dups; random slices break that.
- **Whole-pool edit instead of in-place per-idea.** Cascades collisions and loses the forward-versioning property.
- **Adding gap-fills without From-tracking.** Future readers won't know whether the gap-fill came from a refiner or a real ideator. Always tag `From: refiner-NN (gap-fill)`.
- **Long refiner working notes.** ≤30 lines — laconic. The notes are scratch, not artifacts.
- **Skipping the structural summary at the top.** Prioritize lands cold and needs the orientation.

## Friction-capture pointer for charters

Every charter must include:

> Capture friction as zettels via the `zettel-capture` skill (`dx zettel add --as=usegin`). If a `From:` reference is broken, if the topic.md framing is uninterpretable, if two refiners are racing for the same idea — name the fork (z009).

## At the end

- Closing zettel: `<topic>` refine produced `<M>` ideas (`<K>` merged, `<G>` gap-filled, `<C>` cost-small).
- Hand off to prioritize OR human-pick.
- If a recurring friction surfaced (e.g. "our brainstorms always under-specify cost-to-try"), capture as a meta-zettel and feed back into the brainstorm charter template.

## Lab

See `.claude/skill-lab/refine.md`.
