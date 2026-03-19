# slicing-specs — Skill Lab

## Intent

The slicing skill turns a spec into an ordered set of implementable vertical slices — each a Linear sub-issue with its own acceptance criteria, verification expectations, and seam notes. It exists because specs describe *what* to build, but agents need *how to sequence* the work. Bad slicing leads to slices that are too big (context pressure), wrong-ordered (pulling dependencies forward), or horizontal (touching one layer at a time instead of cutting through the stack).

The skill sits between `writing-specs` and `implementing-specs`. It consumes a spec with AC + verification expectations and produces the work breakdown that implementers execute against.

Success means: slices that an implementer can pick up one at a time, in order, without needing to relitigate scope, reorder work, or discover missing slices mid-flight.

## Two Retro Perspectives

Like `writing-specs`, this lab evaluates from two vantage points:

| Perspective     | When to trigger                                            | What it evaluates                                                                    | Retros go in          |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| **Slicer**      | After slicing is complete                                  | Did the process produce good slices? (decomposition quality, ordering, descriptions) | `retros/slicer/`      |
| **Implementer** | After implementation is complete (or multiple slices done) | Did the slices serve the implementer well? (hindsight evaluation)                    | `retros/implementer/` |

The slicer perspective evaluates the slicing session itself. The implementer perspective evaluates the slices' quality with the benefit of having built from them.

**Routing for `skill-retro`:**
- If the session **sliced a spec** → use the **Slicer** perspective
- If the session **implemented slices** → offer as a follow-up alongside the writing-specs implementer retro. Use the **Implementer** perspective
- Never mix perspectives in one retro entry

---

## Slicer Perspective

### Success Signals

**Understanding:**
- [ ] Full spec was read — all AC and verification expectations identified
- [ ] Codebase was explored — referenced files, existing patterns, infrastructure gaps found
- [ ] Open questions or ambiguities surfaced to the user before proposing slices

**Decomposition quality:**
- [ ] Every spec AC maps to at least one slice — no orphan criteria
- [ ] Infrastructure needs extracted into dedicated slices, not buried inside feature slices
- [ ] Slices are vertical — each touches all layers it needs (DB → API → UI), not one layer at a time
- [ ] Each slice is right-sized — one migration max, implementable in a single agent session
- [ ] No slice is trivially small (overhead exceeds value) or dangerously large (context pressure risk)

**Slice descriptions:**
- [ ] Each slice has its own AC, tightened from spec-level criteria to be directly testable
- [ ] Each slice has verification expectations with test levels
- [ ] Seam notes describe dependencies on previous slices and what this slice provides to future ones
- [ ] Context section points at key files and patterns to follow
- [ ] Slices are self-contained enough to implement without reading the parent spec (but parent spec provides the "why")

**Ordering:**
- [ ] Infrastructure / shared foundations come first
- [ ] Riskiest or least-understood slices come early (de-risk before building on assumptions)
- [ ] Dependencies are respected — no slice requires output from a later slice
- [ ] Seam-adjacent slices are neighbors (shared contracts are fresh in context)

**Process:**
- [ ] All slices presented to user at once as a summary
- [ ] User feedback solicited via `AskUserQuestion` before creating issues
- [ ] Changes incorporated after feedback (not ignored)
- [ ] Sub-issues created in Linear with full descriptions
- [ ] Slice map appended to parent issue with ordering rationale and cross-slice verification items

### Retro Guide

**Context sources:** Read the session transcript *and* check the Linear output directly. The slicer's output lives in Linear — the session shows process, Linear shows the result.

```bash
plan show <spec-issue-id> --tree   # Slice map + sub-issues
plan show <slice-issue-id>         # Individual slice descriptions
```

1. **Check coverage** — Map every spec AC to slices. Are any criteria orphaned (described in spec, missing from slices)? Are any slices untraced (not connected to a spec AC)?
2. **Check slice shape** — Are slices vertical (touching all needed layers) or horizontal (one layer at a time)? A slice that's "add DB table" without the API or UI that uses it is a red flag unless it's an explicit infrastructure slice.
3. **Check sizing** — Look at each slice's scope. Could any be too large (multiple migrations, spans too many concerns)? Too small (a trivial change that doesn't warrant its own issue)?
4. **Check ordering** — Does the proposed order respect dependencies? Is the riskiest work near the front? Would you reorder anything knowing what you know?
5. **Check descriptions** — Read 2-3 slice descriptions from Linear (`plan show`). Do they have AC, verification, seams, and context? Could an implementer start from just the slice issue without confusion? Are the ACs tightened (precise, testable) or just copied from the spec?
6. **Check seams** — Are the boundaries between slices clearly described? Where slices share types, API contracts, or DB schema, is this noted in both adjacent slices?
7. **Check process** — Was the user consulted before creating issues? Was feedback incorporated? Was the slice map added to the parent issue?

