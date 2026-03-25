---
name: fix-bug
description: Investigate and fix bugs with TDD, code review, and root cause analysis. Creates bug documentation and regression tests. Use this skill whenever the user reports a bug, wants to fix a bug, asks to investigate unexpected behavior, says something is broken, or references a bug issue from Linear. Even if the user doesn't say "bug" explicitly — if they describe something that should work but doesn't, this skill applies.
---

# Fix Bug

Investigate and fix bugs using the full quality workflow — liaison mode, companion, TDD, independent review, and verification. Every bug, regardless of apparent size, gets the same treatment. A typo that looked trivial might reveal a pattern; a "simple" fix might introduce a regression. The cost of over-investing in quality is tokens and time. The cost of under-investing is bugs that come back.

**Pipeline:** `investigate-ci` or user report → **`fix-bug`** (you are here) → optionally `facilitating-a-safeguarding-process`

**Not this skill:** If you're just triaging a CI failure without intending to fix it, use `investigate-ci`. If you're verifying a spec, use `verify-spec`. This skill is for when the intent is to understand *and* fix.

## How This Works

You operate in **liaison mode** with the `our-workflow.md` overrides. You orchestrate — sub-agents execute. A companion watches for drift. The full quality machinery applies to every bug.

This might feel like overkill for a typo. It isn't. The workflow is what ensures you don't fabricate a fix for a bug that doesn't exist, don't skip the regression test, don't forget to check blast radius. The phases are fast when the bug is small and thorough when it's big — the workflow scales naturally without you needing to decide how much quality to apply.

### Setup (at session start)

1. **Enter liaison mode.** Read and follow `.claude/skills/liaison/SKILL.md` with `.claude/skills/liaison/our-workflow.md` overrides.

2. **Spawn a companion** (background, named `"companion"`). Gold standard:
   ```
   - Following `.claude/skills/fix-bug/SKILL.md`
   - Root cause focus: are we fixing the cause or just the symptom?
   - TDD discipline: red must mean something (the test fails for the right reason)
   - Scope containment: are we fixing this bug, or rewriting the module?
   - No regressions: watching the full test suite, not just the new test
   - Review happened: a separate agent reviewed the fix (not self-review)
   - Reproduce before fixing: if the bug can't be reproduced, don't fabricate a fix
   ```

3. **Create or find the Linear issue.** `plan search "keywords"` to check for existing issues. If none: `plan create "bug: short description" --label bug`. Start it: `plan start <id>`.

### The Phases

```
orient → investigate → plan → fix (TDD) → review → verify → document → close
```

Every phase. Every bug. The companion watches throughout.

---

## Phase 0: Orient

Before diving in, understand what you're dealing with.

- **User report**: What did they see? What did they expect? Exact error messages are gold.
- **Sentry**: Check for related errors. Use the `sentry` skill — `sentry issues list`, `sentry issue show`.
- **Recent changes**: `git log --oneline --since="7d" -- <suspected-files>`. Did someone change this recently?
- **Existing bug docs**: Check `docs/bugs/` — has this bug or something similar been reported before?

Check in with the companion after orienting.

## Phase 1: Investigate

The goal is to go from symptoms to root cause. Don't start fixing until you can articulate: "The bug happens because X, in file Y, under condition Z."

### Reproduce

The most important step. A bug you can't reproduce is a bug you can't confidently fix. And **if you can't reproduce it, don't fabricate a fix** — report back to the user and ask for reproduction steps.

- **Best case**: Write a failing test that demonstrates the bug. This becomes your regression test. Mark it as expected-to-fail using the `tdd-ci` skill so CI stays green while you work.
- **If test isn't feasible yet**: Reproduce manually. For UI bugs, use `playwright-cli` (see `manual-testing-by-agent` skill). For API bugs, use `curl` or a test script. Document the reproduction steps.

Delegate investigation to sub-agents when it crosses service boundaries. One agent traces the frontend, another traces the backend. Synthesize their findings.

### Narrow Down

Follow the data, not your intuition:

- **Read the code path.** Trace from the symptom back to the cause. Don't guess — read.
- **Check the boundaries.** Most bugs live at boundaries: between services, between layers, between sync and async, between what the code assumes and what actually happens.
- **Question assumptions.** "This should never be null" — are you sure? "This always runs before that" — does it?

### Root Cause Statement

Before proceeding, write it down explicitly:

```
Root cause: [what's wrong]
Why it exists: [what assumption was violated, what case was missed]
Blast radius: [what else could be affected by the same root cause]
```

If the blast radius is larger than the original report, flag it. You may be looking at a genus of bugs, not just one instance.

Check in with the companion after investigation.

## Phase 2: Plan the Fix

### Define Done

State what "fixed" means before spawning any implementation workers. This is the Definition of Done — say it out loud (per liaison workflow):

- Regression test proves the bug existed and no longer does
- Full relevant test suite passes (no regressions)
- The fix addresses root cause, not just the symptom
- Independently reviewed by a separate agent
- Verified by a separate verification agent
- Bug documented in `docs/bugs/`
- For UI bugs: manually verified in the browser

## Phase 3: Fix (TDD)

Delegate implementation to a worker sub-agent. The worker follows the TDD cycle:

### Red

Write the failing test first. The test should:
- Reproduce the exact bug scenario
- Fail for the *right reason* — it tests the behavior, not a syntax error
- Be at the appropriate level (see `docs/testing/README.md` for guidance on test types)

