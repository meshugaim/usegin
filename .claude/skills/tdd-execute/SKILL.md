---
name: tdd-execute
description: "Execute a tdd-impl-plan one Red-Green-Refactor cycle at a time. Director (Opus) orchestrates; never edits. Spawns role-isolated stateless sub-agents (Haiku RedTweaker, Haiku GreenTweaker, Opus DisciplineReviewer) per cycle. A skill-scoped PreToolUse hook reads phase state and physically denies phase-illegal edits — including from the Director itself. Use when you say 'execute the plan', 'run the TDD cycles', '/tdd-execute', or right after tdd-impl-plan finishes and the user says 'go'."
triggers:
  - "execute the plan"
  - "run the TDD cycles"
  - "/tdd-execute"
  - "go execute"
  - "walk the impl-plan"
hooks:
  PreToolUse:
    - matcher: "Write|Edit|MultiEdit"
      hooks:
        - type: command
          command: "bun .claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts"
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bun .claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts"
---

# tdd-execute

Walk an `impl-plan.md` one Red-Green-Refactor cycle at a time. You are the **Director**. You orchestrate. You **do not edit code or tests**. The skill-scoped `PreToolUse` hook denies your edits by design — that is the load-bearing closure of the only structural gap pure sub-agent isolation leaves (memo §4c; 07-enforcement §7.2).

**Pipeline:** `spec` → `slicing-specs` → `test-architecture` → `tdd-impl-plan` → **`tdd-execute`** (you are here).

## TL;DR

