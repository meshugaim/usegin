# tdd-impl-plan — Skill Lab (purpose)

## Intent

`tdd-impl-plan` exists because a test-plan describes *what* must be pinned but not *in what order* the pins go in. Real TDD is GOOS-shaped: one outer red holds the loop open while inner red/green/refactor cycles drive it green. Get the order wrong — chase a chaos test before the happy path is green, or skip the walking skeleton — and the cycle collapses into "write everything, then maybe write tests." The smoking-gun retro (ENG-1809; session `9e966133:L544` "I've been writing implementation, then tests after") shows what happens when TDD is loaded as text without a sequencing artefact: it routes around itself.

Success means: an `impl-plan.md` that an executor (human or `tdd-execute`'s Director) can walk one cycle at a time, with no re-ordering surprises, no mid-flight discoveries that should have been their own step, and no silently-dropped tests.

## Success Signals

- [ ] Input `test-plan.md` was validated against schema; refused if no `outermost: true` test
- [ ] Step 1 is `outer-red`; last step is `outer-green` referencing the same `target_test_id`
- [ ] No nested reds — every inner red has its red→green→(refactor|deferred) sequence completed before the next inner red
- [ ] Inner cycles ordered by `failure_mode_class` (happy → error → race → contract → chaos)
- [ ] Every step in the plan maps to a test in `test-plan.md` — no orphans either direction
- [ ] Formatter dirt detected and emitted as `pre_red.formatter_commits`; clean files NOT pre-formatted
- [ ] Walking-skeleton steps prepended only when outer test cannot resolve imports/endpoints
- [ ] Each step labelled `tdd: true` (default) or `tdd: false` with a real reason
- [ ] `transformation_hint.tpp_rank` set on every `inner-green` step
- [ ] Deferred-Red steps tagged with `deferred_red: true` + follow-up issue stub created
- [ ] `mutation_pass.required: true` set for high-risk slices (mirror invariants, concurrency, external contracts)
- [ ] Sequential by default; parallel only with explicit opt-in + contract-first artefact (ENG-2002)
- [ ] Single-iteration unseeded review applied (no re-review unless architectural)
- [ ] Plan committed alongside the `test-plan.md`
- [ ] Plan readable as a flat ordered list — no tree, no graph, no cross-cutting markers that aren't in the schema

## Known Limitations

- **Sizing is speculative.** The planner hasn't executed the cycles. Some inner cycles will turn out larger or smaller than predicted; this is healthy. The plan must be revisable mid-execution without losing the outer-loop discipline.
- **Walking-skeleton detection is static.** A static check ("does the outer test resolve imports?") catches gross gaps but not subtle ones (e.g. the endpoint exists but routes to a 500). `tdd-execute`'s first run of the outer-red will surface those.
- **TPP rank is advisory.** GreenTweaker may pick lower; the planner cannot enforce taste. Mandate #5 ("smallest legal transformation") is honor-system after the plan emits.
- **Mutation pass cost.** ENG-4934 took ~1 day for 9 mutations on one feature. Default-off is correct; over-aggressive opt-in burns budget. Open question §7 q3 of `99-design-memo.md`.
- **Cross-slice seams.** When two slices share contracts, the seam test usually lives in the consumer slice's plan with `external_dependencies` pointing at the producer. Confirmed in dry-run; revisit if seam tests cluster oddly.
- **Refactor-phase erosion risk.** Refactor allows both prod and test edits gated only on "tests are green." A refactor that loosens an assertion to keep tests green is hard to detect at planning time — it's caught downstream by `tdd-execute`'s DisciplineReviewer (open question §7 q5).
- **Format-detection over-eager.** If the formatter reports clean for files we *know* are dirty (or vice versa), the detection is wrong. Calibrate from dry-run #1 telemetry.

## Ideas / Notes

- **Empirical model: ENG-2697.** Description shape (test table + ordered production-code steps) is the closest existing artefact to this plan. Worth treating as the gold-standard manual version of what the skill produces.
- **DX Tip System lineage (ENG-4579→ENG-4582).** 4 slices, 40+ tests, 100% TDD adherence per `08-spec-flow-trace.md`. RED commits 11-30 minutes before GREEN commits — the cadence the planner should encode.
- **Fathom integration (ENG-2821).** Strong AC × test-level matrix, weak chaos coverage. 30+ bug sub-issues from race/optimistic-update/poll patterns the AC didn't anticipate. Reinforces: any AC mentioning polling/optimistic/retry/race gets a `failure_mode_class: race` row alongside happy.
- **ENG-5023 write-site enumeration.** Forensic table reconstructed *after* the bug. The planner should produce this *before* — `contract-check` role + dedicated step per writer.
- **ENG-5031 deferred-Red template.** Emit explicit marker + follow-up issue; do not silently drop. Pattern documented in SKILL.md.
- **ENG-4934 mutation-pass model.** Define the mutation list at planning time, not at execution time, so the planner knows which test rows it's relying on. `expected_to_be_caught_by` is the contract.
- **Sequential-by-default rule.** ENG-2002 retro after ENG-1624's parallel-Drive disaster. Holding line; resist parallelism even when slices "look independent."
- **Format-before-tdd evidence.** `feedback_format_before_tdd` traces the rule to a session where formatter noise polluted Red→Green diffs and reviewers accepted them as "minor." Pre-Red style commits resolve this.

## Changelog

| Date | Change | Motivation |
|------|--------|------------|
| 2026-04-26 | Lab created. | Built as part of the TDD skill trio (ENG-5365). Motivation: ENG-1809 enforcement gap + `9e966133:L544` smoking-gun. |