If CI needs to stay green while you work, mark the test as expected-to-fail using the `tdd-ci` skill:
- Bun Test: `test.failing("description", ...)`
- Pytest: `@pytest.mark.xfail(reason="BUG-NNN: description")`
- Playwright: `test.fail()`

Red and green can be separate workers (one writes the failing test, the next makes it pass). Use judgment on whether to split based on the scope.

### Green

Write the minimal fix. Make the test pass. Resist the urge to refactor adjacent code — that's the next step, and mixing fix + refactor makes review harder.

### Refactor

Now clean up. But stay scoped — refactoring triggered by a bug fix should be directly related to the code you touched. If you spot a broader refactoring opportunity, note it for a separate issue.

### Run Full Suite

Don't just run the new test. Run the full relevant suite:

```bash
bun test                    # JS unit tests
uv run pytest               # Python unit tests
bun test:integration        # If you touched DB/service code
```

If anything fails that wasn't failing before, you introduced a regression. Fix it before proceeding.

## Phase 4: Review

Spawn a **separate review agent**. The implementer is not the reviewer. Give it the diff and context, but **do not seed it** with what to look for. Let it think independently.

```
Review the fix for [bug description].

Use the instructions in `.claude/skills/code-review/SKILL.md`.

Context: [root cause summary, what the fix does]

Run: git diff HEAD~1
```

Review cycle: review → fix findings → re-review, until only nitpick-level findings remain. **Fix everything** — every improvement matters, not just "blocking" findings.

Check in with the companion after review.

## Phase 5: Verify

Spawn a **separate verification agent** (the implementer is not the verifier, the reviewer is not the verifier):

```
Verify the fix for [bug description].

1. The regression test in [test file] should pass
2. The full test suite should pass (no regressions)
3. [For UI bugs: reproduce the original steps — the bug should no longer occur]
4. Check the diff for: weakened assertions, removed guards, unrelated changes
```

The verifier checks forward (fix works) and backward (nothing broke).

## Phase 6: Document

Create a bug document in `docs/bugs/`. Use the next available number:

```bash
ls docs/bugs/ | grep -E '^[0-9]+' | sort -n | tail -1  # Find the latest number
```

### Bug Doc Template

```markdown
# Bug #NNN: [Short Title]

**Status:** Fixed (YYYY-MM-DD)
**Reported:** YYYY-MM-DD
**Reporter:** [who reported it]
**Severity:** [Low / Medium / High / Critical]
**Linear:** [ENG-XXXX]

---

## User Impact

[What the user experiences. Write from the user's perspective.]

---

## Symptoms

[Observable behavior — what goes wrong and when.]

---

## Root Cause

[Why the bug exists. Be specific — file, function, line, condition.]

---

## Fix

[What was changed and why. Reference the commit(s).]

---

## Regression Test

[Which test file and test name prevent this from recurring.]

---

## Blast Radius

[What else was or could have been affected. If the root cause is systemic,
note the genus of bugs this belongs to.]
```

Keep it concise but complete. Future you (or future Claude) will use this to understand what happened without reading the full git history.

## Phase 7: Close

1. **Close the Linear issue**: `plan close <id>`
2. **Commit and push**: Small, focused commits. Reference the Linear issue: `Fixes: ENG-XXXX`
3. **Offer safeguarding**: If the bug reveals a systemic weakness (a genus, not just an instance), suggest: "This bug fits a pattern — want to run a safeguarding session? Use the `facilitating-a-safeguarding-process` skill."

Signs that safeguarding is worth it:
- The root cause is a pattern that could recur in other places
- The bug wasn't caught by existing tests or processes
- The fix felt like it required unusual caution or knowledge
- You found multiple instances of the same issue

Final companion check-in before closing.

## Integration with Other Skills

| Skill | Role in this workflow |
|-------|---------------------|
| `liaison` + `our-workflow.md` | The orchestration backbone — always active |
| `companion` | The quality watchdog — always active |
| `code-review` | Independent review of the fix — always spawned |
| `tdd-ci` | Marking regression tests as expected-to-fail while working |
| `sentry` | Checking production errors during investigation |
| `investigate-ci` | If the bug was surfaced by CI — use that skill's report as your starting point |
| `manual-testing-by-agent` | UI bugs — browser-based verification |
| `facilitating-a-safeguarding-process` | After fixing — systemic prevention |
| `fetching-ci-logs` | If CI fails during your fix |

## Anti-Patterns to Watch For

**Fixing the symptom.** "The null check prevents the crash" — but why is the value null? Don't add a guard where you should fix the data.

**Fabricating a fix.** If you can't reproduce the bug, don't invent a change that "should" fix it. Report back to the user. Ask for reproduction steps, a screenshot, exact error messages. A fix for a non-existent bug is worse than no fix — it changes production code for no reason.

**Over-scoping.** You're fixing a bug, not refactoring the module. If you see other issues, file them as separate Linear issues. The best bug fixes are small and surgical.

**Skipping the failing test.** "I know what's wrong, let me just fix it." No. The test is what proves you understood the bug. Without it, you're guessing.

**Testing only the happy path.** Your regression test should reproduce the bug scenario — the edge case, the race condition, the unexpected input. Not just "the normal flow still works."

**Regression blindness.** Running only the test you wrote. Run the full suite. Other tests exist for a reason.

**Self-reviewing instead of spawning a reviewer.** The implementer is not the reviewer. Always spawn a separate review agent. Fresh eyes catch what familiarity misses.