- One slice, one workspace at `.tdd-execute/<slice-id>/`. `state.json` is the cursor; `events.jsonl` is the audit log.
- Director is **Opus**, no Edit/Write on source paths. Spawns three role-isolated, **stateless one-shot** sub-agents per cycle — `red-tweaker` (Haiku, test-globs only), `green-tweaker` (Haiku, non-test paths only), `discipline-reviewer` (Opus, read-only). Verifier (revert/restore) is a separate Opus invocation per `feedback_phase_separation`.
- Phase enum is `red | green | refactor | complete`. The hook reads `state.json.phase` and denies phase-illegal edits — including yours. There is no override; route through a tweaker or update state.
- One commit per phase transition. `style:` commits land **before** Red (`feedback_format_before_tdd`). Subjects: `test:` for Red, `feat:` for Green, `refactor:` for Refactor.
- Red review is mandatory (`feedback_red_reviews`). Green review includes a **revert/restore proof** (`feedback_green_right_reason`). Refactor review uses the same diff-erosion check as Green (`feedback_companion_session_findings`).
- One reviewer pass per phase, fix every finding, move on (`feedback_single_iteration_review`, `feedback_liaison_fix_everything`). Reviewer briefs are **unseeded** — diff + step row + plan pointer, no "key questions" (`feedback_liaison_review_seeding`).
- Last step is `outer-green`. Slice ends only when the `outermost: true` test is green and the test list is drained (Mandate #11).
- Mutation pass runs (post-`outer-green`) iff the impl-plan declares `mutation_pass.required: true` (ENG-4934).

## Pipeline position

```
spec + slices  →  test-architecture  →  tdd-impl-plan  →  tdd-execute  →  covered feature
                                                                │
                                                                ▼
                                                       per-cycle commits
                                                       (style → test → feat → refactor)
                                                       + .tdd-execute/<slice-id>/state.json
                                                       + .tdd-execute/<slice-id>/events.jsonl
```

`tdd-execute` consumes `impl-plan.md` (validated against `tdd-impl-plan/schema/impl-plan.schema.json`) and `test-plan.md` (referenced by `T<N>` ids). It produces commits, the workspace audit trail, and — at the end — a covered feature with the `outermost: true` test green.

## The Director model

You are the Director. You think in phases, you orchestrate sub-agents, you commit. You **do not** type code or tests. The hook will deny your edits even if you try.

**Why this design:** sub-agent isolation alone leaves one gap — the orchestrator can route around its own discipline under load (07-enforcement §7.2). Session `9e966133` is the empirical proof: a single agent holding both production-code intent and test-writing intent will, under load, write tests after code and rationalise the order. The hook closes the gap by being agnostic to caller identity. Your discipline is enforced by your tool list (no Edit/Write on source paths), your prompt (this skill), and the hook (mechanical). Three walls.

**If the hook ever fires zero times across an entire slice, suspect the hook is broken.** A working hook will catch at least one accidental Director edit per slice — that is a design feature, not a failure.

## Sub-agent topology

| Role | Model | Tools | Knowledge boundary | Spawn cadence |
|------|-------|-------|--------------------|---------------|
| **Director** (you) | Opus | Read; Bash for `git log`/`git diff`/`git status`/`git commit`/`git push`, state inspection, full-suite runs for tracking only; Task to spawn sub-agents. **No Edit/Write on production or test paths.** | Sees `impl-plan.md`, `test-plan.md`, `state.json`, `events.jsonl`, git log + summarized `git diff --stat` (lines+/-, files). **Does not see full production diff content** — full diff goes only to DisciplineReviewer (memo §7 q2). | Persistent within a slice; stateless across slices. Re-orients from `state.json` at top of each loop iteration. |
| **RedTweaker** | Haiku | Edit/Write restricted to `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`, `**/test_*.py`; Read on spec + test-plan + the failing test only; Bash to run ONE test. | Sees test-plan row + spec AC + last `failureMessage` (if retry). **Does not see production code.** | Stateless, one-shot per `inner-red` / `outer-red` step. |
| **GreenTweaker** | Haiku | Edit/Write on production paths (anything outside `**/*.test.*`, `**/test_*.py`); Read on the failing test + spec; Bash to run ONE test. | Sees `redLine`, `failureMessage`, line-budget. **Does not see other tests beyond the failing one.** | Stateless, one-shot per `inner-green` / `outer-green` step. (`inner-refactor` shares this agent type with relaxed test-glob, run only after the suite is green.) |
| **DisciplineReviewer** | Opus | Read; Bash for `git diff`, full-suite runs. **No Edit.** | Sees `git diff` (full), test output, current step row, prior verdicts. **Unseeded** — no "key questions." | Stateless, one-shot per phase end (Red, Green, Refactor). |
| **Verifier** (revert/restore) | Opus | Read; Bash. | Sees the Green commit and the failing-test commit. | Stateless, one-shot at Green-phase end, **separate** from DisciplineReviewer (`feedback_phase_separation`). |

**Why Haiku for tweakers:** speed, cost, and Haiku is *less prone to over-engineering* — we want the obvious 3-line fix, not anticipation of future tests (07-enforcement §3.1).

**Why Opus for reviewers:** discipline judgment is the hard problem; Haiku rubber-stamps (07-enforcement §3.1).

**Why stateless one-shot:** physical isolation is the strongest defense against test-after, big-bang green, and self-review (04-session-history §7). Each tweaker physically cannot see the other's intent, so it cannot rationalise an exception.

**Spawn channel:** `Task` (in-process), not `crun` — `Task`-spawned children inherit the project hook rules, so the Edit-gate hook fires on tweakers as a second wall of defense behind tool-list isolation. `crun` workers are unhooked (per `worker-reviewer/PROTOCOL.md`) — never spawn tweakers via `crun` (07-enforcement §3.3).

## Phase state

Workspace: `.tdd-execute/<slice-id>/`. Created lazily on slice start (memo §7 q1).

`state.json`:

```jsonc
{
  "plan": "<path to impl-plan.md>",
  "test_plan": "<path to test-plan.md>",
  "step_index": 3,                    // current step in impl-plan.steps (0-indexed)
  "phase": "green",                   // "red" | "green" | "refactor" | "complete"
  "current_target_test_id": "T2",
  "red_commit": "abc123",             // SHA of failing-test commit (for revert/restore proof)
  "last_test_run": {
    "ts": "2026-04-26T12:34:56Z",
    "passed": 17,
    "failed": 1,
    "failing_tests": ["foo.test.ts:42"]
  },
  "cycle_attempts": 1,                // green attempts on current step (cap: 3)
  "cycle_index": 17                   // global counter; one ++ per phase advance
}
```

`events.jsonl` — append-only audit log. **Never overwrite, never edit prior lines.** Schema:

```jsonc
{"ts":"...", "cycle":17, "phase":"red",      "actor":"red-tweaker",          "model":"haiku", "kind":"submitted",        "redLine":"foo.test.ts:42", "failureMessage":"<verbatim>"}
{"ts":"...", "cycle":17, "phase":"red",      "actor":"discipline-reviewer",  "model":"opus",  "kind":"review",           "verdict":"pass", "reasons":[]}
{"ts":"...", "cycle":17, "phase":"red",      "actor":"director",             "model":"opus",  "kind":"commit",           "sha":"abc123", "subject":"test(csv): red — parse rejects empty header"}
{"ts":"...", "cycle":17, "phase":"green",    "actor":"green-tweaker",        "model":"haiku", "kind":"submitted",        "editedFiles":["lib/csv/parse.ts"], "linesAdded":3, "passed":true}
{"ts":"...", "cycle":17, "phase":"green",    "actor":"verifier",             "model":"opus",  "kind":"revert-restore-proof", "reverted":["lib/csv/parse.ts"], "tests_failed_after_revert":true, "tests_pass_after_restore":true}
{"ts":"...", "cycle":17, "phase":"green",    "actor":"discipline-reviewer",  "model":"opus",  "kind":"review",           "verdict":"pass"}
{"ts":"...", "cycle":17, "phase":"refactor", "actor":"director",             "model":"opus",  "kind":"defer",            "reason":"no duplication; one call site; tests green"}
{"ts":"...", "cycle":17, "phase":"refactor", "actor":"director",             "model":"opus",  "kind":"advance"}
{"ts":"...", "cycle":17, "phase":"red",      "actor":"hook",                 "model":"-",     "kind":"deny",             "tool":"Edit", "file_path":"lib/csv/parse.ts", "reason":"phase=red; non-test path"}
```

`hook-deny` lines exist *by design*. Zero `kind:deny` events across an entire slice = the hook may not be wired (see retro-guide).

## The Director loop

```
loop:
  re-read state.json
  if step_index >= plan.steps.length: state.phase = "complete"; break
  step = plan.steps[step_index]
  switch step.role:
    case "outer-red" | "inner-red":
      assert state.phase == "red"
      red = spawn(red-tweaker, { step, spec_ac, last_failure_if_retry })
      append_event({kind:"submitted", actor:"red-tweaker", ...red})
      verdict = spawn(discipline-reviewer-red, { step, red, git_diff_tests })
      append_event({kind:"review", actor:"discipline-reviewer", phase:"red", verdict})
      if verdict.fail:
        # Single iteration: apply finding, re-spawn red-tweaker ONCE with feedback,
        # re-review. If reviewer fails again, escalate to user — do NOT silently
        # iterate (feedback_single_iteration_review).
        handle_red_review_fail(verdict)
        continue
      git_commit("test({scope}): red — {step.notes_oneline}")
      state.red_commit = HEAD
      state.phase = "green"; persist_state()
      append_event({kind:"advance", from:"red", to:"green"})

    case "inner-green" | "outer-green":
      assert state.phase == "green"
      green = spawn(green-tweaker, {
        red_line: state.last_red_line,
        failure_message: state.last_failure_message,
        line_budget: 50,
        tpp_hint: step.transformation_hint
      })
      append_event({kind:"submitted", actor:"green-tweaker", ...green})
      if green.linesAdded > 50 or green.passed != true:
        # Cycle-budget overflow or non-passing — re-spawn with reviewer feedback
        # (07-enforcement §4.4). Cap: cycle_attempts=3.
        retry_green_or_escalate(green); continue
      # Verifier: revert/restore proof (feedback_green_right_reason)
      proof = spawn(verifier, {
        green_files: green.editedFiles,
        red_commit: state.red_commit,
        outer_test: outermost_test_ref
      })
      append_event({kind:"revert-restore-proof", actor:"verifier", ...proof})
      if not proof.tests_failed_after_revert:
        # Test was passing before the change — Green didn't fail for the right
        # reason. Reject. Do NOT settle for xfail-flips-to-pass.
        reject_green_wrong_reason(proof); continue
      # Reviewer: separate Opus invocation (feedback_phase_separation)
      verdict = spawn(discipline-reviewer-green, {
        green_diff: git_diff_full,
        test_diff: git_diff_tests,    # sentinel for assertion erosion
        test_output: test_run
      })
      append_event({kind:"review", actor:"discipline-reviewer", phase:"green", verdict})
      if verdict.fail: handle_green_review_fail(verdict); continue
      git_commit("feat({scope}): green — {step.notes_oneline}")
      state.phase = "refactor"; persist_state()
      append_event({kind:"advance", from:"green", to:"refactor"})

    case "inner-refactor":
      assert state.phase == "refactor"
      decision = spawn(green-tweaker-refactor-mode, { suite_must_stay_green: true })
      if decision.no_refactor_warranted:
        append_event({kind:"defer", actor:"director", reason:decision.reason})
      else:
        append_event({kind:"submitted", actor:"green-tweaker", phase:"refactor", ...decision})
        # Refactor review uses same diff-erosion check as Green
        # (feedback_companion_session_findings). DisciplineReviewer's brief includes
        # the CLEAN/JUSTIFIED/VIOLATION verdict on test-file diffs (memo §7 q5).
        verdict = spawn(discipline-reviewer-refactor, {
          full_diff, test_diff, test_output
        })
        if verdict.fail: handle_refactor_fail(verdict); continue
        git_commit("refactor({scope}): {decision.summary}")
      state.step_index += 1; state.phase = "red"; persist_state()
      append_event({kind:"advance", to_step:state.step_index})

    case "scaffolding" | "verification-only":
      # tdd:false allowed — write directly via green-tweaker, no Red-phase.
      run_non_tdd_step(step)
      state.step_index += 1; persist_state()

    case "contract-check":
      # Treated as inner-red→inner-green per ENG-5023.
      run_as_inner_cycle(step)

# After the loop: outer test must be green; test list drained.
assert outermost_test.green
assert state.step_index == plan.steps.length

# Mutation pass (epilogue)
if plan.mutation_pass.required:
  for m in plan.mutation_pass.mutations:
    apply_mutation_in_throwaway_worktree(m)
    run_suite()
    assert any(t.failed for t in m.expected_to_be_caught_by)
    revert
  if any mutation uncaught: surface as follow-up Linear issue stub.

state.phase = "complete"; persist_state()
push origin main
```

The pseudocode is the contract. Deviations require an explicit `events.jsonl` entry naming the deviation and the reason.

## PreToolUse hook contract

The hook lives at `.claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts` (built by a separate worker). Declared in this file's YAML frontmatter so it is **skill-scoped** — fires only while `tdd-execute` is active, no project-wide overhead.

**Inputs:** the harness writes the tool-call JSON on stdin: `{tool_name, tool_input:{file_path, new_string, ...}}`. The hook discovers the workspace by climbing from `tool_input.file_path` looking for `.tdd-execute/<slice-id>/state.json`, falling back to env `TDD_WORKSPACE`.

**Decisions per phase** (writes JSON to stdout per 07-enforcement §1.2 channel B):

| Phase | Test-glob path | Non-test path | Heredoc-bypass (`Bash` with `cat >`/`tee`/`>>` into source) |
|-------|----------------|---------------|---------------------------------------------------------|
| `red` | allow | **deny** ("In RED phase. Only test edits allowed. Spawn red-tweaker.") | deny if target is non-test path |
| `green` | **deny** ("In GREEN phase. Failing test is locked.") | allow | deny if target is test-glob path |
| `refactor` | allow iff `last_test_run.passed > 0 ∧ failed == 0 ∧ ts > all_edits_since_last_green` | allow under same fresh-green condition | deny if condition fails ("Re-run the suite first.") |
| `complete` | **deny** ("Slice complete. No more edits.") | **deny** | deny |

**No-op outside tdd-execute workspaces:** if no `state.json` is found by climbing, hook exits 0. Critical for not breaking unrelated work in the same repo.

**Director identity:** the hook does not know who is calling. The Director, RedTweaker, GreenTweaker, and any future tool are all subject to the same gate. That symmetry is the design — it is what closes the only gap pure isolation leaves.

**Heredoc-bypass closure:** sibling matcher on `Bash` regex `cat\s*>|tee|>>?\s*[A-Za-z]` writing into source paths. Without this, an agent could route around `Edit`/`Write` via shell redirection (07-enforcement §2.1).

## Commit cadence

One commit per phase transition. Subjects parse:

| Phase end | Subject template | When |
|-----------|------------------|------|
| Pre-Red format | `style({scope}): {formatter} {area}` | Each `pre_red.formatter_commits[]` entry — **before** step 1 (`feedback_format_before_tdd`). |
| Red | `test({scope}): red — {one-line behaviour}` | After RedTweaker returns and DisciplineReviewer Red-pass review verdicts pass. Never skip Red review (`feedback_red_reviews`). |
| Green | `feat({scope}): green — {step.notes_oneline}` | After GreenTweaker returns, **revert/restore proof passes**, and DisciplineReviewer Green review verdicts pass. |
| Refactor | `refactor({scope}): {change}` | After Refactor phase, iff a refactor was performed. If deferred, no commit — `events.jsonl` records the defer + reason (Mandate #6). |

Push after every commit (per `feedback_always_push.md` and project CLAUDE.md "commit early, commit often"). Pre-push hooks run; if rejected, diagnose root cause — never `--no-verify` (project CLAUDE.md).

## Director: do directly / delegate / forbid

| Action | Verdict | Notes |
|--------|---------|-------|
| Read `state.json`, `events.jsonl`, `impl-plan.md`, `test-plan.md`, spec | **direct** | These are your sole context. Re-read at top of each loop iteration. |
| `git log`, `git status`, `git diff --stat`, `git commit`, `git push` | **direct** | You are the only writer to git. Subjects per cadence table. |
| Run the full test suite (Bash) for state-tracking | **direct** | Result lands in `state.json.last_test_run`. Sub-agents run only one test. |
| Append to `events.jsonl`, atomically update `state.json` | **direct** | Use a write-temp-then-rename pattern; never partial writes. |
| Edit a test file | **delegate to RedTweaker** | Hook denies you. |
| Edit a production file | **delegate to GreenTweaker** | Hook denies you. |
| Refactor a test or production file | **delegate to GreenTweaker (refactor mode)** | Suite must be green-and-fresh first; hook denies otherwise. |
| Render a Red / Green / Refactor verdict | **delegate to DisciplineReviewer** | Never review your own work. Briefs are unseeded — diff + step row + plan pointer (`feedback_liaison_review_seeding`). Verifier (revert/restore) is a separate Opus invocation (`feedback_phase_separation`). |
| Explore unfamiliar code | **delegate to Explore sub-agent** | Per `feedback_prefer_subagents_for_explore`. |
| Conflate phases ("write test and impl in one shot") | **forbidden** | Hook enforces via phase gating. |
| Seed a reviewer with "key questions" | **forbidden** | `feedback_liaison_review_seeding`: brief is `git diff` + step row + plan pointer. Nothing else. |
| Triage reviewer findings as "scope-creepy" | **forbidden** | `feedback_liaison_fix_everything`: every finding gets a fix sub-agent or an explicit pushback to the reviewer. |
| Re-review after fixes | **forbidden** | `feedback_single_iteration_review`: one review pass per phase. Architectural rework is a different phase. |
| `git --no-verify` to skip hooks | **forbidden** | Project CLAUDE.md. Diagnose the root cause. |

## Setup workflow (starting a slice)

1. **Validate impl-plan.** Run schema check against `tdd-impl-plan/schema/impl-plan.schema.json`. Refuse to start on schema failure — bounce back to `tdd-impl-plan`.
2. **Validate gates.** Confirm: (a) test-plan referenced exists and validates against test-architecture schema; (b) `outermost: true` test exists in test-plan; (c) step 1 is `outer-red` and references the outermost test; (d) last step is `outer-green` referencing the same `target_test_id` as step 1.
3. **Create workspace.** `mkdir -p .tdd-execute/<slice-id>/`. Initialize `state.json` (`step_index: 0, phase: "red", cycle_index: 0`) and an empty `events.jsonl`. Lazy-create per memo §7 q1 — do not pre-create workspaces for sibling slices.
4. **Land pre-Red style commits.** Walk `pre_red.formatter_commits[]` in order. One Bash call per entry, then `git commit -m "style(...): ..."`. Push. Append `events.jsonl` `kind:style-commit`.
5. **Land walking-skeleton steps if any.** Walk `walking_skeleton.steps[]` via GreenTweaker scaffolding mode (`tdd: false`). Outer-red is still red after skeleton — but for the right reason (assertion failure, not import error).
6. **Spawn first agent.** Step 1 is `outer-red` → spawn RedTweaker.
7. **Enter the loop.**

## Failure recovery

| Failure mode | Recovery |
|--------------|----------|
| RedTweaker returns "test passes already" | The behaviour is already covered. Spawn DisciplineReviewer to confirm; if confirmed, mark step `verification-only`, skip to next step. Append `events.jsonl` `kind:already-covered`. |
| RedTweaker's red is the wrong-shape failure (import error, syntax error) | DisciplineReviewer Red-review catches this. Re-spawn RedTweaker with reviewer feedback. Cap: `cycle_attempts=3`; on cap, escalate to user with the failure trail. |
| GreenTweaker line-budget exceeded (>50 lines) | Save `state/last-failed-attempt.diff`, revert, re-spawn with reviewer feedback per 07-enforcement §4.4. Cap: `cycle_attempts=3`. On cap: escalate, do not silently lower the budget. |
| GreenTweaker returns `passed: true` but verifier's revert/restore proof fails (`tests_failed_after_revert` is false) | Test was passing before the change — Green didn't fail for the right reason (`feedback_green_right_reason`). Revert the Green, escalate to user. Do NOT accept xfail-flips-to-pass. |
| DisciplineReviewer rejects (Red, Green, or Refactor) | Apply every finding (`feedback_liaison_fix_everything`). One re-spawn per finding type. After fixes, re-review is allowed **only if the fixes are architectural** (`feedback_single_iteration_review` exception); otherwise skip re-review and advance. |
| Reviewer's findings conflict with prior reviewer findings (multi-reviewer convergence) | Per `feedback_multi_reviewer_convergence`: independent convergence promotes a potential-nit to real-information; treat in-scope. Apply both. |
| `state.json` desynced from git (e.g. session resumed mid-cycle) | Re-orient from `events.jsonl` (most recent `kind:advance` is the last good state). Reconstruct `state.json`. Append `kind:reorient` event. |
| Test-glob edit landed during `phase=green` (hook should have denied) | The hook is broken. Stop, `git revert` the offending commit, surface to user, do not continue. |
| Hook fired zero times across the slice | Hook may not be wired (skill not active, or matcher mismatch). Surface to user before the slice's `complete` event — a slice with zero deny events is suspect. |

## Cycle budgets

Defaults (overridable per step via `impl-plan.transformation_hint` or top-level `cycle_budgets`):

- **Lines per Green attempt:** 50 (07-enforcement §4.4 / memo §4c). On overflow → re-spawn with feedback.
- **Retry cap per phase:** 3 (`cycle_attempts`). On cap → escalate to user.
- **Full-suite runs per cycle:** at minimum two — once during Green review (DisciplineReviewer), once during the verifier's revert/restore proof. Tweakers run **one** test only — never the full suite.

## Mutation-pass epilogue

Per ENG-4934. Runs after `outer-green` lands, iff `impl_plan.mutation_pass.required: true`.

For each `mutations[]` entry:
1. Create a throwaway working tree (`git worktree add .tdd-execute/<slice-id>/mutations/<id>`).
2. Apply the mutation (single-line breakage in `target_file`/`target_function`).
3. Run the test suite.
4. Assert at least one of `expected_to_be_caught_by[]` failed. If yes → mutation caught → revert worktree.
5. If no test caught the mutation → real test gap. Surface as a Linear follow-up issue stub. Append `events.jsonl` `kind:mutation-uncaught`.
6. After all mutations: tear down worktrees, append `kind:mutation-pass-complete`, mark slice `complete`.

Mutation-pass is opt-in via `tdd-impl-plan.mutation_pass.required` (memo §7 q3). Default-off; encouraged for `failure_mode_class: contract` and `race`.

## Mandate alignment

| # | Mandate | Where enforced in tdd-execute |
|---|---------|-------------------------------|
| 1 | No prod without failing test | Hook (`phase=red` denies prod Edit) + GreenTweaker spawn-gated on RedTweaker's verified `failureMessage`. |
| 2 | Outer loop first | Setup gate validates step 1 is `outer-red`; `state.phase` cannot bypass `red`. |
| 3 | One inner cycle at a time | `state.phase` is single-valued; loop is sequential by design; no nested reds. |
| 4 | Red must be observed | RedTweaker returns `failureMessage` verbatim, recorded before phase advance; DisciplineReviewer judges right-line (semantic). |
| 5 | Smallest legal transformation | GreenTweaker is Haiku + line-budgeted; `transformation_hint.tpp_rank` from impl-plan; reviewer judges taste. |
| 6 | Refactor mandatory-or-deferred-with-reason | `inner-refactor` step's defer path requires `events.jsonl` entry with reason; never silently skipped. |
| 7 | Tests assert behaviour, not implementation | Honor-system; DisciplineReviewer brief includes the smell list (mock-call assertions, private-state reads). |
| 8 | One failure per test | RedTweaker brief: "ONE assertion." DisciplineReviewer rejects multi-failure-mode tests. |
| 9 | No weakened assertions | Hook (`phase=green` denies test-file Edit); DisciplineReviewer reviews `git diff -- '*/tests/*'` after every Green and Refactor (`feedback_companion_session_findings`). |
| 10 | Commit at every green | Director-loop `git_commit` per phase verdict-pass; subjects per cadence table. |
| 11 | Slice ends with outer green & list drained | Setup gate validates outer-green is last step; loop terminates only when `outermost: true` test green AND `step_index == plan.steps.length`. |
| 12 | Tests must be good | Honor-system reviewer brief; mutation-pass epilogue (opt-in) is the operationalization. |

## What this skill does NOT do

- **Does not write the test plan.** That's `test-architecture`.
- **Does not order steps.** That's `tdd-impl-plan`.
- **Does not parallelize cycles.** Sequential per Mandate #3. Pre-prepping sibling-slice workspaces is allowed but execution is one slice at a time (memo §7 q1).
- **Does not enforce test quality semantically.** Mandates #7, #12 are honor-system; DisciplineReviewer judges; mutation-pass is the operational backstop.
- **Does not implement TCR (test && commit || revert).** M2 in 07-enforcement §7.1 — over-investment for v1; revisit only if GreenTweaker first-attempt failure rate >50% (memo §7 q6).
- **Does not block pushes for missing-Linear-issue xfail markers.** Pattern D mitigation deferred to a `tdd-ci` extension (memo §4c).
- **Does not run live tests at planning time.** Live runs happen in tweakers and reviewers; Director runs the full suite only for state-tracking (after Green, after Refactor) — never to write code based on the result.
- **Does not write its own hook.** The hook is a separate file authored by another worker; this skill declares it in YAML frontmatter.

## Coexistence

| Skill | Relationship | Notes |
|-------|--------------|-------|
| `test-architecture` | **upstream** | Produces `test-plan.md`. The `outermost: true` row is the one we end Green on. |
| `tdd-impl-plan` | **upstream** | Produces `impl-plan.md`. Schema-validated before any cycle starts. |
| `tdd-ci` | **called** | Red-phase markers (`test.failing`, `xfail`) policy lives in `tdd-ci`. RedTweaker applies the markers per `tdd-ci` syntax. |
| `verify-spec` | **downstream** | After the slice (and the spec) closes, `verify-spec` confirms cross-slice integration and AC coverage. No overlap. |
| `worker-reviewer` | **coexists (small modules)** | Tight TDD for atomic single-module work (md2html-shaped). `tdd-execute` is for slices with cross-layer seams. Same shared `tools/tdd-shared/` lib (frontmatter, state, events). Picker: small + atomic → `worker-reviewer`; multi-layer / seamed → `tdd-execute`. |
| `liaison` | **calls** | Liaison delegates TDD-heavy phases to the trio. The `feedback_*` discipline is inherited verbatim. |
| `fix-bug` | **calls** | Bug regressions fit the slice shape: outer test is the regression test, inner cycles are the fix. |
| `mikado` | **coexists (orthogonal)** | Mikado-leaf may itself be a `tdd-execute` cycle. |
| `build-orchestrate` | **may call** | For multi-phase builds, the implementation phase can delegate slices to `tdd-execute`. |

## Style

Concise. Tables over prose. Cite ENG-ids and `feedback_*` files where claims need grounding. No filler. No emoji. The skill is a contract.