---

## Implementer Perspective

*Evaluating the slices' quality — with the benefit of having implemented them.*

### Success Signals

**Did the slices orient me well?**
- [ ] Slice descriptions were sufficient to start without reading the full parent spec
- [ ] Key files and patterns listed were accurate and relevant
- [ ] Seam notes told me what I needed about adjacent slices

**Did the slices hold up during implementation?**
- [ ] Slice sizes were right — no slice caused context pressure or felt trivially small
- [ ] Ordering was correct — I didn't need to pull work forward from future slices
- [ ] Slice-level AC was testable and precise (not vague spec-level criteria copy-pasted)
- [ ] Verification expectations pointed me at the right test levels
- [ ] No missing slices — I didn't discover significant work that should have been its own slice

**Did the seams work?**
- [ ] Shared types/contracts from earlier slices held up for later slices
- [ ] No major rework across slice boundaries
- [ ] Infrastructure slices provided what feature slices needed

### Retro Guide

*The question is: knowing what I know now, how good was the decomposition?*

**Context sources:** Read the session transcript and check Linear for the slice issues and parent spec. Compare what the slices said the implementer would need against what they actually needed.

```bash
plan show <spec-issue-id> --tree   # Current state of all slices
plan show <slice-issue-id>         # Individual slice as-written vs as-implemented
```

1. **What was mis-sized?** — Slices that were too big (context pressure, had to hand off mid-slice) or too small (spent more time on issue overhead than actual work). What would the right size have been?
2. **What was mis-ordered?** — Slices where you had to pull dependencies forward from a later slice, or where you did work that would have been easier if a different slice had gone first.
3. **What was missing?** — Work you discovered mid-implementation that should have been its own slice. Infrastructure that wasn't anticipated. Edge cases that deserved dedicated slices.
4. **What seams broke?** — Places where the boundary between slices didn't hold. Contracts that changed. Types that needed revision after the slice that introduced them was already done.
5. **What slice descriptions were insufficient?** — Slices where you had to go back to the parent spec, explore the codebase extensively, or ask the user because the slice issue didn't give you enough to start.
6. **What was well-decomposed?** — Slices that felt natural to implement. Good ordering that built momentum. Seam notes that prevented friction. Infrastructure slices that paid off.

---

## Known Limitations

- **Slicing is speculative.** The slicer hasn't implemented the feature — sizing and ordering are informed guesses. Some re-ordering during implementation is expected and healthy, not a failure.
- **Slice descriptions can't anticipate everything.** The implementer will always discover details the slicer couldn't predict. The goal is minimizing surprises, not eliminating them.
- **Cross-slice verification is deferred by design.** Some AC can only be verified after all slices land. This is a feature (avoids premature integration), not a gap — but it means the slicer must explicitly mark these items.
- **The slicer and implementer are usually different sessions.** The slicer has the spec fresh in mind; the implementer may pick up days later. Slice descriptions must be durable enough to bridge this gap.

## Ideas / Notes

- The writing-specs lab notes in Ideas: "If this perspective proves valuable, consider adding it to other skills (slicing-specs, implementing-specs)." This lab follows through on that suggestion.
- The Linear integration spec (ENG-2004) was sliced into 7 slices and is being implemented — the first implementer retro for writing-specs (2026-03-11) covers slices 1-2. An implementer retro for this lab should follow once more slices are done.
- **Pipeline retro:** Each skill in the pipeline (writing-specs → slicing-specs → implementing-specs → verify-spec) has its own lab evaluating its own module. A separate pipeline-level retro should integrate insights across all modules before making changes to any individual skill. This prevents local optimizations that hurt the whole — e.g., adding detail to the spec that the slicer then has to decompose, that the implementer then has to work around. The pipeline retro is a cross-cutting concern, not owned by any single lab.
- **Review-then-revise pattern (2026-03-19, ENG-2821):** The Fathom integration slicing went through an initial slice → retro feedback → revision cycle. The revision addressed every concern (sizing, verticality, missing slice map, external deps). The revised decomposition was significantly better than the initial pass — vertical tool integration, right-sized slices, clean seams. One data point, but suggests that a review pass before implementation begins is worth the overhead for large specs (40+ AC). If this pattern keeps proving valuable, consider making it a recommended step in the skill.

## Changelog

| Date       | Change                                             | Motivation                                                                                                                                                                    |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-11 | Lab created with slicer + implementer perspectives | Pipeline gap: writing-specs had a lab, slicing-specs and implementing-specs did not. Created to enable retros on the slicing process and the quality of slice decompositions. |
| 2026-03-19 | Added review-then-revise observation to Ideas | ENG-2821 Fathom retro: initial slicing improved significantly after feedback cycle. Sizing heuristic (~6 AC) and vertical tool integration baked into the skill itself. |
