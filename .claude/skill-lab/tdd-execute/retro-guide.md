# tdd-execute — Retro Guide

This guide is invoked by the `skill-retro` skill (which reads the SPLIT layout: `purpose.md` + `retro-guide.md`). Use it to evaluate how well a session followed the `tdd-execute` skill.

The question we're answering: **did the slice land with TDD discipline structurally enforced, or did the agent route around it?** This skill has the most signals because it touches every mandate.

## Context Sources

- **Linear:** the slice issue and parent spec issue. `plan show <slice-id>` for slice description; `plan show <spec-id> --tree` for the slice map.
- **The artefacts:**
  - `<feature>/test-plan.md` (from `test-architecture`) — the upstream contract.
  - `<feature>/impl-plan.md` (from `tdd-impl-plan`) — the executed plan.
  - `.tdd-execute/<slice-id>/state.json` — final state. Should be `phase:complete`, `step_index == steps.length`.
  - `.tdd-execute/<slice-id>/events.jsonl` — append-only audit log. **The single richest source for retro.** Read top-to-bottom.
- **Git log:** `git log --oneline <style-commit>..<outer-green-commit>` — the executed commit sequence. Compare against impl-plan order.
- **Diff for erosion check:** `git diff <style-commit> <outer-green-commit> -- '*/tests/*' '*.test.*' 'test_*.py'` — every change to test files across the slice. Look for assertion deletions / loosening.
- **Session transcript:** Director's tool calls. The Director should have made *zero* `Edit`/`Write` calls on source paths.

## Retro Steps

For each step, **what counts as a problem** is in italics.

1. **Hook fired? (load-bearing.)** Grep `events.jsonl` for `kind:deny` entries.
   - *Problem if:* zero deny events across the entire slice. The hook may not be wired (skill not active, matcher mismatch, hook file missing). A working hook will catch at least one accidental Director edit per slice — that is a design feature. Verify the hook file exists at `.claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts` and is declared in SKILL.md frontmatter.

2. **Director never edited code.** Read the session transcript for tool calls in the Director turn.
   - *Problem if:* any `Edit`, `Write`, or `MultiEdit` tool call from the Director on a source path. Worse: any `Bash` call with `cat >`, `tee`, or `>>` redirecting into a source path (heredoc-bypass). If the hook denied them — good, the hook works. If they landed — the hook is broken.

3. **State.json transitions monotonic.** Walk `events.jsonl` `kind:advance` entries.
   - *Problem if:* phases skipped (`red` → `refactor` without `green`), `step_index` jumped non-monotonically, or any state-write that isn't atomic (look for half-written `state.json` events or partial JSON). Each cycle should follow `red → green → refactor → red(next)` strictly.

4. **Commit sequence matches phase transitions.** `git log --oneline` between style-commit and outer-green-commit. Cross-check against `events.jsonl` `kind:commit` entries.
   - *Problem if:* commit subjects don't follow the cadence (`style:` → `test:` → `feat:` → `refactor:`); commit count != phase-advance count; commits batched across multiple phases (`feat: green + refactor` style); any commit with `--no-verify` (per project CLAUDE.md, never).

5. **Each Red has a separate DisciplineReviewer review.** Grep `events.jsonl` for `kind:review` entries with `phase:red`.
   - *Problem if:* any Red commit landed without a preceding `kind:review, phase:red` entry. Per `feedback_red_reviews`, Red reviews are cheap and never skipped — catch spec gaps before Green is built around them.

