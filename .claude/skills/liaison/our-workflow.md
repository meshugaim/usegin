# Our Workflow — Liaison Flavor

Overrides and additions to the base `SKILL.md`. When in conflict, this file wins.

## Agents Commit

Agents commit and push their own work. The liaison does not commit — agents are trusted to commit clean, tested code. This keeps agents self-contained and avoids bottlenecking on the liaison for git operations.

## Step Size

Liaison's judgment. Not forced tiny, not forced large. Right-sized for the task — enough scope to be meaningful, small enough to stay focused and produce reviewable diffs.

## TDD — Required, Strict, Three Distinct Phases

Red-green-refactor. Every implementation step. **Each phase is a distinct step with its own review-fix loop.**

### Phase 1: Red

Write a failing test first. The test must fail for the _right reason_ — it tests the behavior you're about to build, not a missing import or syntax error. If red doesn't mean something, it's not TDD.

Mark as expected-to-fail so CI stays green — see the `tdd-ci` skill.

**Review-fix loop:** Spawn reviewers on the test code. Are the tests testing the right thing? Are assertions precise? Are edge cases covered? Fix → re-review until clean. Commit.

### Phase 2: Green

Make the tests pass. Minimal code to satisfy the tests. Don't go beyond what the tests require.

**Review-fix loop:** Spawn reviewers on the production code. Is the implementation correct? Are invariants preserved? Any regressions? Fix → re-review until clean. Commit.

### Phase 3: Refactor

Clean up. This is a separate, explicit step — not absorbed into review. Look for:
- Duplication (in both production code and tests)
- Naming (do names communicate intent?)
- Structure (is the code in the right place?)
- Comments/docstrings (accurate after the changes?)

**Review-fix loop:** Spawn reviewers on the refactoring diff. Did the refactor preserve behavior? Is it actually cleaner? Fix → re-review until clean. Commit.

### Splitting across agents

Red and green can be separate agents (one writes the failing test, the next makes it pass). Splitting is optional — use judgment based on task complexity.

## Verification Agents

After implementation, spawn a separate verification agent. The implementer is not the verifier. Fresh eyes catch what familiarity misses.

More agents is better. Separating concerns across agents (impl, test, verify, review) keeps each agent focused and produces better results than one agent doing everything.

## Review — Multi-Perspective, Unseeded

After a feature or phase completes, spawn multiple reviewers. Each reviewer brings a different perspective.

**Critical: do not seed reviewers with directions, ideas, or things to look for.** We want independent thinking, not confirmation of the liaison's assumptions. Give them the diff and context, let them think big.

Review cycles: review → fix → review → fix, until only nitpick-level findings remain.

**Fix everything.** Every issue AND every suggestion gets addressed — no selectivity, no "non-blocking" dismissals. If a reviewer says it would make the code better, we do it. The codebase gets better one small choice at a time. The only findings that don't get fixed are ones the re-reviewers themselves downgrade to nitpick on the next pass.

**Capturing learnings**: Review findings that are relevant to future agents (patterns, anti-patterns, architectural insights) may be captured in repo documents. Scope and location decided case by case — the user is in the loop on what gets remembered and where it goes. Nothing is saved without the user seeing and approving it.

## Companion

Spawned at session start. Watches for drift against this workflow. Updated when workflow evolves.

## More overrides

- per issue / slice decide in advance how to manually verify it works and fits with rest of system
- review->fix infinite loop until nitpick level - fixing all (unless completely wrong)
- wait for companion before phase transitions (red→green, green→refactor, refactor→next slice, closing issues). Read-only agents (reviewers, verifiers) can be spawned while companion processes.
- when companion gives input on past work - go back and fix it; don't just take it for future work
- FYI - other agents might be working in parallel on other things; only commit your own changes - tell your agents
- before committing: run `git status` and verify only files you modified are staged. Unstage anything that isn't yours.

## What Stays the Same from SKILL.md

- Sequential by default (no parallelism unless explicitly requested)
- Definition of Done stated before each step
- Linear flow (plan start -> work -> plan close)
- Sub-agent guardrails (orient before acting, recognize spinning, escalate over stubbornness)
- Retro after closing issues or at natural breakpoints
- Safeguarding project patterns
