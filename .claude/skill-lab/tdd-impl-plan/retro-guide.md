# tdd-impl-plan — Retro Guide

Evaluate how well the **planning session** was conducted. You are not judging whether the implementation worked — that's `tdd-execute`'s retro. You're judging the plan's quality.

## Context Sources

```bash
plan show <slice-id>                       # the slice in Linear
git show <commit-of-impl-plan>             # how the plan was committed
cat <path>/impl-plan.md                    # the artefact itself
cat <path>/test-plan.md                    # what it consumed
ls <slice-workspace>/events.jsonl          # if tdd-execute already walked it
```

If `tdd-execute` has walked the plan, also read `events.jsonl` for hindsight: which steps were resized, reordered, or split mid-flight? Hindsight informs the planner-perspective retro of *this* skill.

## Retro Steps

1. **Refuse-to-plan gate.** Did the input `test-plan.md` have an `outermost: true` test? If yes, did the planner verify? If no, did the planner refuse and surface the gap rather than plan around it?

2. **Coverage check.** Map every test row in `test-plan.md` to a step in `impl-plan.md`. Are any orphaned (test row with no step)? Are any steps unanchored (step without a test row)?

3. **Topology check.** Step 1 = `outer-red`? Last step = `outer-green` referencing the same `target_test_id`? No nested reds? Inner cycles ordered by `failure_mode_class`?

4. **Step-role discipline.** Are role tags applied consistently? Any `inner-green` step that's actually doing scaffolding work? Any `verification-only` step that should have been TDD'd?

5. **TDD-vs-verification rationale.** For every `tdd: false` step, is the reason in the allowed exception list (pure config, pure CSS, no-logic migration, intentional spike)? Any "we're in a hurry" disguised as a reason?

6. **TPP guidance.** Do `inner-green` steps have `transformation_hint.tpp_rank`? Is the rank reasonable for the test it's making green? Any rank-11 (function extraction) on a step that should have been rank 2 (fake-it)?

7. **Format-before-Red applied.** Were `pre_red.formatter_commits` emitted? If `tdd-execute` walked the plan, were the style commits actually landed before the first Red? Did formatter noise leak into Red diffs?

8. **Walking-skeleton appropriate.** If walking-skeleton steps were prepended, was the outer test genuinely unable to resolve? If skipped, did the outer-red's first run reveal an import/endpoint gap that should have been a skeleton step?

9. **Deferred-Red explicit.** Any step where the test asserts a surface that didn't exist until a later Green invented it? Tagged with `deferred_red: true`? Follow-up issue stub created?

10. **Mutation-pass calibration.** If the slice touched mirror invariants, concurrency, or external contracts, was `mutation_pass.required: true` set? If so, did the mutation list contain 3-7 mutations with `expected_to_be_caught_by`? Was each mutation actually caught at execution time?

11. **Sequential discipline.** Plan sequential? If parallel, was there a contract-first artefact + integration checkpoint? Was user opt-in explicit?

12. **Review and feedback applied.** Was the review unseeded (no "key questions")? Were ALL findings applied (no "scope-creepy" dismissals)? Single iteration only, or did the planner re-review?

## Verdict Scale

- **Worked well** — Plan walked end-to-end without re-ordering. No mid-flight surprises. Outer test went green at the predicted step. Mutation pass (if any) caught all listed mutations.
- **Partially followed** — Some signals pass, some fail. Plan needed minor reorders or had 1-2 missing inner cycles, but the discipline held overall.
- **Collapsed** — Plan abandoned mid-execution; `tdd-execute` improvised; outer-red went green at the wrong step (i.e. inner cycle accidentally fixed the outer test prematurely).

## Linkage

Invoked by the `skill-retro` skill when the session used `tdd-impl-plan`. Findings are written to `.claude/skill-lab/tdd-impl-plan/retros/YYYY-MM-DD-<slug>.md` using the standard retro entry format.
