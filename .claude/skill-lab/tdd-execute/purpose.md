# tdd-execute — Skill Lab (purpose)

## Intent

The `tdd-execute` skill is the third and load-bearing skill in the TDD trio. Where `test-architecture` produces the typed test-plan and `tdd-impl-plan` produces the ordered execution sequence, `tdd-execute` is the executor — it walks `impl-plan.md` one Red-Green-Refactor cycle at a time and is the only skill in the trio that touches code. It exists because every prior attempt to make Claude follow TDD by exhortation has failed: ENG-1809 (the founding liaison-honesty retro) names the gap directly — the liaison says "TDD" and every implementing agent writes tests alongside code, with no enforcement mechanism — and session `9e966133` is the canonical proof, where in slice 2 of ENG-4321 the assistant admitted "Honestly: no, I haven't been. I've been writing implementation, then tests after." This skill exists to make that routing structurally impossible, not merely prohibited.

The design is a disciplined Director (Opus) that orchestrates but cannot edit, paired with three role-isolated stateless one-shot sub-agents (Haiku RedTweaker, Haiku GreenTweaker, Opus DisciplineReviewer) and a skill-scoped `PreToolUse` hook that reads `state.json.phase` and physically denies phase-illegal edits — including the Director's. The hook is symmetric to caller identity by design: the same enforcement that catches a runaway tweaker also catches a Director that, under load, is tempted to "just write the test and the impl in one shot." Empirically this gap is the one pure sub-agent isolation cannot close (07-enforcement §7.2). ENG-2030 (GFS Sync Unification, 14 weakened assertions) is what the gap costs in production — workers deleted/weakened assertions across a multi-phase refactor and the liaison accepted "tests pass" as the green signal because no one was reading test diffs. `tdd-execute`'s commit cadence (one phase = one commit) and DisciplineReviewer's per-cycle `git diff -- '*/tests/*'` inspection close that hole too.

The skill is the enforcement vehicle for all twelve mandates from memo §3 — some by hook, some by sub-agent constraint, some by reviewer brief, some honor-system with mutation-pass as backstop. It does NOT plan, order, or pick layers (those belong upstream). It does NOT parallelize (Mandate #3 — sequential by design). It does NOT implement TCR in v1 (over-investment per 07-enforcement §7.1). It is deliberately the heaviest of the three skills because it touches every mandate; a session-retro of `tdd-execute` therefore has the most signals to inspect.

## Success Signals

When retroing a session that used this skill, a good session looks like:

- [ ] Director never edited code or tests directly (no Edit/Write tool calls from the orchestrator turn)
- [ ] Hook denied at least one Director edit attempt across the slice — proof the hook fires under load. Zero deny events across an entire slice = hook may be broken
- [ ] Step 1 was `outer-red`; final step was `outer-green`; both reference the same `outermost: true` `target_test_id` (Mandate #2, #11)
- [ ] Each Red phase had a DisciplineReviewer pass before the test-commit (`feedback_red_reviews` — never skipped)
- [ ] Each Green phase had a verifier revert/restore proof recorded in `events.jsonl` (`feedback_green_right_reason` — xfail-flips-to-pass is not enough)
- [ ] Verifier and DisciplineReviewer were separate Opus invocations (`feedback_phase_separation`)
- [ ] No assertion weakening across phases — verified via diff inspection of `git diff -- '*/tests/*'` at every Green and Refactor (`feedback_companion_session_findings`, ENG-2030 lesson)
- [ ] Refactor decisions explicit — either a `refactor:` commit or an `events.jsonl` `kind:defer` with reason (Mandate #6 mandatory-decision)
- [ ] One commit per phase transition; subjects follow `style:` / `test:` / `feat:` / `refactor:` convention (Mandate #10)
- [ ] Style commits landed before step 1 Red, with `style(...)` subjects, no semantic changes (`feedback_format_before_tdd`)
- [ ] Reviewer briefs were unseeded — `git diff` + step row + plan pointer only, no "key questions" (`feedback_liaison_review_seeding`)
- [ ] Every reviewer finding was applied — none triaged as "scope-creepy" or deferred without explicit pushback to the reviewer (`feedback_liaison_fix_everything`)
- [ ] Single iteration per phase — at most one re-spawn after fixes, no re-review unless the fix was architectural (`feedback_single_iteration_review`)
- [ ] Tweakers were Haiku, Reviewer/Verifier were Opus (check `events.jsonl` `model` field on each entry)
- [ ] Tweakers were stateless one-shot — no carry-over context evidence (each spawn brief was self-contained)
- [ ] `state.json` updated atomically (write-temp-then-rename); never partial writes
- [ ] `events.jsonl` strictly append-only — no edits to prior lines, no overwrites
- [ ] Test list drained at completion — `step_index == plan.steps.length`
- [ ] Outer test (`outermost: true`) green at completion — confirmed by a final full-suite run, not just the `outer-green` step's single-test run
- [ ] Mutation pass run iff `mutation_pass.required: true` in the impl-plan; every listed mutation caught by ≥1 of its `expected_to_be_caught_by` tests; uncaught mutations surfaced as Linear follow-up issue stubs (ENG-4934 model)
- [ ] No xfail / `test.failing` markers left in code without a Linear issue ref (Pattern D mitigation; per `tdd-ci`)
- [ ] No Director use of `crun` to spawn tweakers — all sub-agents via `Task` so hooks fire (07-enforcement §3.3)
- [ ] No `--no-verify` on any commit (project CLAUDE.md)
- [ ] Push to main happened after every commit (per `feedback_always_push`)

## Known Limitations

- **Honor-system mandates remain.** Mandate #7 (tests assert behaviour, not implementation), Mandate #12 (test resilience), and parts of Mandate #5 ("smallest legal transformation" being actually smallest) cannot be mechanically gated. The DisciplineReviewer's brief carries the smell list and the resilience heuristic; mutation-pass is the operational backstop for high-risk slices. These are explicitly named in memo §6.
- **"Right reason" failure is a model judgment.** The verifier's revert/restore proof catches "test was already passing"; it does NOT catch "test fails for the wrong reason" (e.g. import error vs assertion error). DisciplineReviewer's Red-review brief includes the right-line check, but it's semantic — not mechanical (memo §6 honor-system list).
- **Mock-can-lie audits are upstream.** `test-architecture` writes the `mock_can_lie_note`; `tdd-execute` does not re-audit. If a mock lies and the upstream skill missed it, the failure surfaces only in production or in the mutation pass.
- **Refactor-phase erosion risk.** Per memo §7 q5 — Refactor allows both prod and test edits. Risk: a refactor-mode tweaker loosens an assertion under the cover of "improving structure." Mitigation: DisciplineReviewer's Refactor-phase brief runs the same CLEAN/JUSTIFIED/VIOLATION check as Green (ENG-2030 lesson, `feedback_companion_session_findings`). Confirm in dry-run.
- **Taste-of-smallest-step is judgment.** GreenTweaker is line-budgeted (50) and hint-biased (TPP rank), but a 49-line speculative change technically passes the budget. Reviewer call.
- **Parallel pre-prep workspaces (memo §7 q1).** Lazy-create is the default; whether pre-creating sibling workspaces causes hook-climb confusion is open until dry-run. The hook-climb logic must work either way.
- **Test resilience is a clean-room judgment.** The skill cannot prove a test would survive a clean-room re-implementation. Mutation-pass is the closest operational signal we have, and it's opt-in (memo §7 q3 — encouraged for `failure_mode_class: contract` and `race`, default-off).
- **`SubagentStop` hook is unverified in our harness (memo §7 q4).** If it exists, it's the cleanest place to revalidate tweaker frontmatter before control returns to the Director — would strengthen M1.5. Held off as a 30-min spike for after first dry-run.
- **TCR (M2) is deliberately not implemented.** 07-enforcement §7.2 — over-investment for v1; the failed Green attempt's diff is preserved in `state/last-failed-attempt.diff` and re-spawned with feedback (07-enforcement §4.4). Re-evaluate only if first-attempt failure rate >50% across the first 3 dry-run features.
- **Honor-system items propagate from upstream.** If `tdd-impl-plan` mis-orders cycles (e.g. a chaos test as the first inner red), the Director walks the bad order. Surface mismatches in retro, but do not silently re-order at execution time.

## Ideas / Notes

- **Empirical anchors:**
  - **ENG-1809** — founding liaison-honesty retro. The whole reason this skill exists. "TDD" as text without enforcement is the gap.
  - **Session `9e966133:L544`** — the canonical confession ("I've been writing implementation, then tests after"). Pattern A (test-after disguised as TDD) made concrete. Drives the Director-cannot-edit constraint and the symmetric hook.
  - **ENG-2030** (GFS Sync Unification) — 14 weakened assertions across multi-phase refactor; "tests pass" accepted without diff inspection. Drives DisciplineReviewer's per-cycle test-diff inspection (`feedback_companion_session_findings`) and the verifier's revert/restore proof.
  - **ENG-2697** — hidden weakening of trigger CASE; reviewer model session. Drives the Refactor-phase diff-erosion check.
  - **`4b1e9ef8`** — reference good-case (test list explicit, drained). Shape the Director's loop targets.
  - **ENG-4934** — gold-standard post-hoc mutation-pass. Operationalizes Mandate #12. Cross-linked from `failure_mode_class: contract` / `race` rows so `tdd-impl-plan` opts the slice in.
  - **ENG-4922** / **ENG-5023** — write-site / mirror-invariant lesson. Drives the `contract-check` step role and the mutation-pass default-on for those failure-mode classes.
  - **ENG-5031** — disambiguation test couldn't exist at Red because the disambiguating signal was Green's invention. Drives the `deferred_red` walking pattern (test-architecture marks; tdd-impl-plan orders; tdd-execute walks).
- **Director sees diff-stat, not diff content** (memo §7 q2). Tradeoff: full diff goes only to DisciplineReviewer; Director sees `git diff --stat` (lines+/-, files) for sanity-check decisions only. Confirm in dry-run that summarized counts are sufficient for state-tracking decisions; if Director needs full diff for any decision, revisit.
- **`SubagentStop` spike (memo §7 q4)** — worth a 30-min check after first dry-run. If the harness fires it, a 30-line frontmatter-revalidator hook is cheap, additive, M1.5.
- **TCR (M2) hold (memo §7 q6)** — re-evaluate after first 3 dry-run features. If GreenTweaker first-attempt failure rate >50% at line-budget, TCR becomes attractive. Until then, last-failed-attempt.diff + re-spawn-with-feedback is the lighter alternative.
- **Cross-slice seam testing (memo §7 q7)** — default: integration test between two slices is an `outermost: true` test in the consumer slice's plan, with `external_dependencies` pointing to the producer's contract. Confirm composition when running two slices back-to-back.
- **Single-iteration discipline matters most here.** `tdd-execute` runs the most reviews of any skill (Red, Green, Refactor — three per cycle). Re-review traps compound across cycles. `feedback_single_iteration_review` is binding.
- **Hook fires zero times = suspect.** A working hook will catch at least one accidental Director edit per slice. Treat zero deny events as a smoke alarm; verify hook is wired before declaring the slice done.

## Changelog

| Date | Change | Motivation |
|------|--------|-----------|
| 2026-04-26 | Lab created | ENG-1809 / session `9e966133:L544` enforcement gap; ENG-2030 14-assertion erosion; memo §4c sub-agent topology + skill-scoped hook contract decision-ready. Trio: `test-architecture` + `tdd-impl-plan` + this skill. |