6. **Each Green has a revert/restore proof.** Grep `events.jsonl` for `kind:revert-restore-proof` entries.
   - *Problem if:* any Green commit landed without a preceding `kind:revert-restore-proof` entry, OR the proof entry has `tests_failed_after_revert: false` (test was passing before the change — Green didn't fail for the right reason). Per `feedback_green_right_reason`: revert in pieces, confirm fail, restore, confirm pass. Xfail-flips-to-pass is not enough.

7. **Verifier and DisciplineReviewer were separate Opus invocations.** Per `feedback_phase_separation`, check `events.jsonl` for distinct `actor:verifier` and `actor:discipline-reviewer` entries on each Green.
   - *Problem if:* one Opus invocation served both roles (single agent doing revert/restore AND review).

8. **Style commits before Red.** `git log --oneline` — first commits must be `style(...)` if `pre_red.formatter_commits[]` was non-empty in the impl-plan.
   - *Problem if:* any `style:` commit landed *after* the first `test:` commit; any commit mixed style + semantic (one commit, two intents). Per `feedback_format_before_tdd`: format is its own commit, before Red.

9. **No test-glob edits during a green phase.** `git log -p -- '*/tests/*' '*.test.*' 'test_*.py'` between consecutive style-commit boundaries. Cross-check phase from `events.jsonl`.
   - *Problem if:* any test-file change landed during `phase:green`. Should be hook-denied; if it landed, the hook is broken or was bypassed. Inspect: was the file added/modified by RedTweaker (allowed in `phase:red`) or smuggled by GreenTweaker (forbidden)?

10. **No assertion erosion across the slice.** Inspect `git diff <style-commit> <outer-green-commit> -- '*/tests/*'`. For each test file:
    - *Problem if:* an assertion was deleted, weakened (e.g. equality → loose-match, exact-string → contains), or guarded behind a skip without a Linear issue ref. Per ENG-2030 lesson and `feedback_companion_session_findings`: every Green and Refactor cycle's DisciplineReviewer should run this check. If erosion is present, the reviewer brief was insufficient or the reviewer rubber-stamped.

11. **Refactor decisions logged.** Grep `events.jsonl` for `kind:defer` (no refactor) or `kind:commit, subject:refactor(...)` (refactor done). Every cycle should have one or the other.
    - *Problem if:* a cycle advanced from `green` → `red(next)` without either a `refactor:` commit or a `kind:defer` event with reason. Per Mandate #6: refactor is mandatory-decision, not optional-skip.

12. **Reviewer briefs were unseeded.** Inspect the spawn payloads in `events.jsonl` `kind:spawn` entries (or session transcript for `Task` calls).
    - *Problem if:* the reviewer brief contains "key questions", "please check whether X", or any nudge beyond `git diff` + step row + plan pointer. Per `feedback_liaison_review_seeding`: brief is diff + context only, no questions or hints.

13. **Every reviewer finding addressed.** Walk each `kind:review, verdict:fail` entry. Confirm a follow-up `kind:submitted` from the appropriate tweaker addresses each finding.
    - *Problem if:* findings dismissed as "scope-creepy", "nice-to-have", or silently dropped. Per `feedback_liaison_fix_everything`: every finding gets a fix or an explicit pushback to the reviewer.

14. **Single iteration per phase.** Count `kind:review` entries per cycle per phase.
    - *Problem if:* >1 review per phase per cycle without an explicit architectural-rework justification in `events.jsonl`. Per `feedback_single_iteration_review`: one review pass per phase, fix everything, move on. Re-review traps compound across cycles.

15. **Tweaker model = Haiku, Reviewer model = Opus.** Inspect `model` field on each `events.jsonl` entry.
    - *Problem if:* RedTweaker or GreenTweaker spawned as Opus (over-engineering risk per 07-enforcement §3.1) or DisciplineReviewer/Verifier spawned as Haiku (rubber-stamp risk).

16. **Tweakers stateless one-shot.** Inspect the spawn payloads — each tweaker's brief should be self-contained (no "continue from your last response" / no resumed sessions).
    - *Problem if:* any tweaker spawn references prior tweaker state, OR multiple `kind:submitted` entries from the same tweaker invocation across cycles. Stateless physical isolation is the strongest defense (04-session-history §7).

17. **Cycle budget compliance.** Inspect `events.jsonl` `kind:submitted` entries from GreenTweaker — `linesAdded` field.
    - *Problem if:* any Green attempt has `linesAdded > 50` and was not followed by a re-spawn-with-feedback. If a Green legitimately needs >50 lines, a `kind:budget-override` event with reason should exist; otherwise the budget was silently raised.

18. **Sub-agents spawned via `Task`, not `crun`.** Inspect transcript or `events.jsonl` for spawn channel.
    - *Problem if:* any tweaker spawned via `crun` — hooks don't fire on `crun` workers (per `worker-reviewer/PROTOCOL.md`), so the second wall of defense is gone. Per memo §4c: `Task` only.

19. **Mutation pass run if required.** Read impl-plan `mutation_pass.required`. If true, grep `events.jsonl` for `kind:mutation-applied` and `kind:mutation-pass-complete`.
    - *Problem if:* `mutation_pass.required: true` but no mutation events in `events.jsonl`; OR any `kind:mutation-uncaught` entry without a corresponding Linear follow-up issue stub. Per ENG-4934: every uncaught mutation is a real test gap, surface it.

20. **Outer test green at end; test list drained.** Inspect final `state.json` — `phase: complete`, `step_index == plan.steps.length`. Inspect last `kind:test-run` entry — outermost test in `failing_tests`?
    - *Problem if:* slice closed without `step_index` reaching the end (some steps elided), OR the outermost test wasn't confirmed green by a final full-suite run (only by the `outer-green` step's single-test run — too narrow). Per Mandate #11.

21. **No xfail / `test.failing` markers without Linear refs.** `git grep -n 'test.failing\|@pytest.mark.xfail\|.skip'` across the slice's test paths.
    - *Problem if:* any marker introduced or left in place without a `# ENG-XXXX` reference. Per `tdd-ci` policy. (Future: a `tdd-ci` push-block extends this.)

22. **Push to main after every commit.** `git log origin/main..HEAD` should be empty at slice close.
    - *Problem if:* commits accumulated locally without push; or any push used `--force` / `--force-with-lease` (project CLAUDE.md: forbidden).

## Verdict Scale

Per `skill-retro` convention, classify the session as one of:

| Verdict | Meaning |
|---------|---------|
| **Worked well** | Hook fired (≥1 deny event); Director never edited; commit sequence matches phase cadence; every Red and Green had its review; every Green had a verifier revert/restore proof; reviewers unseeded; findings all applied; single iteration per phase; mutation pass run if required and all caught; outer test green; test list drained; no xfail-without-ref; pushed regularly. |
| **Partially** | Slice landed with outer test green, but: hook never fired (suspect), or 1-2 reviews skipped, or some style mixed with semantic commits, or one Green missed a revert/restore proof, or one mutation uncaught with no follow-up issue. The slice produced value but the discipline floor was lower than designed. |
| **Collapsed** | Director edited source paths directly (hook broken or absent); OR commits batched phases (no per-phase commits); OR assertion erosion present in the test diff; OR Red reviews skipped; OR mutation pass omitted on a `mutation_pass.required: true` slice; OR slice closed without `step_index == plan.steps.length`; OR sub-agents wrong-modeled (Opus tweakers, Haiku reviewers). The skill ran in name only — empirically equivalent to no enforcement, ENG-1809-style. |

## Linkage

This guide is invoked by `skill-retro` (which reads the SPLIT layout per memo §8 task 2). Manual invocation: `skill-retro` with `args: skill=tdd-execute lab=split`. The `events.jsonl` is the single richest source — start there before the session transcript.
