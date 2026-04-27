# refine — Skill Lab

## Intent

Make the legibility step between brainstorm and prioritize a repeatable team move. Without a refinement layer, prioritize ends up ranking *framings* instead of *ideas*; with it, prioritize sees a clean pool where every idea has the structural metadata it needs to be ranked (cost-to-try, reversibility, prerequisites, blast radius, conflicts).

The skill exists because we observed in-flight: the brainstorm skill produces a flat noisy pool by design, and going straight to prioritize (without an intermediate sharpening step) wastes the prioritizer's tokens on disambiguation. Refine separates the *what is this idea* question (refine's job) from the *should we do it* question (prioritize's job).

The skill sits between `brainstorm` (divergent) and `prioritize` (convergent). It is the convergent-on-quality-not-on-rank step.

Success means: a refine round runs end-to-end (read pool → slice → spawn → merge → structural summary → hand off) without re-deriving the lifecycle, with the pool emerging as legible to a cold reader, and with prioritize able to start ranking immediately.

## Success Signals

When retroing a session that used this skill, a good session looks like:

### Slicing (the partition)
- [ ] Pool was sliced **by theme**, not random partition
- [ ] Each refiner owns ~10 ideas (sweet spot for context vs skim)
- [ ] Slicing.md exists at `<root>/refine/slicing.md` and names which refiner owns which ids
- [ ] No two refiners own the same idea

### Charter discipline
- [ ] Charters told refiners to read the **whole pool**, edit only their slice
- [ ] Charters enforced the legibility-not-ranking boundary explicitly
- [ ] Charters listed the four prioritize-prep fields: cost-to-try, reversibility, prerequisites, blast radius
- [ ] Charters included the friction-capture pointer
- [ ] Charters explicitly forbade ranking, deleting ideas, and committing

### Per-refiner output
- [ ] Each refiner sharpened titles to atomic claims ≤10 words
- [ ] Each refiner tightened one-lines to ≤2 sentences
- [ ] Each refiner added the four context fields to every idea they own
- [ ] Each refiner detected at least one semantic dup OR explicitly noted "no dups in slice"
- [ ] Each refiner detected at least one gap OR explicitly noted "no gaps in slice"
- [ ] Working notes (`refiners/<NN>-<theme>.md`) ≤30 lines, captured decisions + frictions

### Pool-level invariants (in-place edit)
- [ ] No idea was deleted (dups marked `Refined-merged-into:`, not removed)
- [ ] No reordering during refine (orchestrator does it at merge)
- [ ] No collision artifacts (two refiners' edits in the same bullet)
- [ ] Idea ids stable from brainstorm pool — no renumbering

### Merge + structural summary
- [ ] Orchestrator read all `refiners/*.md` notes before merging
- [ ] Cross-slice decisions (dups across slices, structural restructures, cross-cutting gap-fills) handled at orchestrator level
- [ ] Pool re-sorted: convergence-high first, then cost-small, then gap-fills last
- [ ] Structural summary at top of `ideas.md` (M ideas, K merged, G gap-filled, strongest convergence ids)

### Commits
- [ ] Two-stage: working-notes commit, then merged-pool commit
- [ ] No per-refiner commit storm

### Friction capture
- [ ] Charters pointed at `zettel-capture`
- [ ] Frictions logged live (broken `From:` refs, framing ambiguities, race conditions)

### Hand-off
- [ ] Prioritize or human-pick path explicitly chosen
- [ ] Closing zettel naming round + counts

## Known Limitations

- **Concurrent in-place edits to ideas.md are race-prone.** The skill mitigates by id-ownership boundaries, but a true file-locking / structured-edit primitive doesn't exist yet. v1 candidate: a `dx zettel ideas` (or similar) that loads the pool as structured data and re-emits markdown, so refiners write field-edits via CLI rather than text-edits.

- **Slicing-by-theme is judgment-driven.** No tool helps the orchestrator pick the slice boundaries. After 5+ rounds, look at whether theme-clusters were stable across rounds and whether a `dx ideas slice` command could pre-cluster.

- **Refiner depth is uneven.** A refiner who reads the whole pool may put more thought into their slice; one who skims produces shallow refinements. No mechanical enforcement; relies on charter wording.

- **Gap-fills aren't tested.** When a refiner adds a missing-sibling idea, it goes into the pool with no convergence signal — prioritize will see it as low-confidence. Mitigation: gap-fills get tagged explicitly (`From: refiner-NN (gap-fill)`) so prioritize can treat them as the lowest-confidence tier and the human can verify.

- **No semantic-dup detection support.** Refiners catch dups by reading; if they miss one, prioritize inherits both. Same gap as brainstorm's dedup-by-reading. Closes when embeddings land.

- **Conflicts-with are observational, not resolved.** Refine surfaces mutual exclusion but doesn't resolve it. Prioritize is supposed to use the conflicts-with metadata to avoid double-ranking. Verify in retros.

- **Sub-Gin can't fan out (z029 inherited).**

- **Friction-capture is honor-system.**

## Retro Guide

When `skill-retro` triggers a retro for `refine`, evaluate:

**1. Check legibility delta**
Pick three ideas. Compare the pre-refine bullet (in git history) to the post-refine bullet. Is the title atomic? Is the why concrete? Are the four context fields present and meaningful (not "medium / hard / none / dev-loop" everywhere)? If the delta is shallow, refiners didn't engage.

**2. Check dup detection**
Did any refiner detect a cross-slice dup? Did any get missed? Sample by re-reading the pool yourself and looking for restated ideas. Misses = signal that the slicing was off (themes too narrow) or that the refiners stayed in their slice instead of reading the whole pool.

**3. Check gap-fills**
Were gaps named with rationale? Were they marked as gap-fills (`From: refiner-NN (gap-fill)`) so prioritize can downweight them?

**4. Check the structural summary**
Was it written? Is it accurate? Does it give the prioritizer the orientation they need? If missing, refine half-shipped.

**5. Check the partition**
Did slicing happen by theme or by id-range? Random partition is a smell.

**6. Check the in-place invariants**
Were any ideas deleted? Were any renumbered? Were any reordered mid-refine? Any of these = invariant violations.

**7. Check the working notes**
Sample one `refiners/<NN>-<theme>.md`. ≤30 lines? Captures decisions and frictions? Or is it long-form prose? Long notes = the refiner used the wrong tool.

## Retros

| Date | Round | What happened | What the round taught us |
|---|---|---|---|
| *(pending — first round will land here)* | | | |

## Ideas / Notes

- **Refiner-of-refiners.** A second pass — one orchestrator-level Gin re-reads the merged pool and questions the refinement decisions. Worth trying once; risk of over-engineering.

- **Cost-to-try calibration sheet.** Maintain a per-domain calibration of what counts as small/medium/large effort, so refiners across rounds use comparable baselines. Add to `usegin/things-we-grow.md`.

- **Conflicts-with graph view.** Once we have multiple rounds, the conflicts-with edges across pools form a graph — clusters = mutually-exclusive feature families. Worth visualizing if we accumulate enough.

- **Refine-without-brainstorm.** When ideas come from somewhere other than a brainstorm round (a Linear comment thread, a Slack thread, a meeting note), can refine still operate? Charter would need a "import phase" first. Try.

- **Live-with-Lihu refine.** Variant where the human is in the loop, refining live with Gin pair-style instead of spawning refiners. For high-context topics. Captures via the same ideas.md format.

- **Auto-refine when N gap-fills exceed a threshold.** If refiners collectively name >3 missing siblings, the pool is structurally incomplete — auto-trigger another small brainstorm round on those gaps before prioritize. Worth coding into the orchestrator's merge step.

- **Refiners as zettel-readers.** Each refiner could be charter-told to scan related zettels (via grep) when refining ideas in their slice. Adds context but multiplies token cost. Try in a high-stakes round.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-04-27 | Skill created. Lab seeded. Sits between brainstorm and prioritize in the pipeline. Defines the four context fields prioritize will use (cost-to-try, reversibility, prerequisites, blast radius). | Lihu / Oria asked for the four team-skills modeled on rnd. Refine is the legibility step that makes prioritize possible on a noisy pool. Process-over-outcome (z086) — the goal is the pipeline, not any single round. |
